# SWE Concepts from Building CBA Platform

Everything here is grounded in actual code you wrote. Each section explains the concept, then shows exactly where it appears.

---

## 1. Relational Database Fundamentals

### What a relational database actually is

A relational database stores data in **tables** (rows and columns). The "relational" part means tables can reference each other using **foreign keys** — a column in one table that points to a row in another table.

Postgres is what you're running. It enforces these references at the database level, meaning if you try to delete a parent row that has children pointing to it, Postgres will refuse (unless you told it what to do via `ondelete`).

### Primary Key

Every table has a **primary key** — a column that uniquely identifies each row. You're using UUIDs everywhere:

```python
# app/db/base.py
class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
```

UUID vs auto-incrementing integer:
- **Integer IDs** are simple (`1`, `2`, `3`) but expose information (how many users you have, predictable URLs)
- **UUIDs** are random 128-bit values — safe to expose in URLs, can be generated client-side without a DB round-trip

### Foreign Key

A **foreign key** is a column that references the primary key of another table. It enforces referential integrity — you can't have an orphaned row that points to a non-existent parent.

```python
# app/models/membership.py
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

This says: `memberships.user_id` must match a real `users.id`. If you delete the user, all their memberships are deleted too (`CASCADE`).

**ondelete options:**
| Value | Behavior when parent is deleted |
|---|---|
| `CASCADE` | Delete all child rows |
| `SET NULL` | Set the FK column to NULL |
| `RESTRICT` | Raise an error (default) |

---

## 2. Relationship Types

### One-to-Many (the most common)

One parent row has many child rows.

**Examples in your schema:**
- One `User` → many `Membership` (user can be a member across multiple semesters)
- One `ApplicationCycle` → many `Candidate` (many applicants per cycle)
- One `InterviewRound` → many `InterviewSession` (multiple time slots per round)
- One `Candidate` → many `CoffeeChat` (up to 3 chats per candidate)

In SQLAlchemy, you declare this with `relationship()` on both sides:

```python
# Parent side (User)
memberships: Mapped[list["Membership"]] = relationship(back_populates="user")

# Child side (Membership)
user: Mapped["User"] = relationship(back_populates="memberships")
```

In the actual database, only the **child table** has the foreign key column. The parent table has no idea how many children exist — that information lives in the children.

### One-to-One

One parent row has exactly one child row.

**Examples in your schema:**
- One `Candidate` → one `CandidateDIData` (each candidate has at most one D&I record)

```python
# On the Candidate model
di_data: Mapped["CandidateDIData | None"] = relationship(back_populates="candidate", uselist=False)
```

The `uselist=False` tells SQLAlchemy to return a single object instead of a list. The FK lives on `candidate_di_data.candidate_id`, which also has a `unique=True` constraint — that's what enforces the "one" part.

### Many-to-Many

Two tables where each row in A can relate to many rows in B, and vice versa. Requires a **join table** (also called a junction or association table).

**Examples in your schema:**
- `InterviewSession` ↔ `User` (members): a session has multiple assigned members, a member can be assigned to multiple sessions → `interview_assignments` is the join table
- `InterviewScore` is similar — it sits at the intersection of `session`, `candidate`, `member`, and `category`

```
interview_sessions ─┐
                    ├─→ interview_assignments ←─┐
