# Handover

This repo has a small number of credentials owned by specific individuals rather than
the club as an organization. If you're graduating, stepping down, or otherwise handing
this project to someone else, read this first — several things will break silently
(not loudly) if nobody rotates them.

The highest-risk one is the AI design-agent feature (see `docs/architecture.md` for
what it does): it depends on one person's personal Claude subscription, and there's no
alert if that subscription lapses — `.github/workflows/design-agent.yml` just starts
failing, and nobody notices until someone checks the Actions tab or a director wonders
why an approved request never produces a PR.

## Credential inventory

| Credential | Where it lives | What it authenticates | Blast radius if leaked / lapsed |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub Actions secret | The design-agent's Claude Code runs — billed against one person's Claude Pro/Max subscription usage, not metered API credits | Leaked: someone else can run agent jobs against your subscription. Lapsed: `design-agent.yml` fails silently on every approved request |
| `GITHUB_PAT_AGENT` | GitHub Actions secret | The design-agent's push + PR creation (`cba-ops-bot` account) | Leaked: write access (Contents, Pull requests) to this repo under the bot identity |
| `GITHUB_TOKEN` (backend's, distinct from the Actions default) | Railway env var | Backend's calls to dispatch the workflow, merge PRs, poll CI/deployment status (`cba-ops-bot` account) | Leaked: can trigger workflow runs and merge PRs to `main` |
| `DESIGN_AGENT_WEBHOOK_SECRET` | GitHub Actions secret + Railway env var (same value in both) | Authenticates the Action's callback into the backend webhook | Leaked: someone could report a fabricated agent-run result — mitigated in code by independently re-verifying the PR branch before merging, but rotate anyway if exposed |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console; Vercel env vars (`apps/frontend`); Railway env var (backend) | Google SSO login for the ops tool | Leaked: someone could impersonate the OAuth app; scoped to `@cornell.edu` accounts by the `hd` check either way |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare dashboard; Railway env var | File uploads (headshots, CMS images) to Cloudflare R2 | Leaked: write access to the `cba-assets` bucket |
| `NEXTAUTH_SECRET` | Vercel env var (`apps/frontend`) | Signs ops-tool session cookies | Leaked: session forgery. Rotated: invalidates every active ops-tool session immediately |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Railway env vars | Signs/verifies the backend's own access + refresh tokens (RS256) | Leaked private key: forge backend tokens. Rotated: invalidates all refresh tokens |

## Rotating the Claude subscription token

The design-agent's whole capability rides on one person's paid Claude subscription. When
that person leaves:

1. The new owner runs `claude setup-token` from their own machine, logged into their own
   Claude Pro/Max account.
2. Update the `CLAUDE_CODE_OAUTH_TOKEN` secret in GitHub (repo Settings → Secrets and
   variables → Actions).
3. Ask the previous owner to revoke the old token from their Claude account settings —
   don't just let it dangle.
4. Trigger a test design request end-to-end (see `docs/architecture.md`'s verification
   steps, or just approve any pending request) to confirm the new token works before
   the old owner's access disappears.

If there's ever a gap where nobody has an active token configured, `design-agent.yml`
will fail on every run — approved requests will sit stuck in `agent_running` until
retried. There's no automated alert for this; check the Actions tab if requests seem
to hang.

## Rotating the `cba-ops-bot` GitHub tokens

Both `GITHUB_PAT_AGENT` and the backend's `GITHUB_TOKEN` are fine-grained personal
access tokens issued under the `cba-ops-bot` machine account (not a personal account,
specifically so this survives any one person leaving). They still need rotation
occasionally:

1. Fine-grained PATs expire within a year (GitHub's max) — there's no automated
   expiry-warning in this setup, so put a reminder on your own calendar or check
   annually.
2. Log into `cba-ops-bot` (credentials should be in whatever password manager the
   outgoing maintainer used — if you don't have access to that, you'll need to reset
   the bot account's password/2FA via GitHub support or its recovery email).
3. Generate a new fine-grained PAT scoped to `cornell-business-analytics/cba-ops` only:
   - `GITHUB_PAT_AGENT`: Contents (Read & write), Pull requests (Read & write),
     Metadata (Read-only) — used as the Actions secret.
   - `GITHUB_TOKEN`: Actions (Read & write), Pull requests (Read & write), Metadata
     (Read-only) — used as the Railway env var.
4. Update both in place, delete the old tokens from GitHub's token settings.

## Access checklist

Fill this in at handover time — who currently has access to each of the following:

- [ ] `cba-ops-bot` GitHub account credentials
- [ ] GitHub repo admin (to manage Actions secrets/variables)
- [ ] Vercel team (both `apps/frontend` and `apps/website` projects)
- [ ] Railway project (backend, Postgres, Redis)
- [ ] Cloudflare account (R2 bucket)
- [ ] Google Cloud Console project (OAuth client)
- [ ] The Claude subscription behind `CLAUDE_CODE_OAUTH_TOKEN`

## Other ownership transfers (not credentials, but same problem)

- **Vercel project ownership** — transfer both projects via Vercel's team settings, or
  add the new maintainer to the team before the old one's access is removed.
- **Railway project ownership** — same idea, via Railway's project member settings.
- **Google Cloud project** — add the new maintainer as an Owner/Editor on the project
  backing `GOOGLE_CLIENT_ID` before removing the old one.

See `docs/architecture.md` for how these credentials fit into the system as a whole.
