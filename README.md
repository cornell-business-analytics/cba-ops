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

## Current State (as of April 28, 2025)

### Done
- Full backend built: FastAPI, async SQLAlchemy, Alembic migrations, JWT (RS256), Google OAuth, CORS, R2 file storage config, Sentry, OpenTelemetry
- Ops tool frontend built: auth (NextAuth v5 + Google SSO), full recruitment pipeline UI, member directory, CMS page editor (block-based, drag-and-drop, draft/review/publish), events CRUD, shared types package
- Backend Dockerized and deploying to Railway (Postgres + Redis provisioned)
- Public website scaffolded (`apps/website`)

### Blocked / In Progress
- **Railway backend deployment crashing** — the backend is failing to start on Railway because pydantic-settings can't parse the `ALLOWED_ORIGINS` env var. The value set in Railway needs to be valid JSON, e.g. `["https://your-site.vercel.app"]` (square brackets, quoted strings). A code-side fix (`env_ignore_empty=True`) was also applied to handle the case where the var is left blank.

### Left To Do

**Deployment**
- Get Railway backend running (fix `ALLOWED_ORIGINS` format in Railway env vars)
- Generate Railway public domain on port `8000`
- Set RS256 key pair in Railway: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- Set Cloudflare R2 credentials in Railway: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- Deploy ops frontend (`apps/frontend`) to Vercel — root directory `apps/frontend`, env vars: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL`, `JWT_PUBLIC_KEY`
- Add production ops URL as an authorized redirect URI in Google OAuth console
- Update `NEXT_PUBLIC_API_URL` on the website Vercel project to the Railway backend URL

**Public website**
- Build out page templates that render the CMS blocks (hero, rich_text, cta, team_list, event_list, faq)
- Connect to backend API for live content

**Features still missing**
- File/image uploads (R2 integration in the CMS)
- FAQ block item editing (currently shows a placeholder)
- Analytics section in the ops tool
