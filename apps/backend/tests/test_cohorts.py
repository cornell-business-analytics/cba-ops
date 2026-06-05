import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_cohorts_empty(eboard_client: AsyncClient):
    resp = await eboard_client.get("/ops/v1/cohorts")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_cohort(eboard_client: AsyncClient):
    resp = await eboard_client.post("/ops/v1/cohorts", json={"semester": "FA26"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["semester"] == "FA26"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_cohort_duplicate(eboard_client: AsyncClient):
    await eboard_client.post("/ops/v1/cohorts", json={"semester": "SP27"})
    resp = await eboard_client.post("/ops/v1/cohorts", json={"semester": "SP27"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_cohorts_after_create(eboard_client: AsyncClient):
    await eboard_client.post("/ops/v1/cohorts", json={"semester": "FA27"})
    resp = await eboard_client.get("/ops/v1/cohorts")
    assert resp.status_code == 200
    semesters = [c["semester"] for c in resp.json()]
    assert "FA27" in semesters