users ──────────────┘                           └─ (join table)
```

The join table has FKs to both sides. You can add extra columns to it (like timestamps, or a `role` field) — that's called an **association object pattern**.

---

## 3. Indexes

An index is a data structure Postgres maintains alongside a table so it can find rows fast without scanning every row.

**Without an index:** finding all candidates with `status = 'interviewing'` reads every row in the table.  
**With an index:** jumps directly to matching rows via a B-tree lookup.

Indexes cost write performance and disk space. You add them on columns you'll frequently filter or join on.

In your models, indexes are declared on FK columns (because you always join through them) and frequently queried columns:

```python
email: Mapped[str] = mapped_column(String(255), unique=True, index=True)   # queried by email on login
status: Mapped[CandidateStatus] = mapped_column(Enum(CandidateStatus), index=True)  # filter by status
user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey(...), index=True)  # join column
```

`unique=True` implicitly creates an index. So `google_sub` being unique means it's also indexed — fast lookup during login.

---

## 4. JSONB (Postgres-specific)

**JSONB** is a Postgres column type that stores arbitrary JSON, but in a binary format that's indexable and queryable.

You use it in three places:

```python
blocks: Mapped[list] = mapped_column(JSONB, default=list)       # Page CMS content
college: Mapped[list] = mapped_column(JSONB, default=list)      # Candidate multi-select
changes: Mapped[dict] = mapped_column(JSONB, nullable=False)    # ProfileEditRequest diff
```

**Why JSONB instead of a separate table?**  
For `blocks` on pages: blocks are always fetched together with the page, never queried individually. A separate `blocks` table would add joins for no benefit. JSONB lets you store structured but schema-flexible data where the shape can change (new block types) without migrations.

**When NOT to use JSONB:**  
Don't put data in JSONB that you need to query/filter on. For example, if you needed to find all candidates from a specific college, you'd want that in a normalized table. JSONB works when the data is opaque to the database.

---

## 5. Enums

Enums define a fixed set of allowed values. Both Postgres and Python enforce them.

```python
# Python side
class CandidateStatus(str, enum.Enum):
    applied = "applied"
    coffee_chat = "coffee_chat"
    interviewing = "interviewing"
    offer = "offer"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"

# DB side (in migration)
sa.Enum('applied', 'coffee_chat', 'interviewing', ..., name='candidatestatus')
```

`str, enum.Enum` means the enum values ARE strings — `CandidateStatus.applied == "applied"` is true. This makes serialization to JSON seamless.

**Why use enums vs a plain string column?**  
The DB will reject any value not in the enum. You can't accidentally insert `"Interviewing"` (wrong case) or `"pending"` (wrong value). It's a contract enforced at the lowest level.

---

## 6. Database Transactions

A **transaction** is a unit of work. Either all operations in a transaction succeed, or none of them do. This is the **A** in ACID (Atomicity, Consistency, Isolation, Durability).

In your `get_db` dependency:

```python
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()   # all DB writes in this request are saved
        except Exception:
            await session.rollback()  # undo everything if any step failed
            raise
```

**Practical example:** When a user signs in for the first time, you upsert the `User` AND create a `UserSession` in one transaction. If creating the session fails, the user record is also rolled back — you never end up with a half-created user.

**`flush()` vs `commit()`:**
- `flush()` sends SQL to the DB but doesn't commit — the transaction is still open. Use it when you need the generated ID (from auto-increment or default) before the transaction ends.
- `commit()` finalizes the transaction. After this, other connections can see the changes.

```python
# In auth.py — need user.id before creating the session
db.add(user)
await db.flush()   # user.id is now populated
session = UserSession(user_id=user.id, ...)
db.add(session)
await db.commit()  # both saved atomically
```

---

## 7. Migrations (Alembic)

Migrations are version-controlled changes to your database schema. Think of them like git commits, but for your DB structure.

**Why you need them:**  
Your models (Python) describe what the DB *should* look like. Alembic writes SQL that transforms the DB from its current state to the new state. Without migrations, you'd have to manually run `ALTER TABLE` statements and hope you don't miss anything.

Your migration file (`0001_initial.py`) creates all tables from scratch. Future migrations will add columns, rename things, add indexes, etc.

**The workflow:**
```bash
# After changing a model:
alembic revision --autogenerate -m "add phone_number to users"
# Review the generated migration file
alembic upgrade head   # apply to DB
```

**Why table order matters in migrations:**  
You can't create a table with a FK before its parent table exists. Your migration creates tables in this order:
```
users → user_sessions
      → cohorts → projects → memberships
application_cycles → candidates → candidate_di_data
                               → coffee_chats
