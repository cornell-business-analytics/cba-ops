# CBA Ops — Agent Task Queue

Tasks are worked top-to-bottom. Mark each task `[x]` when complete and open a PR.
Each task should produce a single, focused PR.

---

## Priority Queue

### Task 4b — Individual Member Pages + Missing Profile Fields `[x]`

**Goal:** Complete the team feature. The agent marked Task 4 done but two things are missing: (1) individual member pages on the website, and (2) `name` and `email` are not in the ops tool edit form.

#### Part 1 — Ops Tool: Add name + email to edit form + fix permissions

**File:** `apps/frontend/app/(app)/members/[id]/page.tsx`

The `EDIT_FIELDS` array currently includes role_title, major, grad_year, hometown, linkedin_url, campus_involvements, professional_experience, interests, bio. Add:
- `{ key: "name", label: "Name" }` — insert as the first item in the array
- `{ key: "email", label: "Email" }` — insert after name

The `ProfileFields` type must also include `name: string` and `email: string`.

The PATCH request payload already forwards whatever is in the form — no backend changes needed.

**Also fix the permission check.** Currently only `UserRole.director` and above can directly edit profiles. The Social Director has `role_title = "Social Director"` but may only hold `UserRole.pm`. Update the `canDirectEdit` logic to also allow editing when the current user's `membership.role_title` (fetched from `/ops/v1/members/me` or the existing `currentUser` hook — check what's available) contains "Social Director" (case-insensitive check). The final rule: `canDirectEdit = isDirectorOrAbove || currentUser.role_title?.toLowerCase().includes("social director")`.

Also add `role_title` to the `CurrentUser` type in the frontend if it isn't already there, and ensure it's returned by whichever endpoint powers `useCurrentUser`.

#### Part 2 — Backend: Add GET /web/v1/members/{id} endpoint

**File:** `apps/backend/app/modules/web/router.py`

Add a new route:
```
GET /web/v1/members/{member_id}
```
- `member_id` matches `user.id` (the id returned by `GET /web/v1/members`).
- Returns a single `MemberPublic` or 404 if not found / not active.
- No auth required.

#### Part 3 — Website: Individual member pages

**File to create:** `apps/website/app/team/[id]/page.tsx`

- Use `generateStaticParams` — fetch all members from `GET /web/v1/members`, return `{ id }` for each.
- In the page, fetch the individual member via `GET /web/v1/members/{id}` (add `getMember(id)` to `apps/website/lib/api.ts`).
- If member not found, call `notFound()`.
- Match the website's existing design language: `cba-green`, `cba-dark`, `container-section`, same font/spacing as other website pages. Do NOT use ops tool styles.
- Layout:
  - Left column (or top on mobile): headshot image (use `<img>` or Next.js `<Image>`). If no headshot, show a large initials circle.
  - Right column: all profile fields displayed as labeled sections.
  - Fields to show: name, role_title, email, major, grad_year, hometown, campus_involvements, professional_experience, interests.
  - LinkedIn URL: show a LinkedIn icon (inline SVG or lucide `Linkedin` icon) as a clickable link. Only render if `linkedin_url` is set.
  - Back link to `/team` at the top.
- Add `export const revalidate = 3600` for ISR.

**Also update:** `apps/website/components/sections/MemberCard.tsx` (or wherever the card is defined in TeamGrid) — wrap the card in a `<Link href={/team/${member.id}}>` so clicking it navigates to the individual page.

#### Acceptance criteria
- `name` and `email` fields appear as editable inputs in the ops tool member profile page.
- `GET /web/v1/members/{id}` returns a single member or 404.
- `/team/[id]` page renders all profile fields correctly.
- LinkedIn icon shows only when `linkedin_url` is set and links to it.
- Member cards on `/team` are clickable and navigate to their individual page.
- `pnpm --filter @cba/website tsc --noEmit` passes.
- `pnpm --filter @cba/frontend tsc --noEmit` passes.

---

## Completed

All Priority Queue tasks complete as of 2026-07-22. Waiting for new tasks.

- Task 1 — Email Allowlist + Admin Member Creation
- Task 2 — Public Website: Render CMS Blocks
- Task 3 — File/Image Uploads (R2)
- Task 4 — Team Page on Public Website (index page, backend endpoint, ops tool headshot upload)
- Task 4b — Individual Member Pages + Missing Profile Fields
- Task 5 — FAQ Block Item Editing
- Task 6 — Analytics Charts
- Design Task 1 — Sidebar & Login
- Design Task 2 — Dashboard
- Design Task 3 — Recruitment Page
- Design Task 4 — Members Page
- Design Task 5 — Events Page
- Design Task 6 — Global PageHeader
- Design Task 7 — Green & White + CBA Logo
- Design Task 8 — Website AI-Pattern Audit
