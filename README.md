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