```

---

## 8. SQLAlchemy ORM — Key Patterns

### Lazy loading vs eager loading

By default, SQLAlchemy uses **lazy loading**: accessing `membership.user` after a query fires a *second* SQL query to fetch the user. In synchronous code this is fine. In async code it breaks — you can't await a lazy load implicitly.

**Solution: `selectinload`**

```python
# In the web router — loads all memberships, THEN fires one more query
# to load all related users and cohorts in bulk
result = await db.execute(
    select(Membership)
    .options(selectinload(Membership.user), selectinload(Membership.cohort))
)
```

`selectinload` generates: `SELECT * FROM users WHERE id IN (id1, id2, id3, ...)` — one query for all the related objects instead of N+1 queries.

**N+1 problem:** If you load 100 memberships and then access `.user` on each, you fire 101 queries (1 for memberships + 100 for users). `selectinload` collapses those 100 into 1.

### `back_populates`

`back_populates` keeps both sides of a relationship in sync. If you do `user.memberships.append(m)`, then `m.user` automatically points back to that user. It's a Python-level sync, not a DB constraint.

### `mapped_column` and `Mapped`

SQLAlchemy 2.0 uses type annotations to define columns:

```python
name: Mapped[str] = mapped_column(String(255), nullable=False)
bio: Mapped[str | None] = mapped_column(Text, nullable=True)
```

`Mapped[str]` tells both SQLAlchemy AND Python type checkers that this is a string. `Mapped[str | None]` means it can be null. This is purely a type hint — the actual nullability is set by `nullable=` in `mapped_column`.

---

## 9. Pydantic — Data Validation Layer

Pydantic is a separate library from SQLAlchemy. It validates data coming in (requests) and shapes data going out (responses).

**The separation:**

```
HTTP Request JSON → Pydantic schema validates → SQLAlchemy model → Postgres
Postgres → SQLAlchemy model → Pydantic schema serializes → HTTP Response JSON
```

These are completely different classes that happen to represent similar data. The SQLAlchemy model is the DB shape. The Pydantic schema is the API shape.

**`from_attributes = True`**

```python
class MemberPublic(BaseModel):
    model_config = {"from_attributes": True}
```

Without this, Pydantic only reads from dicts. With it, Pydantic reads from ORM objects directly — `MemberPublic.model_validate(membership_orm_object)` works.

**Why have separate schemas?**  
The ORM model has everything: passwords, internal flags, foreign key columns, relationship objects. The Pydantic schema exposes only what the API should return. `User` has `google_sub` (internal). `UserPublic` doesn't.

---

## 10. FastAPI Dependency Injection

FastAPI's `Depends()` system builds a dependency graph that's resolved before each request.

```python
@router.get("/candidates")
async def list_candidates(
    _: User = Depends(require_role(UserRole.pm)),  # auth check
    db: AsyncSession = Depends(get_db),             # DB session
):
    ...
```

FastAPI calls `get_db()` and `require_role(UserRole.pm)` automatically, injects the results as arguments, and cleans up afterward (closing the DB session).

**`require_role` is a factory** — it returns a dependency function:

```python
def require_role(min_role: UserRole):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if ROLE_ORDER[user.role] < ROLE_ORDER[min_role]:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _check
```

`require_role(UserRole.pm)` returns `_check`, which itself depends on `get_current_user`. FastAPI resolves the chain automatically.

**Why dependency injection over global state?**  
Each request gets its own DB session. If you used a global session, two concurrent requests would share state and corrupt each other's transactions.

---

## 11. JWT Authentication

### How JWT works

A **JSON Web Token** is a signed string with three parts: `header.payload.signature`.

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZXhwIjoxNzAwMDAwfQ.SIGNATURE
      header                          payload                         signature
```

The server signs the payload with a private key. Anyone with the public key can verify the signature — but only the server with the private key can create valid tokens.

**You're using RS256** (RSA + SHA-256):
- Private key: used to sign tokens (kept secret on the server)
- Public key: used to verify tokens (can be shared publicly)

**HS256** (HMAC) uses one shared secret for both signing and verifying — simpler, but every service that needs to verify tokens must know the secret.

### Access token + refresh token

| | Access Token | Refresh Token |
|---|---|---|
| Lifetime | 1 hour | 30 days |
| Stored | Memory / JS variable | Secure storage |
| Used for | Every API request | Getting a new access token |
| If leaked | Expires in 1h | Can be revoked in DB |

