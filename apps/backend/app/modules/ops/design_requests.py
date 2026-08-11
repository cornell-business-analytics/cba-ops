import contextlib
import hmac
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.design_request import DesignRequest, DesignRequestStatus
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.design_request import (
    AgentCallback,
    DesignRequestCreate,
    DesignRequestPublic,
    DesignRequestReview,
    DesignRequestStatusCheck,
)
from app.services import github

router = APIRouter(prefix="/design-requests", tags=["design-requests"])

RETRYABLE_STATUSES = {DesignRequestStatus.dispatch_failed.value, DesignRequestStatus.agent_failed.value}
DISCARDABLE_STATUSES = {
    DesignRequestStatus.pr_open.value,
    DesignRequestStatus.agent_failed.value,
    DesignRequestStatus.merge_failed.value,
}


def _now() -> datetime:
    return datetime.now(UTC)


async def _log(db: AsyncSession, user_id: uuid.UUID | None, action: str, resource_id: uuid.UUID, payload: dict | None = None) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            resource_type="design_request",
            resource_id=str(resource_id),
            payload=payload,
        )
    )


async def _get_request_or_404(db: AsyncSession, request_id: uuid.UUID) -> DesignRequest:
    result = await db.execute(select(DesignRequest).where(DesignRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Design request not found")
    return req


async def _dispatch(db: AsyncSession, req: DesignRequest) -> None:
    """Trigger the agent workflow. Unlike the ISR-revalidate pattern elsewhere
    in this codebase, a failure here is NOT swallowed — the whole point of
    approving is to kick off the agent, so the requester needs to see it
    didn't happen and be able to retry.
    """
    req.branch_name = f"design-request/{req.id}"
    try:
        await github.trigger_workflow_dispatch(
            str(req.id), req.description,
            attachment_url=req.attachment_url,
            target_path=req.target_path,
        )
    except httpx.HTTPError as exc:
        req.status = DesignRequestStatus.dispatch_failed.value
        req.agent_error = str(exc)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Failed to dispatch agent: {exc}")

    req.status = DesignRequestStatus.agent_running.value
    req.dispatched_at = _now()


@router.post("", response_model=DesignRequestPublic, status_code=status.HTTP_201_CREATED)
async def submit_design_request(
    body: DesignRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = DesignRequest(
        requested_by_id=current_user.id,
        description=body.description,
        attachment_url=body.attachment_url,
        target_path=body.target_path,
    )
    db.add(req)
    await db.flush()
    await _log(db, current_user.id, "design_request.submitted", req.id)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/website-images", response_model=list[str])
async def list_website_images(
    current_user: User = Depends(get_current_user),
):
    """Returns paths (relative to apps/website/public/) of images in the repo."""
    if not settings.GITHUB_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GITHUB_TOKEN is not configured on the server.",
        )
    try:
        return await github.list_website_images()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not fetch image list from GitHub: {exc}",
        ) from exc


@router.get("", response_model=list[DesignRequestPublic])
async def list_design_requests(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(DesignRequest)
    is_director_or_above = current_user.role in (UserRole.director, UserRole.recruitment, UserRole.eboard)
    if not is_director_or_above:
        query = query.where(DesignRequest.requested_by_id == current_user.id)
    if status_filter:
        query = query.where(DesignRequest.status == status_filter)
    result = await db.execute(query.order_by(DesignRequest.created_at.desc()))
    return result.scalars().all()


@router.get("/{request_id}", response_model=DesignRequestPublic)
async def get_design_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    is_director_or_above = current_user.role in (UserRole.director, UserRole.recruitment, UserRole.eboard)
    if not is_director_or_above and req.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    return req


@router.patch("/{request_id}/review", response_model=DesignRequestPublic)
async def review_design_request(
    request_id: uuid.UUID,
    body: DesignRequestReview,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    if req.status != DesignRequestStatus.pending.value:
        raise HTTPException(status_code=400, detail="Already reviewed")

    req.reviewed_by_id = current_user.id
    req.reviewer_note = body.reviewer_note
    req.reviewed_at = _now()

    if body.status == DesignRequestStatus.rejected.value:
        req.status = DesignRequestStatus.rejected.value
        await _log(db, current_user.id, "design_request.rejected", req.id)
        await db.commit()
        await db.refresh(req)
        return req

    if body.status != DesignRequestStatus.approved.value:
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    req.status = DesignRequestStatus.approved.value
    await _log(db, current_user.id, "design_request.approved", req.id)
    await _dispatch(db, req)
    await _log(db, current_user.id, "design_request.dispatched", req.id)
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/{request_id}/retry-dispatch", response_model=DesignRequestPublic)
async def retry_dispatch(
    request_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    if req.status not in RETRYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot retry from status '{req.status}'")

    req.agent_error = None
    await _dispatch(db, req)
    await _log(db, current_user.id, "design_request.dispatched", req.id)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/{request_id}/status", response_model=DesignRequestStatusCheck)
async def check_design_request_status(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    is_director_or_above = current_user.role in (UserRole.director, UserRole.recruitment, UserRole.eboard)
    if not is_director_or_above and req.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    pollable_statuses = (DesignRequestStatus.pr_open.value, DesignRequestStatus.merge_failed.value)
    if req.status not in pollable_statuses or not req.branch_name:
        return DesignRequestStatusCheck(ci_status=None, preview_url=req.preview_url, mergeable=None, pr_url=req.pr_url)

    ci_status = await github.get_combined_check_status(req.branch_name)

    if not req.preview_url:
        preview_url = await github.get_latest_deployment_url(req.branch_name)
        if preview_url:
            req.preview_url = preview_url
            await db.commit()

    return DesignRequestStatusCheck(
        ci_status=ci_status,
        preview_url=req.preview_url,
        mergeable=(ci_status == "success"),
        pr_url=req.pr_url,
    )


@router.post("/{request_id}/confirm", response_model=DesignRequestPublic)
async def confirm_design_request(
    request_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    if req.status not in (DesignRequestStatus.pr_open.value, DesignRequestStatus.merge_failed.value):
        raise HTTPException(status_code=400, detail=f"Cannot confirm from status '{req.status}'")
    if req.requested_by_id is not None and req.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You submitted this request — someone else needs to confirm and merge it.",
        )
    if not req.pr_number:
        raise HTTPException(status_code=400, detail="No PR associated with this request")

    pr = await github.get_pr(req.pr_number)
    if pr.get("head", {}).get("ref") != req.branch_name:
        raise HTTPException(status_code=409, detail="PR branch does not match this request — refusing to merge")

    ci_status = await github.get_combined_check_status(req.branch_name)
    if ci_status != "success":
        raise HTTPException(status_code=409, detail=f"Checks are not passing (status: {ci_status or 'pending'})")

    try:
        merge_result = await github.merge_pr(
            req.pr_number, commit_message=f"Design request {req.id}: {req.description[:200]}"
        )
    except httpx.HTTPError as exc:
        req.status = DesignRequestStatus.merge_failed.value
        req.agent_error = str(exc)
        await _log(db, current_user.id, "design_request.merge_failed", req.id)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Merge failed: {exc}")

    req.status = DesignRequestStatus.merged.value
    req.confirmed_by_id = current_user.id
    req.confirmed_at = _now()
    req.merged_at = _now()
    req.merge_commit_sha = merge_result.get("sha")
    await _log(db, current_user.id, "design_request.confirmed_and_merged", req.id)
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/{request_id}/discard", response_model=DesignRequestPublic)
async def discard_design_request(
    request_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_or_404(db, request_id)
    if req.status not in DISCARDABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot discard from status '{req.status}'")

    if req.pr_number:
        # request is being discarded either way; a stray open PR can be closed manually
        with contextlib.suppress(httpx.HTTPError):
            await github.close_pr(req.pr_number)

    req.status = DesignRequestStatus.discarded.value
    req.discarded_at = _now()
    await _log(db, current_user.id, "design_request.discarded", req.id)
    await db.commit()
    await db.refresh(req)
    return req


@router.post("/webhook/agent-callback", status_code=status.HTTP_200_OK)
async def agent_callback(
    body: AgentCallback,
    db: AsyncSession = Depends(get_db),
    x_design_agent_secret: str = Header(default=""),
):
    if not settings.DESIGN_AGENT_WEBHOOK_SECRET or not hmac.compare_digest(
        x_design_agent_secret, settings.DESIGN_AGENT_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    req = await _get_request_or_404(db, body.request_id)
    if req.status != DesignRequestStatus.agent_running.value:
        return {"noop": True}  # already handled (duplicate/retried delivery)

    if body.outcome == "success":
        req.status = DesignRequestStatus.pr_open.value
        req.branch_name = body.branch_name or req.branch_name
        req.pr_number = body.pr_number
        req.pr_url = body.pr_url
        req.workflow_run_id = body.workflow_run_id
        req.agent_completed_at = _now()
        await _log(db, None, "design_request.agent_completed", req.id, {"pr_url": body.pr_url})
    else:
        req.status = DesignRequestStatus.agent_failed.value
        req.agent_error = body.error_message
        req.agent_completed_at = _now()
        await _log(db, None, "design_request.agent_failed", req.id, {"error": body.error_message})

    await db.commit()
    return {"ok": True}
