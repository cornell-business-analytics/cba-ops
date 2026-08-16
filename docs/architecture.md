# Architecture

## System overview

Three deployable apps share one Postgres database through a single FastAPI backend. There is no direct database access from either frontend — both talk to the backend over HTTP.

```
                    ┌─────────────────┐
   Public visitors →│  apps/website    │  Next.js 15, :3001
                    │  (Vercel)        │  reads /web/v1 (public, unauthenticated)
                    └────────┬─────────┘
                             │ fetch (ISR, tag-based cache)
                             ▼
                    ┌─────────────────┐        ┌──────────────┐
                    │  apps/backend    │←──────→│  Postgres 16  │
   Club leadership →│  (Railway)       │        └──────────────┘
                    │  FastAPI         │        ┌──────────────┐
                    └────────┬─────────┘←──────→│  Redis        │ (provisioned, not
                             │ /ops/v1 (auth'd)  └──────────────┘  actively used — see below)
                             ▼                   ┌──────────────┐
                    ┌─────────────────┐          │  Cloudflare   │
   Club leadership →│  apps/frontend   │─────────│  R2 (assets)  │
                    │  (Vercel)        │          └──────────────┘
                    │  Next.js 15      │
                    └─────────────────┘
```

`apps/e2e` (Playwright) drives `apps/frontend` and `apps/website` in CI; it isn't deployed.

## Backend: `web` vs `ops` split

`apps/backend/app/main.py` mounts exactly two routers, and the split is the main organizing principle of the backend:

- **`/web/v1`** (`app/modules/web/router.py`) — public, unauthenticated, read-only. Everything `apps/website` fetches: members, events, pages, recruitment-steps copy. Small and deliberately thin.
- **`/ops/v1`** (`app/modules/ops/router.py`) — everything `apps/frontend` uses, authenticated via bearer JWT. It's an umbrella router that includes one sub-router per domain:

  | Sub-router | Domain |
  |---|---|
  | `auth.py` | Google token exchange, refresh, logout |
  | `users.py` / `access.py` | user records, allowed-email admin |
  | `cohorts.py` / `members.py` | semester cohorts, membership profile CRUD, edit-request approval |
  | `candidates.py` / `cycles.py` | formal application pipeline — candidates, interview rounds/sessions/scores (see below) |
  | `recruitment.py` | coffee-chat funnel — Sheets import, pairing, Gmail send (see below) |
  | `delib.py` | deliberation deck (.pptx) generator |
  | `pages.py` | CMS page/block CRUD |
  | `events.py` | events CRUD |
  | `assets.py` | R2 file upload |
  | `analytics.py` | recruitment/member dashboards |
  | `settings.py` | key-value `site_settings` (e.g. recruitment process copy shown on the public site) |

  `require_role(min_role)` (`app/modules/ops/deps.py`) gates each endpoint against the role hierarchy below.

Domain models live one-file-per-aggregate under `app/models/` (note: `org.py` defines `Event`, not an "org" model — misleading filename, not misleading content). Pydantic request/response schemas are separate, under `app/schemas/`; keep them in sync with `@cba/types` (`packages/types/src`) whenever an API shape changes, since nothing enforces that automatically.

**Dead scaffolding, don't confuse with the real thing:** `app/models/modules/{ops,web}/router.py` are unused leftovers from the initial commit — not imported by `main.py`. `app/models/permission.py` and `app/jobs/`, `app/workers/` are placeholder files (see "Background jobs" below).

## Auth: Google SSO → backend RS256 JWT

Only the ops tool has auth; the website has none.