**Why two tokens?**  
If access tokens lasted 30 days, a leaked token would be valid for a month. If they lasted 1 hour, users would have to log in every hour. Refresh tokens solve this: short-lived access tokens + long-lived refresh tokens that can be revoked.

**Token rotation** (what you implemented):
When a refresh token is used, it's immediately revoked and a new one is issued. If an attacker steals a refresh token and uses it first, the real user's next refresh fails — a signal that the token was compromised.

### bcrypt for refresh token storage

You don't store the raw refresh token in the DB. If your DB was leaked, attackers couldn't use those tokens. Instead:

```python
session = UserSession(refresh_token_hash=hash_token(raw_refresh))
```

`hash_token` uses bcrypt — a slow hashing algorithm intentionally designed to be expensive to brute-force. When verifying, you rehash the incoming token and compare.

---

## 12. Google OAuth / OIDC

When a user clicks "Sign in with Google":
1. Google's JS SDK runs in the browser and authenticates the user
2. Google returns an **`id_token`** — a JWT signed by Google's private key
3. Your frontend sends that `id_token` to `POST /ops/v1/auth/google`
4. Your backend fetches Google's public keys (JWKS) and verifies the signature
5. The `hd` (hosted domain) claim is checked — only `@cornell.edu` allowed
6. Your backend upserts a `User` record and issues its own JWT pair

The `google_sub` field is Google's unique identifier for that user — it never changes even if they change their email. That's why you upsert on `google_sub`, not email.

---

## 13. Async / Await

Python is single-threaded. Normally, when your code waits for a DB query (network I/O), the entire thread is blocked doing nothing.

**Async** lets the runtime switch to handling other requests while waiting for I/O:

```python
# This doesn't block the thread — while Postgres is processing,
# FastAPI can handle other incoming requests
result = await db.execute(select(User).where(...))
```

**asyncpg** is a Postgres driver built for async from the ground up. It's why your DB URLs start with `postgresql+asyncpg://`.

The tradeoff: async code is more complex (everything in the call chain must be async). That's why lazy-loading ORM relationships break — SQLAlchemy can't implicitly `await` a DB call inside a property access.

---

## 14. Connection Pooling

Opening a new database connection for every request is expensive (TCP handshake, auth, etc.). A **connection pool** maintains a set of open connections and reuses them.

```python
# app/db/session.py
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,       # keep 10 connections open at all times
    max_overflow=20,    # allow up to 20 extra under high load
    pool_pre_ping=True, # test connections before use (handles stale connections)
)
```

At 10 pool_size + 20 overflow = 30 max concurrent DB operations. Each FastAPI request grabs a connection, uses it, and returns it to the pool.

---

## 15. CORS

**Cross-Origin Resource Sharing** — browsers block JavaScript from making requests to a different domain unless the server explicitly allows it.

Your frontend at `localhost:3001` making a request to your API at `localhost:8000` is a cross-origin request. Without CORS headers, the browser refuses it.

```python
# app/core/config.py
ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
```

In production, this would be `["https://ops.cornellbusinessanalytics.org"]`. The backend adds `Access-Control-Allow-Origin` headers to responses, and the browser allows the request through.

---

## 16. Presigned URLs (R2 / S3)

Uploading files through your backend wastes bandwidth — the file travels to your server and then to storage. **Presigned URLs** let the client upload directly to R2:

```
Client → POST /assets/upload-url → Backend generates a signed R2 URL
Client → PUT file bytes → R2 directly (bypasses your server)
Client → PATCH /members/{id} { headshot_url: "https://cdn/.../file.jpg" }
```

The presigned URL is time-limited (5 minutes) and scoped to exactly one key. R2 verifies the signature — no one can upload to arbitrary paths with it.

This is the standard pattern for any file upload to object storage (S3, R2, GCS).

---

## 17. ISR Revalidation

Your website (`apps/website`) is a Next.js app that statically generates pages at build time. Pages are fast to serve because they're pre-rendered HTML.

The problem: when you update a page in the CMS and publish it, the old HTML is still cached. **On-Demand ISR** (Incremental Static Regeneration) solves this:

