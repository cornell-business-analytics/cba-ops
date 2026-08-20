import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.candidate import (
    ApplicationCycle,
    Candidate,
    InterviewCategory,
    InterviewRound,
    InterviewSession,
)
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.modules.ops.recruitment import _extract_sheet_id, _get_valid_token
from app.schemas.cycle import (
    CycleCreate,
    CyclePublic,
    CycleUpdate,
    InterviewRoundCreate,
    InterviewRoundPublic,
    InterviewSessionCreate,
    InterviewSessionPublic,
)
from app.services.images import normalize_image

router = APIRouter(tags=["cycles"])


# ---------------------------------------------------------------------------
# Application cycles
# ---------------------------------------------------------------------------

@router.get("/cycles", response_model=list[CyclePublic])
async def list_cycles(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).order_by(ApplicationCycle.name))
    return result.scalars().all()


@router.post("/cycles", response_model=CyclePublic, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    body: CycleCreate,
    _: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    cycle = ApplicationCycle(**body.model_dump())
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return cycle


@router.patch("/cycles/{cycle_id}", response_model=CyclePublic)
async def update_cycle(
    cycle_id: uuid.UUID,
    body: CycleUpdate,
    _: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cycle, field, value)
    await db.commit()
    await db.refresh(cycle)
    return cycle


# ---------------------------------------------------------------------------
# Interview rounds
# ---------------------------------------------------------------------------

@router.get("/cycles/{cycle_id}/rounds", response_model=list[InterviewRoundPublic])
async def list_rounds(
    cycle_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.cycle_id == cycle_id)
        .options(selectinload(InterviewRound.categories))
        .order_by(InterviewRound.round_number)
    )
    return result.scalars().all()


@router.post(
    "/cycles/{cycle_id}/rounds",
    response_model=InterviewRoundPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_round(
    cycle_id: uuid.UUID,
    body: InterviewRoundCreate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    round_ = InterviewRound(
        cycle_id=cycle_id,
        round_number=body.round_number,
        name=body.name,
        score_format=body.score_format,
        interview_format=body.interview_format,
        is_default=body.is_default,
    )
    db.add(round_)
    await db.flush()

    for cat in body.categories:
        db.add(InterviewCategory(round_id=round_.id, **cat.model_dump()))

    await db.commit()
    await db.refresh(round_)

    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_.id)
        .options(selectinload(InterviewRound.categories))
    )
    return result.scalar_one()


@router.delete("/rounds/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(
    round_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    await db.delete(round_)
    await db.commit()


# ---------------------------------------------------------------------------
# Interview sessions
# ---------------------------------------------------------------------------

@router.get("/rounds/{round_id}/sessions", response_model=list[InterviewSessionPublic])
async def list_sessions(
    round_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.round_id == round_id)
        .order_by(InterviewSession.time_slot)
    )
    return result.scalars().all()


@router.post(
    "/rounds/{round_id}/sessions",
    response_model=InterviewSessionPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    round_id: uuid.UUID,
    body: InterviewSessionCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    session = InterviewSession(round_id=round_id, **body.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


# ---------------------------------------------------------------------------
# Candidate import from Google Sheet
# ---------------------------------------------------------------------------

class CandidateColumnMapping(BaseModel):
    timestamp_col: str = "Timestamp"
    personal_email_col: str = "Email Address"
    cornell_email_col: str = "Cornell Email"
    name_col: str = "Name"
    pronouns_col: str = "Pronouns"
    netid_col: str = "NetID"
    year_col: str = "Year"
    transfer_col: str = "Are you a transfer student?"
    college_col: str = "College"
    major_col: str = "Major(s)"
    headshot_col: str = "Please upload a headshot"
    gender_col: str = "How do you identify?"
    ethnicity_col: str = "How do you identify?.1"


class ImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    missing_cols: list[str]


def _extract_drive_file_id(url: str) -> str | None:
    """Extract Google Drive file ID from various URL formats."""
    if not url:
        return None
    # https://drive.google.com/file/d/FILE_ID/view
    if "/file/d/" in url:
        part = url.split("/file/d/")[1]
        return part.split("/")[0].split("?")[0]
    # https://drive.google.com/open?id=FILE_ID
    if "open?id=" in url:
        return url.split("open?id=")[1].split("&")[0]
    # https://drive.google.com/uc?id=FILE_ID
    if "uc?id=" in url:
        return url.split("uc?id=")[1].split("&")[0]
    return None


def _get_r2_client() -> Any:
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


async def _download_and_store_headshot(
    drive_url: str, cycle_id: str, token: str
) -> str | None:
    """Download headshot from Drive, normalize, upload to R2. Returns public URL or None."""
    file_id = _extract_drive_file_id(drive_url)
    if not file_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
                headers={"Authorization": f"Bearer {token}"},
                follow_redirects=True,
            )
        if r.status_code != 200:
            return None
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0]
        if not content_type.startswith("image/"):
            return None
        try:
            normalized, stored_type = normalize_image(r.content, content_type, "headshot")
        except ValueError:
            return None
        ext = "webp" if stored_type == "image/webp" else "jpg"
        key = f"uploads/candidates/{cycle_id}/{uuid.uuid4()}.{ext}"
        if not settings.R2_ACCESS_KEY_ID:
            return None
        _get_r2_client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=normalized,
            ContentType=stored_type or "image/webp",
        )
        return f"{settings.R2_PUBLIC_URL}/{key}"
    except Exception:
        return None


