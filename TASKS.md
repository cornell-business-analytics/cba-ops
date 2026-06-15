# CBA Ops — Agent Task Queue

Tasks are worked top-to-bottom. Mark each task `[x]` when complete and open a PR.
Each task should produce a single, focused PR.

---

## Priority Queue

### Task 4 — Team Page on Public Website `[x]`

**Goal:** Build the `/team` page on `apps/website` displaying member profiles with headshots and full profile info. Wire up headshot uploads via R2 in the ops tool.

#### Backend
1. Add `linkedin_url` field (String 500, nullable) to `Membership` in `app/models/membership.py`. Add Alembic migration `0004_membership_linkedin.py`.
2. Update `MembershipPublic` and `MembershipDetail` schemas in `app/schemas/member.py` to include `linkedin_url`.
3. Implement `POST /ops/v1/assets/upload` in `app/modules/ops/assets.py` — accepts `content_type` and `filename`, requires authenticated user, returns `{upload_url, public_url}` using a presigned R2 PUT URL (expires 15 min). Use R2 config already in `app/core/config.py`.
4. Add public endpoint `GET /web/v1/members` (no auth) in `app/modules/web/router.py` — returns active members for the current cohort: name, role_title, headshot_url, major, grad_year, hometown, campus_involvements, professional_experience, interests, email, linkedin_url.

#### Frontend — Ops Tool (`apps/frontend`)
5. On `app/(app)/members/[id]/page.tsx`: headshot upload button → file picker → presigned URL → PUT to R2 → PATCH membership with public_url.
6. Add `linkedin_url` field to the member edit form.

#### Frontend — Public Website (`apps/website`)
7. Create `app/team/page.tsx`. Fetch from `GET /web/v1/members`.
   - Match the existing website design language exactly — do NOT copy the ops tool style.
   - Each member shows: headshot, name, role_title, major + grad_year, hometown, campus_involvements, professional_experience, interests, email, LinkedIn link.
   - Group by role hierarchy: eboard → directors → PMs → analysts.

---

### Task 5 — FAQ Block Item Editing `[x]`

**Goal:** FAQ blocks in the CMS page editor are fully editable (currently a placeholder).

- Implement FAQ block editor in `apps/frontend`: ordered list of `{question, answer}` pairs with add/remove/reorder controls.
- Backend already stores as JSONB — no schema changes needed.

---

### Task 6 — Analytics Charts `[ ]`

**Goal:** The `/analytics` page in the ops tool shows meaningful recruitment and cohort data.

- `GET /ops/v1/analytics/recruitment` — per-cycle stats: total applicants, offers, acceptance rate.
- `GET /ops/v1/analytics/members` — cohort breakdown: member count per semester, role distribution.
- Frontend: bar chart for recruitment funnel, line/bar chart for cohort growth. Use `recharts`.

---

### Task 7 — Eboard Table View (Read-only) `[ ]`

**Goal:** Eboard can view raw table data without Railway console access.

- Add a `/data` page in the ops tool (eboard only) with tabs for cohorts, memberships, users.
- Read-only grid view using shadcn `DataTable`.

---

## Design Polish Queue

A separate agent iterates through these. Each task is one PR. Goal: UI that feels crafted for Cornell Business Analytics, not generated from a template.

**Guiding principles:**
- No two pages should share the same header layout. Vary the structure.
- Remove generic filler subtext — replace with something informative or remove entirely.
- Avoid the 4-card-grid-with-colored-icon pattern.
- Tables: tighter padding, better column hierarchy, sticky headers on long lists.
- Never break functionality. Appearance and copy only.
- Stay within Tailwind + shadcn. No new UI libraries.
- Run `pnpm --filter @cba/frontend tsc --noEmit` before every PR.

### Design Task 3 — Recruitment Page `[x]`

**File:** `app/(app)/recruitment/page.tsx`

- Header should show cycle name prominently and a pipeline progress indicator (how many candidates at each stage).
- Consider grouping table rows by status or adding a subtle left-border color per status.
- Move inline status dropdowns to the detail page; show clean read-only badges in the table.

### Design Task 4 — Members Page `[x]`

**File:** `app/(app)/members/page.tsx`

- Add name as the first column — it's currently missing.
- Add a cohort filter dropdown.
- Add avatar initials (colored circle with first letter) to each row.
- Replace "View →" with a proper button or row click handler.

### Design Task 5 — Events Page `[x]`

**File:** `app/(app)/events/page.tsx`

- Remove generic header template.
- Group events by upcoming vs past based on date field.
- A date-grouped list is more natural than a flat table for time-based content.

### Design Task 6 — Global: Eliminate Repeated Header Template `[x]`

**Scope:** all `app/(app)/*/page.tsx` files

Extract a `<PageHeader>` component to `components/layout/PageHeader.tsx` with `title`, optional `subtitle`, and optional `action` slot. Make each page pass something meaningful, not generic filler.

### Design Task 7 — Ops Tool: Green & White + CBA Logo `[x]`

**Goal:** Two changes in one PR — swap all blue accents to CBA green, and replace the plain "CBA Ops" text in the sidebar with the real CBA logo.

#### Color: Blue → Green
- `tailwind.config.ts` — update color tokens to green. Use `#1a7a3c` as primary, `#15692f` for hover/active states.
- `app/globals.css` (or equivalent CSS variables file) — update `--primary`, `--ring`, and any sidebar CSS variables currently resolving to blue shades.
- Grep for all hardcoded `text-blue-*`, `bg-blue-*`, `border-blue-*` Tailwind classes across `apps/frontend` and replace with green equivalents.
- The sidebar active item border accent (from Design Task 1) should use `#1a7a3c`.
- Dashboard icon colors: replace any blue variants with green.
- **Do not change** layout, spacing, typography, or component structure. Color only.

#### Logo: Use the CBA logo from the website
- The website uses `apps/website/public/logo.png` (32×32) as its logo — copy it to `apps/frontend/public/logo.png`.
- In `components/layout/Sidebar.tsx`, replace the plain `<span>CBA Ops</span>` wordmark with:
  - The `logo.png` image using Next.js `<Image>` component (width=28, height=28)
  - Followed by the text "CBA Ops" in the same font weight as before
  - Match the pattern the website uses in its Nav: logo mark + text side by side
- The result should feel like the same brand carried into the internal tool.

Run `pnpm --filter @cba/frontend tsc --noEmit` before pushing.

### Design Task 8 — Website: AI-Pattern Audit & Polish `[x]`

**Goal:** Review `apps/website` for AI-generated patterns and make subtle improvements. Nothing drastic.

**How to audit:**
1. Read all page files in `apps/website/app/`.
2. `curl` the live site (check `vercel.json` for URL, or try `cornellbusinessanalytics.org`).
3. Look for: symmetrical card grids, generic hero copy, identical section spacing, no visual hierarchy.

**What to fix:**
- Replace generic hero/section copy with something specific to CBA.
- Break purely decorative card grids — vary sizes or convert to a list.
- Improve typographic hierarchy where all sections look identical.
- Do NOT change color palette, remove sections, or restructure nav.
- One focused PR. Run `pnpm --filter @cba/website tsc --noEmit` before pushing.

---

## Completed

- Task 1 — Email Allowlist + Admin Member Creation
- Task 2 — Public Website: Render CMS Blocks
- Task 3 — File/Image Uploads (R2)
- Design Task 1 — Sidebar & Login
- Design Task 2 — Dashboard