```python
# app/modules/ops/pages.py — after setting status = published
await client.post(
    f"{settings.WEBSITE_URL}/api/revalidate",
    params={"secret": settings.REVALIDATE_SECRET, "tag": f"page-{slug}"},
)
```

This tells Next.js to invalidate only the cache for that page's tag. Next.js re-renders just that page on the next request. Other pages stay cached and fast.

The `REVALIDATE_SECRET` is a shared secret — only your backend knows it, so random people can't trigger revalidations.

---

## 18. Background Jobs (RQ)

Some operations shouldn't block the HTTP response: sending emails, generating reports, processing uploads. **RQ** (Redis Queue) runs these in a separate worker process.

The pattern:
```
HTTP request → enqueue job → return 202 Accepted immediately
Redis → Worker process picks up job → runs the actual work
```

Your `pyproject.toml` includes `rq` and `redis`. You'd use it for:
- Sending email when a candidate's status changes
- Notifying a member they've been assigned a coffee chat
- Sending contact form submissions

---

## 19. Role-Based Access Control (RBAC)

You have four roles with a strict hierarchy:

```
member → pm → director → eboard
  0       1      2          3
```

The hierarchy is enforced numerically:

```python
ROLE_ORDER = {UserRole.member: 0, UserRole.pm: 1, UserRole.director: 2, UserRole.eboard: 3}

def require_role(min_role: UserRole):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if ROLE_ORDER[user.role] < ROLE_ORDER[min_role]:
            raise HTTPException(403, "Insufficient permissions")
```

`require_role(UserRole.director)` allows directors AND eboard without explicitly listing both — any role with a number ≥ 2 passes.

**Principle of least privilege:** endpoints only grant the minimum role necessary. Members can submit their own profile edit requests but can't approve them. PMs can view candidates but can't configure interview rounds.

---

## 20. Monorepo Structure

Your repo has three apps sharing a common Git history and tooling:

```
apps/
  backend/    — FastAPI Python API
  website/    — Public Next.js site
  frontend/   — Internal ops tool (Next.js)
packages/
  types/      — Shared TypeScript types
  ui/         — Shared React components
  config/     — Shared tsconfig, eslint
```

**Turborepo** caches build outputs. If you change only `apps/website`, it doesn't rebuild the backend. `pnpm workspaces` handles package linking — `apps/frontend` can import `@cba/types` as if it were an npm package, but it resolves to the local `packages/types` directory.

The backend is independent — Python doesn't participate in the JS workspace graph. It has its own `pyproject.toml` and `uv`/pip dependency management.

---

## 21. Alembic env.py — How Migrations Actually Run

This is the file that bridges your Python models and your live database. When you run `alembic upgrade head`, this file is what executes.

```python
# alembic/env.py

import app.models  # noqa: F401  ← critical line
target_metadata = Base.metadata
```

**Why you must import all models:** Alembic compares `Base.metadata` (what your ORM models describe) against the live database schema to generate diffs. `Base.metadata` is only populated when a model class is imported — Python doesn't scan files automatically. If you create a new model file and forget to import it in `app/models/__init__.py`, Alembic won't know it exists and won't generate a migration for it.

**Offline vs online mode:**

```python
if context.is_offline_mode():
    run_migrations_offline()   # generates SQL to a file, doesn't touch a DB
else:
    run_async_migrations()     # connects to real DB and applies changes
```

Offline mode (`alembic upgrade head --sql`) is useful for generating a migration SQL script to review before running it in production.

**Why `NullPool` in migrations:**

```python
connectable = create_async_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
```

Connection pools are designed for long-running processes (web servers) that reuse connections. Migrations run once and exit. `NullPool` means "don't pool — open a connection, use it, close it." This avoids the pool hanging on process exit.

**The `run_sync` adapter:**

```python
await connection.run_sync(
    lambda conn: context.configure(connection=conn, ...)
)
```

Alembic's core is synchronous (written before async Python existed). `run_sync` runs a synchronous callable inside an async context — it hands a regular sync connection to Alembic's machinery so it can do its synchronous work without blocking the event loop.

