"""Thin GitHub REST API client used by the design-request feature to dispatch
the agent workflow and, later, merge/close the PR it opens.
"""
import os
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


async def trigger_workflow_dispatch(
    request_id: str,
    description: str,
    attachment_url: str | None = None,
    target_path: str | None = None,
) -> None:
    inputs: dict = {"request_id": request_id, "description": description}
    if attachment_url:
        inputs["attachment_url"] = attachment_url
    if target_path:
        inputs["target_path"] = target_path
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _repo_path(f"/actions/workflows/{settings.GITHUB_WORKFLOW_FILE}/dispatches"),
            headers=_headers(),
            json={"ref": "main", "inputs": inputs},
        )
        resp.raise_for_status()


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"}
_WEBSITE_PUBLIC_PREFIX = "apps/website/public/"


async def list_website_images() -> list[str]:
    """Returns paths relative to apps/website/public/ for all image files in the repo."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            _repo_path("/git/trees/main"),
            headers=_headers(),
            params={"recursive": "1"},
        )
        resp.raise_for_status()
        tree = resp.json().get("tree", [])

    results = []
    for item in tree:
        if item.get("type") != "blob":
            continue
        path: str = item.get("path", "")
        if not path.startswith(_WEBSITE_PUBLIC_PREFIX):
            continue
        ext = os.path.splitext(path)[1].lower()
        if ext in _IMAGE_EXTS:
            results.append(path[len(_WEBSITE_PUBLIC_PREFIX):])
    return sorted(results)


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
