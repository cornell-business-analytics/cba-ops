# CBA Ops — Agent Task Queue

Tasks are worked top-to-bottom. Mark each task `[x]` when complete and open a PR.
Each task should produce a single, focused PR.

---

## Format

```
- [ ] **Task title** — short description
  - Detail line (what to build, which files, what the acceptance criteria are)
```

---

## Priority Queue

### Task 1 — Email Allowlist + Admin Member Creation `[x]`

**Goal:** Only emails pre-approved by an admin can log in. Admins can add emails and create member records from the ops tool.

**Why this matters:** Right now any Cornell email can authenticate. We need to gate access so only club members can enter.

#### Backend

1. **New model** — `app/models/user.py`: add `AllowedEmail` class.
   - Fields: `id` (UUID PK), `email` (String 255, unique, indexed), `added_by_id` (UUID FK → users.id SET NULL), `created_at` (timestamp).

2. **Alembic migration** — `alembic/versions/0003_allowed_emails.py`.
   - Creates the `allowed_emails` table.

3. **Gate login** — in `app/modules/ops/auth.py`, `google_auth` endpoint:
   - After extracting `email` from Google payload, query `AllowedEmail` where `email == email`.
   - If no match, raise `HTTP 403` with detail `"This email has not been approved for access. Contact your eboard."`.
   - If match, continue with existing user create/update logic.

4. **New router** — `app/modules/ops/access.py` (register under `/access` prefix in `app/modules/ops/router.py`):
   - `GET /ops/v1/access/allowed-emails` — list all `AllowedEmail` rows, requires `eboard` role. Return list of `{id, email, added_by_id, created_at}`.
   - `POST /ops/v1/access/allowed-emails` — body `{email: str}`, requires `eboard` role. Create `AllowedEmail(email=email, added_by_id=current_user.id)`. Return 201 with created row. Return 409 if email already exists.
   - `DELETE /ops/v1/access/allowed-emails/{id}` — requires `eboard` role. Hard-delete row. Return 204.

5. **User role management** (from existing README TODO):
   - Add `PATCH /ops/v1/users/{id}/role` in `app/modules/ops/users.py` — body `{role: UserRole}`, requires `eboard`. Update `user.role` and return updated `UserPublic`.
   - Add `GET /ops/v1/users` (if not already) — list all users with roles, requires `pm` role.

6. **Cohort + membership creation** (from existing README TODO):
   - Add `POST /ops/v1/cohorts` in a new `app/modules/ops/cohorts.py` — body `{semester: str}`, requires `eboard`. Return 201.
   - Add `GET /ops/v1/cohorts` — list all cohorts, requires authenticated user.
   - Register cohorts router in `app/modules/ops/router.py`.
   - The existing `POST /ops/v1/members` already works — ensure it returns a 409 if `user_id` + `cohort_id` combination already exists.

#### Frontend (`apps/frontend`)

1. **New page: `/members/access`** — visible only to users with role `eboard`.
   - Tabs: "Allowed Emails" | "User Roles".
   - **Allowed Emails tab:**
     - Table: email, added date, remove button (calls `DELETE /allowed-emails/{id}`).
     - "Add Email" button → dialog with an email input field + submit. Calls `POST /allowed-emails`. On success, invalidate query and close dialog. Show error toast if email already exists (409).
   - **User Roles tab:**
     - Table: name, email, current role, role dropdown (`member` / `pm` / `director` / `eboard`), Save button per row. Calls `PATCH /users/{id}/role`.

2. **Nav guard** — the `/members/access` link in `components/Nav.tsx` should only appear when `session.user.role === "eboard"`. Route should also 403 non-eboard users client-side.

3. **Member creation UI** — on the existing `/members` page, add an "Add Member" button (visible to `director`+). Opens a dialog:
   - Fields: email (searches existing users from `GET /users`), cohort (dropdown from `GET /cohorts`), role_title (text), grad_year, major.
   - On submit, calls `POST /members`. Invalidate members query on success.

