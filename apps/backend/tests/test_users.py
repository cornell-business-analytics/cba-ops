import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_users_requires_pm(member_client: AsyncClient):
    resp = await member_client.get("/ops/v1/users")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_role_requires_eboard(member_client: AsyncClient):
    import uuid
    resp = await member_client.patch(
        f"/ops/v1/users/{uuid.uuid4()}/role", json={"role": "pm"}
    )
    assert resp.status_code == 403
