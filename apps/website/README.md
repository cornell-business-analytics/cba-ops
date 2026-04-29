# @cba/website

Public-facing marketing website for Cornell Business Analytics, built with Next.js 15 and Tailwind CSS.

## Pages

- `/` — Homepage with hero, mission statement, and three pillar sections
- `/about` — Organization overview
- `/team` — Current members
- `/clients` — Past and current clients
- `/recruitment` — Recruitment process and upcoming events
- `/contact` — Contact form

## Development

```bash
# From the repo root
make dev-website

# Or directly
pnpm --filter @cba/website dev
```

Runs on `http://localhost:3001`.

## Tech

- **Next.js 15** (App Router)
- **Tailwind CSS**
- **Sentry** for error monitoring
- Shares types and UI components from `@cba/types` and `@cba/ui`

## Environment

Copy `.env.local.example` to `.env.local` and fill in values:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
REVALIDATE_SECRET=...
```