#### Acceptance criteria
- An email not in `allowed_emails` is rejected at login with a clear message.
- Eboard can add/remove emails from the ops tool without touching the DB.
- Eboard can change any user's role from the ops tool.
- Directors can add membership records for existing users.
- All new endpoints are covered by at least one happy-path test in `apps/backend/tests/`.

---

### Task 2 — Public Website: Render CMS Blocks `[x]`

**Goal:** The public website pages fetch and render the block-based content authored in the ops tool CMS.

- In `apps/website`, create page templates for each block type: `hero`, `rich_text`, `cta`, `team_list`, `event_list`, `faq`.
- Use the public web API (`GET /web/v1/pages/{slug}`) to fetch page data at build/request time.
- Hook up on-demand ISR revalidation (already wired on the backend via `site_settings`).
- Pages to connect: home, about, team directory, client work, recruitment info, contact.

---

### Task 3 — File/Image Uploads (R2) `[ ]`

**Goal:** Members and directors can upload headshots; CMS editors can attach images to blocks.

- Backend: implement `POST /ops/v1/assets/upload` — generates a presigned R2 PUT URL and returns it with the final public URL. Update `app/modules/ops/assets.py`.
- Frontend (ops tool): add an image picker to the membership profile editor and the CMS block editor. Upload directly to R2 via the presigned URL, then save the returned public URL to the record.
- Acceptance: headshot_url saved on a Membership record reflects the uploaded image.

---

### Task 4 — Analytics Charts `[ ]`

**Goal:** The `/analytics` page in the ops tool shows meaningful recruitment and member cohort data.

- Backend: `app/modules/ops/analytics.py` — add endpoints:
  - `GET /ops/v1/analytics/recruitment` — per-cycle stats: total applicants, offers, acceptance rate.
  - `GET /ops/v1/analytics/members` — cohort breakdown: member count per semester, role distribution.
- Frontend: render charts using `recharts` (already a common shadcn dependency). At minimum: a bar chart for recruitment funnel and a line/bar chart for member cohort growth.

---

### Task 5 — FAQ Block Item Editing `[ ]`

**Goal:** FAQ blocks in the CMS page editor are fully editable (currently shows a placeholder).

- In the CMS block editor (`apps/frontend`), implement the FAQ block editor: ordered list of `{question, answer}` pairs with add/remove/reorder controls.
- Backend already stores FAQ data as JSONB — no schema changes needed, just ensure the block schema accepts `{type: "faq", items: [{question, answer}]}`.

---

### Task 6 — Eboard Table View (Read-only) `[ ]`

**Goal:** Eboard can view raw table data (cohorts, memberships, sessions) without Railway console access.

- Add a `/data` page in the ops tool (eboard only) with tabs for each table.
- Read-only grid view using a simple HTML table or shadcn `DataTable`.
- Endpoints needed: cohorts list (Task 1 adds this), `GET /ops/v1/members` (exists), `GET /ops/v1/users` (exists).

---

---

## Design Polish Queue

A separate agent iterates through these. Each task is one PR. The goal is to make the UI feel like something built by designers for Cornell Business Analytics — not a generic internal tool template.

**Guiding principles for every change:**
- No two pages should open with the same heading pattern. Vary the layout.
- Subtext like "Overview of CBA operations" and "Search role, major…" is filler — remove or replace with something that actually informs.
- Avoid the AI 4-card-grid-with-colored-icon pattern unless there's a strong reason for it.
- Tables should have density and character — tight padding, sticky headers on long lists, subtle dividers.
- The sidebar and login page should feel like CBA's brand, not shadcn's defaults.
- Never break functionality. Only change appearance, layout, copy, and small interaction improvements.
- Keep using Tailwind + shadcn — improve within the system, don't replace it.
- Run `pnpm --filter @cba/frontend tsc --noEmit` before opening any PR to confirm no type errors.

### Design Task 1 — Sidebar & Login `[x]`

**Sidebar (`components/layout/Sidebar.tsx`):**
- The "CBA Ops" wordmark in the header area is plain. Add a small monogram or logo mark (e.g., a `CBA` badge in a distinct color, or a subtle Cornell red `#B31B1B` accent). Don't use a generic icon.
- Nav items are functional but have no visual rhythm. Try giving the active item a left border accent instead of (or in addition to) the background highlight.
- The sign-out button at the bottom is indistinguishable from nav links. Give it a slightly different treatment — maybe destructive-tinted on hover.

