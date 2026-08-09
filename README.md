# CBA Platform

Custom platform for [Cornell Business Analytics](https://cornellbusinessanalytics.org) — replacing the existing Wix site with a purpose-built public website and internal operations tool.

## What this is

This platform has two parts:

**Public website** (`apps/website`) — replaces cornellbusinessanalytics.org. Serves pages managed through the internal CMS: home, about, team directory, client work, recruitment info, and contact. On-demand revalidation. 

**Ops tool** (`apps/frontend`) — internal dashboard for club leadership. Covers:
- Recruitment pipeline (application cycles, candidate tracking, coffee chats, interviews)
- Member directory and profile management
- CMS for website content (block-based page editor, draft → review → publish workflow)
- Events management
- Analytics (recruitment data, member cohort)

## Stack

| Layer | Technology |
|---|---|
| Public site | Next.js 15 (App Router), Tailwind CSS |
| Ops tool | Next.js 15, shadcn/ui, TanStack Query, NextAuth v5 |
| API | FastAPI (Python), async SQLAlchemy 2.0, asyncpg |
| Database | PostgreSQL 16 |
| Auth | Google SSO (cornell.edu only) → backend RS256 JWT |
| File storage | Cloudflare R2 |
| Background jobs | RQ + Redis |
| Monorepo | pnpm workspaces + Turborepo |

## Apps & packages

```
apps/
  backend/    FastAPI API server
  frontend/   Internal ops tool (Next.js)
  website/    Public marketing site (Next.js, port 3001)
packages/
  types/      Shared TypeScript interfaces (@cba/types)
  ui/         Shared React components (@cba/ui)
  config/     Shared tsconfig and eslint config
```

## Local development

```bash
# Install dependencies
pnpm install

# Start all apps (website on :3001, frontend on :3000, backend on :8000)
pnpm dev

# Start a single app
pnpm --filter @cba/website dev
pnpm --filter @cba/frontend dev

# Backend (from apps/backend/)
uv run uvicorn app.main:app --reload

# Run database migrations
alembic upgrade head
```

You'll need a `.env.local` in each Next.js app and a `.env` in `apps/backend`. See `.env.example` in each directory for required variables.

## Docs

- [`docs/swe-concepts.md`](docs/swe-concepts.md) — engineering concepts used throughout the codebase (auth, migrations, async, RBAC, etc.)

## Dev Agent

A local CLI agent for development tasks — reads, searches, and edits the codebase using Claude Opus 4.8.

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python agent.py "your task or question"
```

See `agent.py` at the project root.

---

## Current State (as of August 9, 2026)

### Done
- Full backend built: FastAPI, async SQLAlchemy, Alembic migrations, JWT (RS256), Google OAuth, CORS, Sentry, OpenTelemetry
- Ops tool frontend built: auth (NextAuth v5 + Google SSO), member directory with role-aware edit/approval flow, CMS page editor, events CRUD, analytics dashboards, shared types package
- File/image uploads live: R2 proxy-upload endpoint (`/ops/v1/assets/upload`) backs member headshots and CMS block images — no more direct-URL-only headshots
- Coffee-chat recruitment funnel built end-to-end: Google Sheets applicant import (configurable per-cycle column mapping), member pairing, Gmail send, dedicated `recruitment` role with its own sidebar access
- Deliberation deck generator (`.pptx`, one slide per candidate with headshot + coffee chat + interview scores) shipped
- Backend deployed to Railway (Postgres + Redis provisioned, migrations running on deploy)
- Ops tool and public website deployed to Vercel
- Google SSO working end-to-end — Cornell email enforcement on backend via tokeninfo API
- Recruitment process steps editable from ops tool (stored in `site_settings`, ISR revalidation on save)
- Refresh token hashing switched from bcrypt to SHA-256 (bcrypt 72-byte limit incompatible with JWT-length tokens)
- Public website feature-complete: team directory (`/team`, `/team/[id]`), events, about, recruitment, contact, clients pages — live on the custom domain
- Individual member profile pages pre-built at deploy time via `generateStaticParams`, headshot fallback to initials
- Fixed a production crash from next-auth's `useSession()` hook by switching the ops tool to a custom server-fed React context (`session-context.tsx`)

### Left To Do

- Interview scoring UI — the formal application pipeline's schema and API (`POST /ops/v1/interview-scores`) are built and the deliberation deck already reads from them, but there's no frontend form to submit scores yet
- RQ/Redis background jobs are provisioned but unused — coffee-chat pairing emails currently send synchronously inline in the request handler; worth revisiting if email volume grows
- See `docs/architecture.md` for more detail on both of the above and how the system fits together
