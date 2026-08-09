import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services import github


@pytest.mark.asyncio
async def test_submit_design_request(member_client: AsyncClient):
    resp = await member_client.post(
        "/ops/v1/design-requests", json={"description": "Make the hero background darker green"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["description"] == "Make the hero background darker green"


@pytest.mark.asyncio
async def test_member_cannot_review(member_client: AsyncClient):
    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]

    resp = await member_client.patch(
        f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_reject_request(member_client: AsyncClient, eboard_client: AsyncClient):
    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]

    resp = await eboard_client.patch(
        f"/ops/v1/design-requests/{request_id}/review",
        json={"status": "rejected", "reviewer_note": "not on brand"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_approve_dispatches_agent(member_client: AsyncClient, eboard_client: AsyncClient, monkeypatch):
    calls = {}

    async def fake_dispatch(request_id, description):
        calls["request_id"] = request_id
        calls["description"] = description

    monkeypatch.setattr(github, "trigger_workflow_dispatch", fake_dispatch)

    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]

    resp = await eboard_client.patch(
        f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "agent_running"
    assert data["branch_name"] == f"design-request/{request_id}"
    assert calls["request_id"] == request_id


@pytest.mark.asyncio
async def test_approve_dispatch_failure_is_retryable(
    member_client: AsyncClient, eboard_client: AsyncClient, monkeypatch
):
    import httpx as httpx_module

    async def failing_dispatch(request_id, description):
        raise httpx_module.ConnectError("boom")

    monkeypatch.setattr(github, "trigger_workflow_dispatch", failing_dispatch)

    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]

    resp = await eboard_client.patch(
        f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"}
    )
    assert resp.status_code == 502

    check = await eboard_client.get(f"/ops/v1/design-requests/{request_id}")
    assert check.json()["status"] == "dispatch_failed"

    async def working_dispatch(request_id, description):
        return None

    monkeypatch.setattr(github, "trigger_workflow_dispatch", working_dispatch)
    retry = await eboard_client.post(f"/ops/v1/design-requests/{request_id}/retry-dispatch")
    assert retry.status_code == 200
    assert retry.json()["status"] == "agent_running"


@pytest.mark.asyncio
async def test_agent_callback_requires_secret(member_client: AsyncClient, eboard_client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "DESIGN_AGENT_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(github, "trigger_workflow_dispatch", lambda *a, **k: _noop())
    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]
    await eboard_client.patch(f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"})

    resp = await member_client.post(
        "/ops/v1/design-requests/webhook/agent-callback",
        json={"request_id": request_id, "outcome": "success"},
        headers={"X-Design-Agent-Secret": "wrong"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_agent_callback_success_opens_pr(
    member_client: AsyncClient, eboard_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "DESIGN_AGENT_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(github, "trigger_workflow_dispatch", lambda *a, **k: _noop())

    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]
    await eboard_client.patch(f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"})

    resp = await member_client.post(
        "/ops/v1/design-requests/webhook/agent-callback",
        json={
            "request_id": request_id,
            "outcome": "success",
            "branch_name": f"design-request/{request_id}",
            "pr_number": 42,
            "pr_url": "https://github.com/cornell-business-analytics/cba-ops/pull/42",
        },
        headers={"X-Design-Agent-Secret": "test-secret"},
    )
    assert resp.status_code == 200

    check = await eboard_client.get(f"/ops/v1/design-requests/{request_id}")
    data = check.json()
    assert data["status"] == "pr_open"
    assert data["pr_number"] == 42


@pytest.mark.asyncio
async def test_confirm_blocks_requester_confirming_own_request(eboard_client: AsyncClient, monkeypatch):
    """The eboard user both submits and approves here — confirm must still refuse
    since the confirmer is the same person as the requester."""
    monkeypatch.setattr(settings, "DESIGN_AGENT_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(github, "trigger_workflow_dispatch", lambda *a, **k: _noop())

    submit = await eboard_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]
    await eboard_client.patch(f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"})
    await eboard_client.post(
        "/ops/v1/design-requests/webhook/agent-callback",
        json={
            "request_id": request_id,
            "outcome": "success",
            "branch_name": f"design-request/{request_id}",
            "pr_number": 7,
            "pr_url": "https://github.com/cornell-business-analytics/cba-ops/pull/7",
        },
        headers={"X-Design-Agent-Secret": "test-secret"},
    )

    resp = await eboard_client.post(f"/ops/v1/design-requests/{request_id}/confirm")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_confirm_merges_when_different_user_and_ci_green(
    member_client: AsyncClient, eboard_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "DESIGN_AGENT_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(github, "trigger_workflow_dispatch", lambda *a, **k: _noop())

    submit = await member_client.post("/ops/v1/design-requests", json={"description": "x"})
    request_id = submit.json()["id"]
    await eboard_client.patch(f"/ops/v1/design-requests/{request_id}/review", json={"status": "approved"})
    branch_name = f"design-request/{request_id}"
    await eboard_client.post(
        "/ops/v1/design-requests/webhook/agent-callback",
        json={
            "request_id": request_id,
            "outcome": "success",
            "branch_name": branch_name,
            "pr_number": 7,
            "pr_url": "https://github.com/cornell-business-analytics/cba-ops/pull/7",
        },
        headers={"X-Design-Agent-Secret": "test-secret"},
    )

    async def fake_get_pr(pr_number):
        return {"head": {"ref": branch_name}}

    async def fake_check_status(ref):
        return "success"

    async def fake_merge_pr(pr_number, commit_message):
        return {"sha": "abc123"}

    monkeypatch.setattr(github, "get_pr", fake_get_pr)
    monkeypatch.setattr(github, "get_combined_check_status", fake_check_status)
    monkeypatch.setattr(github, "merge_pr", fake_merge_pr)

    resp = await eboard_client.post(f"/ops/v1/design-requests/{request_id}/confirm")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "merged"


@pytest.mark.asyncio
async def test_member_only_sees_own_requests(member_client: AsyncClient, eboard_client: AsyncClient):
    await member_client.post("/ops/v1/design-requests", json={"description": "mine"})
    await eboard_client.post("/ops/v1/design-requests", json={"description": "not mine"})

    resp = await member_client.get("/ops/v1/design-requests")
    assert resp.status_code == 200
    descriptions = [r["description"] for r in resp.json()]
    assert "mine" in descriptions
    assert "not mine" not in descriptions

    director_resp = await eboard_client.get("/ops/v1/design-requests")
    all_descriptions = [r["description"] for r in director_resp.json()]
    assert "mine" in all_descriptions
    assert "not mine" in all_descriptions


async def _noop():
    return None