1. `apps/frontend/auth.ts` (NextAuth v5) runs Google OAuth restricted to `hd: cornell.edu` (a UI hint only, not enforcement).
2. On first sign-in, NextAuth's `jwt` callback POSTs the Google `id_token` to `POST /ops/v1/auth/google`. The backend verifies it via **Google's tokeninfo endpoint** (not local JWKS verification — see `app/core/security.py::verify_google_id_token`; local verification breaks on the `at_hash` claim when only the id_token is available), checks the email against `allowed_emails`, upserts a `User` keyed on `google_sub` (stable even if email changes), and returns an RS256 access + refresh token pair.
3. The refresh token is stored server-side only as a hash (`UserSession.refresh_token_hash`); each use rotates it (old one revoked, new one issued) so a stolen-and-reused token is detectable.
4. The frontend decodes the `role` claim client-side and stores `{ accessToken, refreshToken, role }` in the NextAuth session (refreshed 5 minutes before the backend's 1-hour expiry).
5. Client components read the session through `apps/frontend/hooks/session-context.tsx` (`useAppSession`), a plain React context fed by the server-rendered session — **not** next-auth's `useSession()` hook, which crashed in production (fixed in commits `d167aed`/`b5542dd`). `useApi()` wraps `lib/api.ts`'s client with the session's `accessToken`.

Role hierarchy (`app/modules/ops/deps.py::ROLE_ORDER`), numeric so `require_role(X)` allows X and anything above it:

```
member (0) < pm (1) < director (2) < recruitment (3) < eboard (4)
```

`recruitment` sits between `director` and `eboard` — it's a lateral grant for the recruitment chair, not a step everyone passes through. Membership-level `role_title` (free-text, e.g. "Social Director") is a separate concept from `UserRole` and is sometimes special-cased in permission checks in the frontend (e.g. Social Director gets director-level profile-edit rights despite holding `UserRole.pm`) — don't assume `UserRole` alone gates every action.

## CMS and ISR revalidation

Website pages are rows in `pages` (`slug`, `status: draft|review|published`, `blocks: JSONB`) — an ordered list of typed blocks (hero, rich text, CTA, team list, project list, event list, FAQ, contact). Blocks are edited as a whole document in the ops tool (`apps/frontend/app/(app)/website/`) and rendered on the site by `apps/website/components/blocks/BlockRenderer.tsx` dispatching per type. JSONB was chosen over a normalized `blocks` table because blocks are always read/written together with their page — see `docs/swe-concepts.md` §4 for the reasoning.

Publishing a page from the ops tool triggers on-demand ISR: the backend POSTs to `apps/website`'s `/api/revalidate` with a shared `REVALIDATE_SECRET`, tagged to that page's cache tag (`page-{slug}`), so only that page re-renders. `apps/website/lib/api.ts` is the sole point of contact with the backend from the website, and every fetch function there falls back to hardcoded data in `lib/placeholder-data.ts` if the backend call fails — the public site must never hard-fail just because the backend is briefly down.

## AI design-agent (member-requested website changes)

Members can request a website design change from the ops tool; a director-and-up user
(director/recruitment/eboard) approves it; an AI coding agent (Claude Code) makes the
change and opens a PR; a director-and-up user — who may be the same person who approved
it — confirms after reviewing the Vercel preview, which merges the PR and ships it.

- **Model**: `DesignRequest` (`app/models/design_request.py`), status machine `pending →
  approved → agent_running → pr_open → merged` with `rejected`/`dispatch_failed`/
  `agent_failed`/`merge_failed`/`discarded` off-ramps. Endpoints in
  `app/modules/ops/design_requests.py`.
- **Where the agent actually runs**: not on Railway. Approving a request calls
  `app/services/github.py::trigger_workflow_dispatch`, which fires
  `.github/workflows/design-agent.yml` on GitHub's own runners — deliberately kept off
  the live API container. The agent authenticates with a personal Claude Pro/Max
  subscription (`CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token`), not a metered
  `ANTHROPIC_API_KEY` — see `docs/handover.md` for what that means for continuity.
- **Scope guardrail**: the agent may only touch `apps/website/`. Enforced two ways — a
  checked-in `.claude/settings.json` (copied at runtime from
  `.github/design-agent/claude-settings.json`) restricting its tools, and, authoritatively,
  a `git diff --name-only` check in the workflow that fails the job if anything outside
  `apps/website/` changed, before any push happens.
- **Preview**: no custom render pipeline — the agent's PR gets Vercel's existing
  automatic PR-preview deployment for free, same as any other PR. This repo has *two*
  Vercel projects (`cba-website` and `cba-ops-frontend`), both of which deploy a preview
  on every PR — the backend has to specifically pick out the `apps/website` one. The
  backend polls the commit's combined status for CI state, then parses the `vercel[bot]`
  PR comment's embedded per-project metadata (`app/services/github.py::_get_website_preview_url`)
  for the actual live preview URL, since the commit status's own `target_url` only points
  at Vercel's internal inspector page. Surfaced via `GET /ops/v1/design-requests/{id}/status`.
- **Push identity matters**: the workflow explicitly does *not* use the default
  `secrets.GITHUB_TOKEN` for its push/PR — GitHub doesn't fire downstream
  `pull_request`-triggered workflows (including `ci.yml`) for pushes made with that
  token. It uses a separate `cba-ops-bot` PAT (`GITHUB_PAT_AGENT`) instead, so the
  agent's PR gets the same lint/typecheck/test gate as any human's PR.
- **Confirm requires a different person than the requester** — enforced server-side in
  `confirm_design_request`, not just in the UI — so a director can't submit, approve,
  and merge their own request unreviewed.

## Recruitment: two separate subsystems

These look like one feature but are backed by different models and different backend modules — worth keeping straight:

1. **Coffee-chat funnel** (`app/models/recruitment.py`: `RecruitmentCycle`, `CoffeeChatApplicant`, `GmailToken`; backend module `recruitment.py`). Applicants are pulled from a **Google Sheet** the recruitment chair connects per cycle (column mapping is configurable and stored per-cycle), deduplicated on `netid + timestamp`, then paired with members and emailed directly through the **Gmail API** using a club Gmail OAuth token. This is the "sign up for a coffee chat" front door — informal, high volume.
2. **Formal application pipeline** (`app/models/candidate.py`: `ApplicationCycle`, `Candidate`, `InterviewRound` → `InterviewCategory`/`InterviewSession`, `InterviewScore`, and a *separate* `CoffeeChat` model linked to `Candidate` rather than to a sheet row; backend modules `candidates.py`, `cycles.py`). This models the structured funnel: applied → coffee_chat → interviewing → offer/accepted/rejected/withdrawn, with configurable interview rounds (numeric 0–5 or Y/M/N scoring) per cycle.

`delib.py` generates a per-cycle deliberation deck (.pptx, one slide per candidate with headshot + coffee chat + interview scores) from the *formal* pipeline's data — so the scoring data model and the reporting side are both built. What's **not** built is a frontend form to actually submit `POST /ops/v1/interview-scores`; scores currently have to be entered some other way (e.g. directly, or not at all) before a deck can be generated meaningfully. If you're asked to "finish interview scoring," this is the gap — the API and schema already exist.

## File storage

`apps/backend/app/modules/ops/assets.py` proxies uploads through the backend to Cloudflare R2 (S3-compatible API via `boto3`): the client sends multipart form data to `POST /ops/v1/assets/upload`, the backend validates content-type/size (10 MB cap) and streams it to R2 under `uploads/{user_id}/{uuid}.{ext}`, returning a public CDN URL. This is a proxy-upload pattern, not presigned-URL direct upload — every file passes through the backend process. Used for member headshots and CMS block images (see `BlockForm.tsx`).

## Background jobs — provisioned but not wired up

`RQ` and `Redis` are in the dependency list and Redis is provisioned in both Railway and `infra/docker-compose.yml`, but `app/jobs/email.py` and `app/workers/worker.py` are placeholder files — nothing enqueues anything today. Coffee-chat pairing emails are sent **synchronously**, inline in the `POST` request handler in `recruitment.py`, directly against the Gmail API. If email volume or latency ever becomes a problem, that's the code to move onto the (currently unused) RQ worker rather than assuming a queue is already in the loop.

## Deployment

- `apps/frontend` and `apps/website` deploy to Vercel as separate projects (own env vars, own build). Turborepo's `env` allowlist in `turbo.json` must list any env var a Next.js build reads — anything missing there is silently stripped even if set in Vercel, and `auth.ts`'s `BACKEND_URL` falls back to `localhost:8000` (a common source of "auth silently fails in prod, no backend logs" — see `docs/swe-concepts.md` §31).
- `apps/backend` deploys to Railway (`apps/backend/railway.toml`), with Postgres and Redis provisioned there; Alembic migrations run on deploy.
- CORS (`ALLOWED_ORIGINS` in `app/core/config.py`) only matters for the browser-originated calls the *website* makes to `/web/v1`. The ops tool's backend calls happen server-side inside NextAuth's `jwt` callback (Vercel server → Railway), which is never subject to CORS.
- Observability: Sentry (both backend and, per `pnpm.onlyBuiltDependencies` in `package.json`, likely the frontends too) and OpenTelemetry (FastAPI + SQLAlchemy instrumentation) are wired into the backend (`app/core/logging.py`, `app/core/middleware.py`).

## Monorepo mechanics

pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) + Turborepo (`turbo.json`). `@cba/types` and `@cba/ui` resolve to local packages, not npm, for `apps/frontend` and `apps/website`. The Python backend is outside the JS workspace graph entirely — its own `pyproject.toml`, dependency management via `uv`, no Turborepo caching.