**`compare_type=True`:**  
Tells Alembic to detect column type changes (e.g., `VARCHAR(100)` → `VARCHAR(255)`, or `INTEGER` → `BIGINT`) during autogenerate. Without it, only structural changes (new columns, dropped columns) are detected.

**The migration workflow:**
```bash
# 1. Change a model (add a field, rename a column, etc.)
# 2. Generate the migration
alembic revision --autogenerate -m "describe what changed"
# 3. ALWAYS review the generated file — autogenerate isn't perfect
# 4. Apply it
alembic upgrade head
# 5. To undo the last migration
alembic downgrade -1
```

---

## 22. Pydantic Schema Inheritance

You can extend Pydantic models just like regular Python classes:

```python
class MembershipPublic(BaseModel):
    id: uuid.UUID
    role_title: str
    # ... 12 more fields

class MembershipDetail(MembershipPublic):
    """Adds user info — returned by the single-record endpoint."""
    user_name: str
    user_email: str
```

`MembershipDetail` has all 14 fields from `MembershipPublic` plus 2 new ones. The backend GET endpoint returns a dict instead of an ORM object so it can include the joined user fields:

```python
return {
    **{c.key: getattr(m, c.key) for c in m.__table__.columns},
    "user_name": m.user.name,
    "user_email": m.user.email,
}
```

`m.__table__.columns` iterates all columns on the ORM model — this is a SQLAlchemy introspection trick to avoid manually listing every field.

**When to use schema inheritance:**  
When one response shape is a strict superset of another. The list endpoint returns `MembershipPublic` (no user join needed — would be N+1). The single-record endpoint returns `MembershipDetail` (one record, worth joining).

**When NOT to:**  
When the shapes diverge (different field names, different types). Inheritance creates coupling — if the parent changes, all children change too. For truly different shapes, separate classes are cleaner.

---

## 23. TanStack Query Patterns

TanStack Query (formerly React Query) manages all server state in your frontend. Key patterns used throughout the app:

**The `enabled` gate:**

```typescript
const { data: editRequests } = useQuery({
  queryKey: ["edit-requests"],
  queryFn: () => api().get("/ops/v1/edit-requests"),
  enabled: !!session?.accessToken && isDirectorOrAbove,  // only fire when both are true
});
```

