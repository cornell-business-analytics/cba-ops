import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_allowed_emails_empty(eboard_client: AsyncClient):
    resp = await eboard_client.get("/ops/v1/access/allowed-emails")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_allowed_email(eboard_client: AsyncClient):
    resp = await eboard_client.post(
        "/ops/v1/access/allowed-emails", json={"email": "newmember@cornell.edu"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newmember@cornell.edu"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_allowed_email_duplicate(eboard_client: AsyncClient):
    await eboard_client.post(
        "/ops/v1/access/allowed-emails", json={"email": "dup@cornell.edu"}
    )
    resp = await eboard_client.post(
        "/ops/v1/access/allowed-emails", json={"email": "dup@cornell.edu"}
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_allowed_email(eboard_client: AsyncClient):
    create = await eboard_client.post(
        "/ops/v1/access/allowed-emails", json={"email": "delete@cornell.edu"}
    )
    entry_id = create.json()["id"]

    resp = await eboard_client.delete(f"/ops/v1/access/allowed-emails/{entry_id}")
    assert resp.status_code == 204

    list_resp = await eboard_client.get("/ops/v1/access/allowed-emails")
    assert all(e["id"] != entry_id for e in list_resp.json())


@pytest.mark.asyncio
async def test_allowed_emails_requires_eboard(member_client: AsyncClient):
    resp = await member_client.get("/ops/v1/access/allowed-emails")
    assert resp.status_code == 403