@router.post("/cycles/{cycle_id}/import", response_model=ImportResult)
async def import_candidates(
    cycle_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if not cycle.sheet_url:
        raise HTTPException(status_code=400, detail="No sheet URL configured for this cycle")

    token = await _get_valid_token(current_user.id, db)
    sheet_id = _extract_sheet_id(cycle.sheet_url)

    # Overlay stored column mapping onto defaults
    col_map = CandidateColumnMapping(**(cycle.column_mapping or {}))

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A:ZZ",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {resp.text[:200]}")

    data = resp.json()
    rows = data.get("values", [])
    if len(rows) < 2:
        return ImportResult(imported=0, updated=0, skipped=0, missing_cols=[])

    headers = rows[0]

    def col(name: str) -> int | None:
        try:
            return headers.index(name)
        except ValueError:
            # prefix match for long Google Form headers
            name_lower = name.lower()
            for i, h in enumerate(headers):
                if h.lower().startswith(name_lower):
                    return i
            return None

    def val(row: list[str], idx: int | None) -> str:
        if idx is None or idx >= len(row):
            return ""
        return row[idx].strip()

    # Find all column indices
    col_indices = {
        "timestamp": col(col_map.timestamp_col),
        "personal_email": col(col_map.personal_email_col),
        "cornell_email": col(col_map.cornell_email_col),
        "name": col(col_map.name_col),
        "pronouns": col(col_map.pronouns_col),
        "netid": col(col_map.netid_col),
        "year": col(col_map.year_col),
        "transfer": col(col_map.transfer_col),
        "college": col(col_map.college_col),
        "major": col(col_map.major_col),
        "headshot": col(col_map.headshot_col),
        "gender": col(col_map.gender_col),
        "ethnicity": col(col_map.ethnicity_col),
    }

    missing_cols = [
        name for field, name in [
            ("timestamp", col_map.timestamp_col),
            ("personal_email", col_map.personal_email_col),
            ("cornell_email", col_map.cornell_email_col),
            ("name", col_map.name_col),
            ("netid", col_map.netid_col),
        ]
        if col_indices[field] is None
    ]

    imported = updated = skipped = 0

    for i, row in enumerate(rows[1:], start=1):
        netid_raw = val(row, col_indices["netid"]).lower().split("@")[0]
        if not netid_raw:
            skipped += 1
            continue

        # Look for existing candidate by net_id in this cycle
        existing_result = await db.execute(
            select(Candidate).where(
                Candidate.cycle_id == cycle_id,
                Candidate.net_id == netid_raw,
            )
        )
        candidate = existing_result.scalar_one_or_none()

        college_raw = val(row, col_indices["college"])
        college_list = [v.strip() for v in college_raw.split(",") if v.strip()] if college_raw else []

        ethnicity_raw = val(row, col_indices["ethnicity"])
        ethnicity_list = [v.strip() for v in ethnicity_raw.split(",") if v.strip()] if ethnicity_raw else []

        transfer_raw = val(row, col_indices["transfer"])
        is_transfer = transfer_raw.lower().startswith("y") if transfer_raw else False

        # Download headshot if we don't have one yet (or always update on re-import)
        headshot_url: str | None = candidate.headshot_url if candidate else None
        headshot_raw = val(row, col_indices["headshot"])
        if headshot_raw and ("drive.google.com" in headshot_raw):
            new_url = await _download_and_store_headshot(headshot_raw, str(cycle_id), token)
            if new_url:
                headshot_url = new_url

        fields = {
            "name": val(row, col_indices["name"]) or (candidate.name if candidate else ""),
            "email": val(row, col_indices["personal_email"]),
            "cornell_email": val(row, col_indices["cornell_email"]),
            "net_id": netid_raw,
            "pronouns": val(row, col_indices["pronouns"]) or None,
            "grad_year": val(row, col_indices["year"]) or None,
            "is_transfer": is_transfer,
            "college": college_list,
            "major": val(row, col_indices["major"]) or None,
            "gender_identity": val(row, col_indices["gender"]) or None,
            "ethnicity": ethnicity_list,
            "headshot_url": headshot_url,
        }

        if candidate:
            for k, v in fields.items():
                setattr(candidate, k, v)
            updated += 1
        else:
            candidate = Candidate(cycle_id=cycle_id, status="applied", **fields)
            db.add(candidate)
            imported += 1

    await db.commit()
    return ImportResult(imported=imported, updated=updated, skipped=skipped, missing_cols=missing_cols)


# ---------------------------------------------------------------------------
# Headshot purge
# ---------------------------------------------------------------------------

class HeadshotPurgeResult(BaseModel):
    deleted: int


@router.delete("/cycles/{cycle_id}/headshots", response_model=HeadshotPurgeResult)
async def purge_headshots(
    cycle_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cycle not found")

    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(status_code=503, detail="Asset storage not configured")

    prefix = f"uploads/candidates/{cycle_id}/"
    r2 = _get_r2_client()

    # List all objects under the cycle's prefix
    keys_to_delete: list[dict] = []
    paginator = r2.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys_to_delete.append({"Key": obj["Key"]})

    deleted = len(keys_to_delete)

    # Batch delete (R2 supports up to 1000 per call)
    for i in range(0, len(keys_to_delete), 1000):
        batch = keys_to_delete[i:i + 1000]
        r2.delete_objects(Bucket=settings.R2_BUCKET_NAME, Delete={"Objects": batch})

    # Clear headshot_url on all candidates in this cycle
    cands_result = await db.execute(
        select(Candidate).where(Candidate.cycle_id == cycle_id, Candidate.headshot_url.isnot(None))
    )
    for candidate in cands_result.scalars().all():
        candidate.headshot_url = None

    await db.commit()
    return HeadshotPurgeResult(deleted=deleted)