`enabled: false` means the query never runs. Use this when you need data from another query first (e.g., need `currentUser` before you know if you're a director).

**Query keys are arrays, not strings:**

```typescript
queryKey: ["members", id]   // invalidates only this specific member
queryKey: ["members"]       // invalidates the whole list
```

`qc.invalidateQueries({ queryKey: ["members"] })` marks all queries whose key *starts with* `["members"]` as stale — they'll refetch on next render. After a successful PATCH, you invalidate `["members", id]` to refresh the profile page.

**`useMutation` lifecycle:**

```typescript
const update = useMutation({
  mutationFn: (data) => api().patch(`/ops/v1/members/${id}`, data),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["members", id] }),
});

// Call it:
update.mutate(formData);

// Status flags:
update.isPending   // request in flight
update.isSuccess   // last call succeeded
update.isError     // last call failed
update.error       // the error object
```

**`values` prop in react-hook-form:**

```typescript
const { register } = useForm<ProfileFields>({
  values: membership ? { bio: membership.bio ?? "", ... } : undefined,
});
```

`values` (not `defaultValues`) syncs the form whenever `membership` changes — when the query resolves, the form automatically populates. `defaultValues` only sets the initial value once. Use `values` when your form data comes from an async query.

---

## 24. NextAuth JWT Callback — The Token Exchange Flow

NextAuth sits between Google and your backend. The flow is:

```
Browser → Google Sign In → Google returns id_token (Google's JWT)
                                          ↓
                                NextAuth jwt() callback
                                          ↓
                           POST /ops/v1/auth/google {id_token}
                                          ↓
                           Backend verifies → issues its own JWT pair
                                          ↓
                           NextAuth stores { accessToken, refreshToken } in session cookie
```

**The jwt callback runs on every session access**, not just login:

```typescript
async jwt({ token, account }) {
  // account is only present on initial sign-in
  if (account?.id_token) {
    // Exchange Google token for backend JWT — runs once on login
    const res = await fetch(BACKEND_URL + "/ops/v1/auth/google", { body: { id_token } });
    return { ...token, accessToken, refreshToken, accessTokenExpires: Date.now() + 55*60*1000 };
  }

  // On every subsequent request — check expiry
  if (Date.now() < token.accessTokenExpires) return token;  // still valid

  // Access token expired — try to refresh
  const res = await fetch(BACKEND_URL + "/ops/v1/auth/refresh", { body: { refresh_token } });
  if (!res.ok) return { ...token, error: "RefreshTokenError" };  // logout signal
  return { ...token, accessToken: newToken, accessTokenExpires: Date.now() + 55*60*1000 };
}
```

The session cookie stores the JWT token. When the app layout detects `session.error === "RefreshTokenError"`, it redirects to `/login` — the user's session is expired.

**Why 55 minutes not 60?**  
The backend issues 1-hour tokens. Refreshing at exactly 60 minutes could race with expiry. 55 minutes gives a 5-minute buffer to refresh before the access token actually expires on the backend.

---

## 25. Role-Aware UI Pattern

The profile editor has three modes depending on who's viewing:

```typescript
const isDirectorOrAbove = currentUser
  ? ROLE_ORDER[currentUser.role] >= ROLE_ORDER["director"]
  : false;
const isOwnProfile = currentUser?.id === membership?.user_id;

const canDirectEdit = isDirectorOrAbove;          // directors: save immediately
const canRequestEdit = isOwnProfile && !isDirectorOrAbove;  // members: submit for review
const isReadOnly = !isDirectorOrAbove && !isOwnProfile;     // others: can't edit
```

The same form renders in all three modes — only the submit behavior and `disabled` state change:

```typescript
// Same form fields, same UI
<Input {...register("bio")} disabled={isReadOnly} />

// Different submit path
const onSubmit = (data) => {
  if (canDirectEdit) directUpdate.mutate(changes);
  else if (canRequestEdit) requestEdit.mutate(changes);
  // isReadOnly: form.handleSubmit never fires (button is hidden)
};

// Different button label
{canDirectEdit ? "Save changes" : "Submit for review"}
```

This pattern — single form, branching behavior at the submit layer — is cleaner than rendering completely different forms for each role. The backend enforces the same rules independently: `PATCH /members/{id}` requires `director`, `POST /members/{id}/edit-requests` requires only authentication.

**Why enforce on both frontend AND backend?**  
Frontend enforcement is UX — it hides controls that don't apply. Backend enforcement is security — it rejects calls regardless of how they're made. Never trust the frontend alone.

---

## Full Schema Relationship Diagram

```
users
  ├── user_sessions (1:M)         — login sessions / refresh tokens
  ├── memberships (1:M)           — one per semester in CBA
  │     ├── cohorts (M:1)         — which semester
  │     ├── projects (M:1)        — which client project (nullable)
  │     └── profile_edit_requests (1:M)  — pending profile changes
  ├── interview_assignments (1:M) — which sessions they're assigned to score
  ├── coffee_chats (1:M)          — chats they conduct as a member
  └── interview_scores (1:M)      — scores they submit

cohorts
  ├── memberships (1:M)
  └── projects (1:M)

application_cycles
  ├── candidates (1:M)
  └── interview_rounds (1:M)
        ├── interview_categories (1:M)   — scoring categories per round
        └── interview_sessions (1:M)     — scheduled time slots
              ├── interview_assignments (1:M)  — which members run it
              └── interview_scores (1:M)       — all scores from this session

candidates
  ├── application_cycles (M:1)
  ├── candidate_di_data (1:1)     — separate table, EBoard-only access
  ├── coffee_chats (1:M)
  └── interview_scores (1:M)

interview_scores
  — sits at the intersection of: session + candidate + member + category
  — stores either a numeric_score or a ynm_score depending on round type

pages     — standalone, no FK relationships (blocks stored as JSONB)
events    — standalone
assets    — uploaded_by_id FK → users (nullable, SET NULL on delete)
audit_logs — user_id FK → users (nullable, SET NULL on delete)
```
