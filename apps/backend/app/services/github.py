"""Thin GitHub REST API client used by the design-request feature to dispatch
the agent workflow and, later, merge/close the PR it opens.
"""
import asyncio
import base64
import json
import os
import re
from urllib.parse import urlencode

import httpx

from app.core import cache
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
    is_revision: bool = False,
    revision_note: str | None = None,
) -> None:
    inputs: dict = {
        "request_id": request_id,
        "description": description,
        "is_revision": "true" if is_revision else "false",
        "attachment_url": attachment_url or "",
        "target_path": target_path or "",
        "revision_note": revision_note or "",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _repo_path(f"/actions/workflows/{settings.GITHUB_WORKFLOW_FILE}/dispatches"),
            headers=_headers(),
            json={"ref": "main", "inputs": inputs},
        )
        resp.raise_for_status()


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"}
_WEBSITE_PUBLIC_PREFIX = "apps/website/public/"


_IMAGES_CACHE_KEY = "github:website_images"
_IMAGES_CACHE_TTL = 600  # 10 minutes — refreshes naturally after deploys


async def list_website_images() -> list[str]:
    """Returns paths relative to apps/website/public/ for all image files in the repo."""
    cached = await cache.get_json(_IMAGES_CACHE_KEY)
    if cached is not None:
        return cached

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
    results = sorted(results)

    await cache.set_json(_IMAGES_CACHE_KEY, results, ttl=_IMAGES_CACHE_TTL)
    return results


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


_VERCEL_COMMENT_RE = re.compile(r"\[vc\]: #[^:\s]+:(\S+)")


def _with_protection_bypass(preview_url: str) -> str:
    """Append Vercel's automation-bypass params to a preview URL.

    Preview deployments are gated by Vercel Authentication, which redirects
    anyone without a Vercel account that has access to the project to a login
    wall. Reviewers here are club directors, not Vercel users, so the "Preview"
    link in the ops tool was unusable for exactly the people meant to click it.

    `x-vercel-protection-bypass` authenticates the request and
    `x-vercel-set-bypass-cookie=true` makes Vercel set a cookie on the response,
    so clicking around inside the preview keeps working instead of only the
    first request going through.

    Note this puts the bypass secret in a URL handed to every authenticated ops
    user, which is the intended audience but does mean the secret is only as
    private as ops-tool access. Rotate it in the Vercel dashboard if someone
    leaves; it grants nothing beyond viewing preview deployments.

    Returns the URL unchanged when no secret is configured — the link then
    behaves as it did before rather than breaking.
    """
    if not settings.VERCEL_PROTECTION_BYPASS_SECRET:
        return preview_url

    query = urlencode({
        "x-vercel-protection-bypass": settings.VERCEL_PROTECTION_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true",
    })
    separator = "&" if "?" in preview_url else "?"
    return f"{preview_url}{separator}{query}"


async def _get_website_preview_url(pr_number: int) -> str | None:
    """The commit status Vercel posts (context 'Vercel – cba-website') has its
    target_url pointing at Vercel's internal inspector/dashboard page, not the
    live deployed site — and this repo also deploys a second, unrelated
    'cba-ops-frontend' preview on every PR. The actual live preview URL, keyed
    by project, only exists in the vercel[bot] PR comment's embedded metadata
    (a base64 JSON blob after a `[vc]: #<hash>:` marker), so that's what we
    parse here, matching on rootDirectory == "apps/website" specifically.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(_repo_path(f"/issues/{pr_number}/comments"), headers=_headers())
        resp.raise_for_status()
        comments = resp.json()

    for comment in reversed(comments):
        if comment.get("user", {}).get("login") != "vercel[bot]":
            continue
        match = _VERCEL_COMMENT_RE.search(comment.get("body", ""))
        if not match:
            continue
        try:
            payload = json.loads(base64.b64decode(match.group(1)))
        except (ValueError, UnicodeDecodeError):
            continue
        for project in payload.get("projects", []):
            if project.get("rootDirectory") == "apps/website" and project.get("previewUrl"):
                return _with_protection_bypass(f"https://{project['previewUrl']}")

    return None


# Check-run conclusions that should not block a merge. Anything else
# (failure, timed_out, action_required, cancelled, stale) is treated as failing.
_PASSING_CONCLUSIONS = {"success", "neutral", "skipped"}


async def _collect_checks(ref: str) -> dict[str, str]:
    """Returns {check name: 'success' | 'failure' | 'pending'} for `ref`.

    Reads BOTH of GitHub's check APIs, because they are disjoint and each holds
    half the picture:

      - `/commits/{ref}/status` returns legacy commit statuses. Vercel posts
        here; GitHub Actions never does.
      - `/commits/{ref}/check-runs` returns check runs. GitHub Actions posts
        here.

    Reading only the first — which is what this module used to do — meant CI
    results were structurally invisible to the merge gate.
    """
    checks: dict[str, str] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        status_resp, runs_resp = await asyncio.gather(
            client.get(_repo_path(f"/commits/{ref}/status"), headers=_headers()),
            client.get(
                _repo_path(f"/commits/{ref}/check-runs"),
                headers=_headers(),
                params={"per_page": 100, "filter": "latest"},
            ),
        )
    status_resp.raise_for_status()
    runs_resp.raise_for_status()

    for status in status_resp.json().get("statuses", []):
        state = status.get("state")
        checks[status.get("context", "")] = (
            "success" if state == "success" else "pending" if state == "pending" else "failure"
        )

    for run in runs_resp.json().get("check_runs", []):
        if run.get("status") != "completed":
            checks[run.get("name", "")] = "pending"
        else:
            checks[run.get("name", "")] = (
                "success" if run.get("conclusion") in _PASSING_CONCLUSIONS else "failure"
            )

    return checks


def _aggregate(checks: dict[str, str]) -> str | None:
    """Collapses individual check results into one gate status.

    Returns 'missing_checks' when a required check did not report at all — the
    failure mode that let unvalidated design requests merge for months while the
    CI workflow sat disabled. Absence has to fail closed; treating "no result"
    as "no objection" is how this broke in the first place.
    """
    required = settings.required_ci_checks
    missing = [name for name in required if name not in checks]
    if missing:
        return "missing_checks"

    # Once required checks are accounted for, any failing check blocks the merge
    # — including Vercel's, since a broken preview deploy is worth stopping on.
    relevant = checks.values()
    if not checks:
        return None
    if "failure" in relevant:
        return "failure"
    if "pending" in relevant:
        return "pending"
    return "success"


async def get_combined_check_status(ref: str, pr_number: int | None = None) -> tuple[str | None, str | None]:
    """Returns (ci_status, preview_url).

    ci_status: 'success' | 'failure' | 'pending' | 'missing_checks' | None.
    'missing_checks' means a check named in REQUIRED_CI_CHECKS never reported —
    treat it as "do not merge", not as "still waiting".

    preview_url: the live apps/website Vercel preview URL (see
    _get_website_preview_url), or None if pr_number wasn't supplied or no
    matching vercel[bot] comment exists yet.
    """
    cache_key = f"github:check_status:{ref}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached[0], cached[1]

    ci_status = _aggregate(await _collect_checks(ref))
    preview_url = await _get_website_preview_url(pr_number) if pr_number else None

    # Cache longer once checks are done — pending state can change quickly.
    # missing_checks is cached briefly too: a workflow that has been re-enabled
    # but not yet reported should stop being reported as missing promptly.
    ttl = 120 if ci_status in ("success", "failure") else 20
    await cache.set_json(cache_key, [ci_status, preview_url], ttl=ttl)

    return ci_status, preview_url