**Login page (`app/login/page.tsx`):**
- Centered white card on white background is invisible. Add a subtle background — either a light gray (`bg-muted`), a diagonal stripe pattern via CSS, or a left-panel split layout with CBA branding on the left and the sign-in card on the right.
- The "CBA Ops" h1 and "Cornell Business Analytics internal platform" copy is generic. Make the login feel like an entry point, not a placeholder.
- The `@cornell.edu accounts only` footer text is fine but lonely. Consider grouping it with a small CBA wordmark.

### Design Task 2 — Dashboard `[ ]`

**File:** `app/(app)/dashboard/page.tsx`

Current problems:
- The 4-stat-card grid (Total Members / Active Candidates / Published Pages / Events This Semester) is the single most recognizable AI-generated UI pattern. Replace or restructure it.
- "Overview of CBA operations" is meaningless filler.
- "Quick links" is filler. Every item is already in the sidebar.

What to build instead:
- Replace the 4-card grid with a two-column layout: left side shows a compact stat summary as a simple list (e.g., `32 active members · 8 candidates · 3 published pages`) — right side shows upcoming events or recent recruitment activity.
- Remove the "Quick links" section entirely — the sidebar already serves this purpose.
- Give the page a real header that means something, e.g., show the current semester ("Spring 2026 — Operations Dashboard") and the logged-in user's name.
- The page should feel like an at-a-glance summary, not a collection of cards.

### Design Task 3 — Recruitment Page `[ ]`

**File:** `app/(app)/recruitment/page.tsx`

Current problems:
- The page header ("Recruitment" + count) is identical in structure to every other page.
- The table is functional but plain — same `rounded-lg border bg-white` wrapper as members, events, etc.
- Status badges are the only visual differentiation between rows.
- "Search by name, email, netid…" is a standard placeholder.

What to improve:
- The header area should show more context: cycle name prominently, dates if available, a pipeline progress indicator (e.g., a small horizontal bar or list showing how many candidates are at each stage).
- The table can stay but should feel tighter and more purposeful. Consider grouping rows by status or adding a subtle left-border color per status.
- The inline status dropdown works but feels clunky in a table. Consider moving status changes to the detail page (`/recruitment/[id]`) and making the table row show a cleaner read-only badge.
- Search placeholder: "Search candidates…" is enough.

### Design Task 4 — Members Page `[ ]`

**File:** `app/(app)/members/page.tsx`

Current problems:
- Same header pattern as every other page.
- Table shows role_title, major, grad_year, status — but no name. Name is the most important field.
- "View →" link is visually weak.

What to improve:
- Add name (and email) as the first column — fetch from the user relationship or augment the `MembershipPublic` type if needed.
- Show a cohort filter if cohorts exist.
- The member rows could have an avatar initial (first letter of name in a colored circle) to add visual identity.
- Make "View →" a proper button or replace with a row click handler.

### Design Task 5 — Events Page `[ ]`

**File:** `app/(app)/events/page.tsx`

- Review the current page and apply the same principle: remove the generic header template, make the layout reflect the content type (events are time-based — a calendar-adjacent layout or date-grouped list would be more natural than a flat table).
- If events have a date field, group by upcoming vs past.

### Design Task 6 — Global: Eliminate Repeated Header Template `[ ]`

**Scope:** all `app/(app)/*/page.tsx` files

Every page uses this exact pattern:
```tsx
<div className="p-6 space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold">PageTitle</h1>
      <p className="text-sm text-muted-foreground">Generic subtext</p>
    </div>
  </div>
```

Extract a `<PageHeader>` component to `components/layout/PageHeader.tsx` that accepts `title`, optional `subtitle`, and optional `action` slot — but also make each page customize it meaningfully rather than just passing generic subtext. This is a refactor + copy improvement in one pass.

---

## Completed

_(none yet)_
