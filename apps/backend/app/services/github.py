"""Thin GitHub REST API client used by the design-request feature to dispatch
the agent workflow and, later, merge/close the PR it opens.
"""
import httpx

from app.core.config import settings

GITHUB_API = "https://api.github.com"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _repo_path(suffix: str) -> str:
    return f"{GITHUB_API}/repos/{settings.GITHUB_REPO_OWNER}/{settings.GITHUB_REPO_NAME}{suffix}"


async def trigger_workflow_dispatch(request_id: str, description: str) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _repo_path(f"/actions/workflows/{settings.GITHUB_WORKFLOW_FILE}/dispatches"),
            headers=_headers(),
            json={
                "ref": "main",
                "inputs": {"request_id": request_id, "description": description},
            },
        )
        resp.raise_for_status()


async def get_pr(pr_number: int) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(_repo_path(f"/pulls/{pr_number}"), headers=_headers())
        resp.raise_for_status()
        return resp.json()


async def merge_pr(pr_number: int, commit_message: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.put(
            _repo_path(f"/pulls/{pr_number}/merge"),
            headers=_headers(),
            json={"commit_message": commit_message, "merge_method": "squash"},
        )
        resp.raise_for_status()
        return resp.json()


async def close_pr(pr_number: int) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.patch(
            _repo_path(f"/pulls/{pr_number}"),
            headers=_headers(),
            json={"state": "closed"},
        )
        resp.raise_for_status()


async def get_combined_check_status(ref: str) -> str | None:
    """Returns 'success' | 'failure' | 'pending' | None (no checks reported yet)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            _repo_path(f"/commits/{ref}/status"),
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("state") if data.get("total_count", 0) > 0 else None


async def get_latest_deployment_url(ref: str) -> str | None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        deployments_resp = await client.get(
            _repo_path("/deployments"),
            headers=_headers(),
            params={"ref": ref, "per_page": 1},
        )
        deployments_resp.raise_for_status()
        deployments = deployments_resp.json()
        if not deployments:
            return None

        statuses_resp = await client.get(
            _repo_path(f"/deployments/{deployments[0]['id']}/statuses"),
            headers=_headers(),
            params={"per_page": 1},
        )
        statuses_resp.raise_for_status()
        statuses = statuses_resp.json()
        if not statuses:
            return None
        return statuses[0].get("environment_url")
