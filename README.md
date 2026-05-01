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

## Current State (as of April 30, 2026)

### Done
- Full backend built: FastAPI, async SQLAlchemy, Alembic migrations, JWT (RS256), Google OAuth, CORS, R2 file storage config, Sentry, OpenTelemetry
- Ops tool frontend built: auth (NextAuth v5 + Google SSO), full recruitment pipeline UI, member directory, CMS page editor, events CRUD, shared types package
- Backend deployed to Railway (Postgres + Redis provisioned, migrations running on deploy)
- Ops tool deployed to Vercel, public website deployed to Vercel
- Google SSO working end-to-end — Cornell email enforcement on backend via tokeninfo API
- Recruitment process steps editable from the ops tool (stored in `site_settings`, ISR revalidation on save)
- Refresh token hashing switched from bcrypt to SHA-256 (bcrypt 72-byte limit incompatible with JWT-length tokens)

### Left To Do

**Data management (next up)**
- Eboard-level table management UI — see next steps below

**Public website**
- Build out page templates that render CMS blocks (hero, rich_text, cta, team_list, event_list, faq)
- Connect remaining pages to backend API

**Features still missing**
- File/image uploads (R2 integration in the CMS)
- FAQ block item editing (currently shows a placeholder)
- Analytics charts in the ops tool

---

## Next Steps — Eboard Data Management

Currently, changes like assigning user roles or creating cohorts require direct SQL access to Railway's Postgres. The goal is to bring this into the ops tool so eboard can manage it without touching the database.

**Is it possible?** Yes — the backend RBAC and API patterns are already in place. It's a matter of adding endpoints and UI pages for each table.

### Phase 1 — User & Role Management
The most urgent gap. Right now promoting a user requires a raw SQL `UPDATE`.

- `GET /ops/v1/users` — list all users with their current roles
- `PATCH /ops/v1/users/{id}/role` — update a user's role (eboard only)
- Ops tool page: `/members/users` — table of all users, inline role dropdown, save button

### Phase 2 — Cohort & Membership Management
Members can't appear on the team page until they have a membership record tied to a cohort.

- `POST /ops/v1/cohorts` — create a new semester cohort (eboard only)
- `POST /ops/v1/members` — add a membership (link a user to a cohort with a role title)
- Ops tool: cohort selector + "Add member" form that searches existing users by email

### Phase 3 — General Table Views (stretch)
A read-only or editable grid view of key tables (cohorts, memberships, sessions) so eboard has full visibility without needing Railway's Postgres console.
