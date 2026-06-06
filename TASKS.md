# CBA Ops — Agent Task Queue

  Tasks are worked top-to-bottom. Mark each task `[x]` when complete and open a PR.
  Each task should produce a single, focused PR.

  ---

  ## Format

  - [ ] Task title — short description
    - Detail line (what to build, which files, what the acceptance criteria are)

  ---

  ## Priority Queue

  ### Task 1 — Email Allowlist + Admin Member Creation `[x]`

  **Goal:** Only emails pre-approved by an admin can log in. Admins can add emails and create member records from the
  ops tool.

  **Why this matters:** Right now any Cornell email can authenticate. We need to gate access so only club members can
  enter.

  #### Backend

  1. **New model** — `app/models/user.py`: add `AllowedEmail` class.
     - Fields: `id` (UUID PK), `email` (String 255, unique, indexed), `added_by_id` (UUID FK → users.id SET NULL),
  `created_at` (timestamp).

  2. **Alembic migration** — `alembic/versions/0003_allowed_emails.py`.
     - Creates the `allowed_emails` table.

  3. **Gate login** — in `app/modules/ops/auth.py`, `google_auth` endpoint:
     - After extracting `email` from Google payload, query `AllowedEmail` where `email == email`.
     - If no match, raise `HTTP 403` with detail `"This email has not been approved for access. Contact your eboard."`.
     - If match, continue with existing user create/update logic.

  4. **New router** — `app/modules/ops/access.py`:
     - `GET /ops/v1/access/allowed-emails` — list all rows, requires `eboard` role.
     - `POST /ops/v1/access/allowed-emails` — body `{email: str}`, requires `eboard`. Return 409 if already exists.
     - `DELETE /ops/v1/access/allowed-emails/{id}` — requires `eboard`. Return 204.

  5. **User role management:**
     - `PATCH /ops/v1/users/{id}/role` — body `{role: UserRole}`, requires `eboard`.
     - `GET /ops/v1/users` — list all users with roles, requires `pm`.

  6. **Cohort + membership creation:**
     - `POST /ops/v1/cohorts` — body `{semester: str}`, requires `eboard`. Return 201.
     - `GET /ops/v1/cohorts` — list all cohorts, requires authenticated user.

  #### Frontend (`apps/frontend`)
  
  1. **New page: `/members/access`** — eboard only. Tabs: "Allowed Emails" | "User Roles".
  2. **Member creation UI** — "Add Member" button on `/members` (director+), opens dialog with email, cohort,
  role_title, grad_year, major fields.

  #### Acceptance criteria
  - Non-allowlisted email is rejected at login with a clear message.
  - Eboard can add/remove emails and change user roles from the ops tool.
  - Directors can add membership records for existing users.

  ---

  ### Task 2 — Public Website: Render CMS Blocks `[x]`

  **Goal:** The public website pages fetch and render the block-based content authored in the ops tool CMS.

  - Create page templates for each block type: `hero`, `rich_text`, `cta`, `team_list`, `event_list`, `faq`.
  - Use `GET /web/v1/pages/{slug}` to fetch page data at build/request time with ISR revalidation.
  - Pages to connect: home, about, team directory, client work, recruitment info, contact.

  ---

  ### Task 3 — File/Image Uploads (R2) `[ ]`

  **Goal:** Members and directors can upload headshots; CMS editors can attach images to blocks.

  - Backend: implement `POST /ops/v1/assets/upload` — generates a presigned R2 PUT URL and returns `{upload_url,
  public_url}`. Update `app/modules/ops/assets.py`.
  - Frontend (ops tool): image picker on membership profile editor and CMS block editor. Upload directly to R2 via
  presigned URL, then save the public URL to the record.

  ---
  
  ### Task 4 — Team Page on Public Website `[ ]`

  **Goal:** Build the `/team` page on `apps/website` displaying member profiles with headshots and full profile info.
  Wire up headshot uploads via R2 in the ops tool.

  #### Backend
  1. Add `linkedin_url` field (String 500, nullable) to `Membership` in `app/models/membership.py`. Add Alembic
  migration `0004_membership_linkedin.py`.
  2. Update `MembershipPublic` and `MembershipDetail` schemas in `app/schemas/member.py` to include `linkedin_url`.
  3. Implement `POST /ops/v1/assets/upload` in `app/modules/ops/assets.py`:
     - Accepts `content_type` and `filename`, requires authenticated user.
     - Returns `{upload_url, public_url}` using presigned R2 PUT URL (expires 15 min).
  4. Add public endpoint `GET /web/v1/members` (no auth) — returns active members for current cohort with: name,
  role_title, headshot_url, major, grad_year, hometown, campus_involvements, professional_experience, interests, email,
  linkedin_url.

  #### Frontend — Ops Tool (`apps/frontend`)
  5. On `app/(app)/members/[id]/page.tsx`, add headshot upload: file picker → presigned URL → PUT to R2 → PATCH
  membership with public_url.
  6. Add `linkedin_url` field to the member edit form.

  #### Frontend — Public Website (`apps/website`)
  7. Create `app/team/page.tsx`. Fetch from `GET /web/v1/members`.
     - Match the existing website's design language exactly — do NOT copy the ops tool style.
     - Each member shows: headshot, name, role_title, major + grad_year, hometown, campus_involvements,
  professional_experience, interests, email, LinkedIn link.
     - Group by role hierarchy: eboard → directors → PMs → analysts.

  ---


  ### Task 5 — FAQ Block Item Editing `[ ]`

  **Goal:** FAQ blocks in the CMS page editor are fully editable (currently a placeholder).

  - Implement FAQ block editor: ordered list of `{question, answer}` pairs with add/remove/reorder controls.
  - Backend already stores as JSONB — no schema changes needed.

  ---

  ### Task 7 — Eboard Table View (Read-only) `[ ]`

  **Goal:** Eboard can view raw table data without Railway console access.

  - Add a `/data` page in the ops tool (eboard only) with tabs for cohorts, memberships, users.
  - Read-only grid view using shadcn `DataTable`.

  ---

  ## Design Polish Queue

  A separate agent iterates through these. Each task is one PR. Goal: UI that feels crafted for Cornell Business
  Analytics, not generated from a template.

  **Guiding principles:**
  - No two pages should share the same header layout. Vary the structure.
  - Remove generic filler subtext — replace with something informative or remove entirely.
  - Avoid the 4-card-grid-with-colored-icon pattern.
  - Tables: tighter padding, better column hierarchy, sticky headers on long lists.
  - Never break functionality. Appearance and copy only.
  - Stay within Tailwind + shadcn. No new UI libraries.
  - Run `pnpm --filter @cba/frontend tsc --noEmit` before every PR.

  ### Design Task 1 — Sidebar & Login `[x]`
  
  Done — sidebar has Cornell red left-border accent on active item, login has split-panel layout.

  ### Design Task 2 — Dashboard `[x]`

  **File:** `app/(app)/dashboard/page.tsx`
  
  - Replace the 4-stat-card grid with a two-column layout: compact stat summary on left, upcoming events or recent
  recruitment activity on right.
  - Remove the "Quick links" section — the sidebar already covers this.
  - Give the header real context: show current semester and logged-in user's name.

  ### Design Task 3 — Recruitment Page `[ ]`

  **File:** `app/(app)/recruitment/page.tsx`

  - Header should show cycle name prominently and a pipeline progress indicator (how many candidates at each stage).
  - Consider grouping table rows by status or adding a subtle left-border color per status.
  - Move inline status dropdowns to the detail page; show clean read-only badges in the table.

  ### Design Task 4 — Members Page `[ ]`

  **File:** `app/(app)/members/page.tsx`
  
  - Add name as the first column — it's currently missing.
  - Add a cohort filter dropdown.
  - Add avatar initials (colored circle with first letter) to each row.
  - Replace "View →" with a proper button or row click handler.

  ### Design Task 5 — Events Page `[ ]`

  **File:** `app/(app)/events/page.tsx`

  - Remove generic header template.
  - Group events by upcoming vs past based on date field.
  - A date-grouped list is more natural than a flat table for time-based content.

  ### Design Task 6 — Global: Eliminate Repeated Header Template `[ ]`

  **Scope:** all `app/(app)/*/page.tsx` files
  
  Extract a `<PageHeader>` component to `components/layout/PageHeader.tsx` with `title`, optional `subtitle`, and
  optional `action` slot. Make each page pass something meaningful, not generic filler.

  ### Design Task 7 — Ops Tool: Green & White Color Scheme `[ ]`

  **Goal:** Swap all blue accents to CBA green throughout the ops tool.

  - `tailwind.config.ts` — update color tokens to green. Use `#1a7a3c` as primary, `#15692f` for hover/active.
  - `app/globals.css` — update `--primary`, `--ring`, and sidebar CSS variables from blue to green.
  - Replace all hardcoded `text-blue-*`, `bg-blue-*`, `border-blue-*` classes with green equivalents.
  - Sidebar active border accent (Design Task 1) should be `#1a7a3c`, not red.
  - Dashboard icon colors: replace blue variants with green.

  **Do not change:** layout, spacing, typography, or component structure. Color only.

  ### Design Task 8 — Website: AI-Pattern Audit & Polish `[ ]`

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
