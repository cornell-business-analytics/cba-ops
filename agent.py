#!/usr/bin/env python3
"""
CBA Ops Dev Agent

Usage:
    python agent.py "your task or question here"

Requires:
    pip install anthropic
    export ANTHROPIC_API_KEY=...
"""
import os
import subprocess
import sys

import anthropic
from anthropic import beta_tool

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

SYSTEM_PROMPT = """You are a development assistant for the cba-ops project — an internal operations platform for Cornell Business Analytics.

## Monorepo Layout
```
cba-ops/
  apps/
    backend/   FastAPI + PostgreSQL (Python 3.11, SQLAlchemy 2 async, Alembic, asyncpg)
    frontend/  Internal ops tool (Next.js, NextAuth, TanStack Query)
    website/   Public-facing site (Next.js, ISR + on-demand revalidation)
  packages/
    types/     Shared TypeScript interfaces used by both Next.js apps
    ui/        Shared React components
    config/    Shared ESLint/TS configs
```

## Backend (FastAPI)
- Entry: apps/backend/app/main.py
- Models: apps/backend/app/models/ — SQLAlchemy mapped classes
- Routers: apps/backend/app/routers/ — one file per domain (members, recruitment, etc.)
- Auth: Google OAuth via NextAuth; backend validates JWT (python-jose). RBAC roles: member < pm < director < eboard
- DB: PostgreSQL on Railway. Migrations: alembic/versions/ (0001–0008). Run `alembic upgrade head` on deploy.
- Async throughout: async SQLAlchemy sessions, asyncpg driver. Use selectinload for related data to avoid N+1.
- API keys/secrets in .env loaded via pydantic-settings (Settings class)
- Gmail API: org-level OAuth token stored as singleton in gmail_tokens table. Sender name comes from logged-in user.
- Google Sheets API: used to import coffee_chat_applicants. Dedup key = netid_timestamp.
- ISR revalidation: backend calls the website's /api/revalidate endpoint after data changes.

## Frontend / Website (Next.js)
- Snake_case everywhere — API returns snake_case, TypeScript types match. No camelCase conversion.
- Shared types live in packages/types; import as @cba/types.
- TanStack Query for data fetching (useQuery / useMutation). Cache keys match API paths.
- Auth: NextAuth with Google provider, restricted to @cornell.edu + allowlist.
- Website uses ISR (next/cache with `revalidate` tags). On-demand revalidation triggered by backend.

## Database Schema (key tables)
- users: email, name, google_sub, role (member/pm/director/eboard), is_active
- memberships: user_id, cohort_id, profile fields, website_role, display_order
- candidates: cycle_id, name, email, net_id, status (applied→coffee_chat→interviewing→offer→accepted)
- coffee_chats: candidate_id, member_id (users), score 0–3, completed
- coffee_chat_applicants: Sheets-based import. cycle_id, netid, row_key, paired_membership_id, pairing_status
- recruitment_cycles: name, sheet_id, email templates (pairing + rejection)
- gmail_tokens: singleton row — access_token, refresh_token, token_expiry, account_email
- interview_rounds/categories/sessions/scores: configurable scoring pipeline per cycle
- allowed_emails: login allowlist
- audit_logs: immutable action log, eboard-only

## Conventions
- Snake_case everywhere in Python and TypeScript (no auto-conversion)
- No TODOs, no dead code
- Write clean minimal code — no premature abstractions
- Railway deploys backend (runs alembic upgrade head on deploy), Vercel deploys frontend + website
- pnpm workspaces; turbo for build pipeline

When you need to understand the codebase, read the relevant files. When you need to make changes, write the files directly. Prefer surgical edits over full rewrites.
"""


@beta_tool
def read_file(path: str) -> str:
    """Read the contents of a file.

    Args:
        path: File path, relative to project root or absolute.
    """
    abs_path = path if os.path.isabs(path) else os.path.join(PROJECT_ROOT, path)
    try:
        with open(abs_path) as f:
            content = f.read()
        lines = content.splitlines()
        if len(lines) > 500:
            preview = "\n".join(f"{i+1}: {l}" for i, l in enumerate(lines[:500]))
            return f"{preview}\n\n[... {len(lines) - 500} more lines — use search_code or read a specific section]"
        return "\n".join(f"{i+1}: {l}" for i, l in enumerate(lines))
    except FileNotFoundError:
        return f"Error: file not found — {abs_path}"
    except Exception as e:
        return f"Error reading file: {e}"


@beta_tool
def list_directory(path: str = ".") -> str:
    """List files and directories at a path.

    Args:
        path: Directory path, relative to project root.
    """
    abs_path = path if os.path.isabs(path) else os.path.join(PROJECT_ROOT, path)
    try:
        entries = sorted(os.listdir(abs_path))
        lines = []
        for entry in entries:
            full = os.path.join(abs_path, entry)
            suffix = "/" if os.path.isdir(full) else ""
            lines.append(f"{entry}{suffix}")
        return "\n".join(lines) if lines else "(empty directory)"
    except FileNotFoundError:
        return f"Error: directory not found — {abs_path}"
    except Exception as e:
        return f"Error: {e}"


@beta_tool
def search_code(pattern: str, path: str = ".", file_extension: str = "") -> str:
    """Search for a pattern in code files using grep. Returns matching lines with filenames.

    Args:
        pattern: The pattern to search for (supports basic regex).
        path: Directory to search in, relative to project root.
        file_extension: Optional file extension filter, e.g. "py", "ts", "tsx". Leave empty to search all text/code files.
    """
    abs_path = path if os.path.isabs(path) else os.path.join(PROJECT_ROOT, path)
    cmd = [
        "grep", "-rn",
        "--exclude-dir=.git", "--exclude-dir=node_modules", "--exclude-dir=.venv",
        "--exclude-dir=.next", "--exclude-dir=__pycache__", "--exclude-dir=dist",
        pattern, abs_path,
    ]
    if file_extension:
        cmd += [f"--include=*.{file_extension.lstrip('.')}"]
    else:
        for ext in ("py", "ts", "tsx", "js", "jsx", "json", "md", "sql"):
            cmd += [f"--include=*.{ext}"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        output = result.stdout.strip()
        if not output:
            return "No matches found."
        lines = output.splitlines()
        if len(lines) > 100:
            return "\n".join(lines[:100]) + f"\n\n[... {len(lines) - 100} more matches truncated]"
        return output
    except subprocess.TimeoutExpired:
        return "Error: search timed out"
    except Exception as e:
        return f"Error: {e}"


@beta_tool
def run_command(command: str) -> str:
    """Run a shell command in the project root. Use for type checking, linting, running tests, etc.

    Args:
        command: The shell command to run (e.g. "pnpm tsc --noEmit", "pnpm lint", "cd apps/backend && python -m pytest tests/").
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=PROJECT_ROOT,
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        combined = []
        if stdout:
            combined.append(stdout)
        if stderr:
            combined.append(f"[stderr]\n{stderr}")
        output = "\n".join(combined) if combined else "(no output)"
        if len(output) > 4000:
            output = output[:4000] + "\n[... truncated]"
        return f"Exit code: {result.returncode}\n{output}"
    except subprocess.TimeoutExpired:
        return "Error: command timed out after 120s"
    except Exception as e:
        return f"Error: {e}"


@beta_tool
def write_file(path: str, content: str) -> str:
    """Write content to a file. Creates the file (and any parent directories) if needed.

    Args:
        path: File path, relative to project root.
        content: The full file content to write.
    """
    abs_path = path if os.path.isabs(path) else os.path.join(PROJECT_ROOT, path)
    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w") as f:
            f.write(content)
        return f"Written: {abs_path}"
    except Exception as e:
        return f"Error writing file: {e}"


def run_agent(user_input: str) -> None:
    client_inst = anthropic.Anthropic()
    tools = [read_file, list_directory, search_code, run_command, write_file]
    messages: list = [{"role": "user", "content": user_input}]

    max_restarts = 5
    restarts = 0

    while True:
        runner = client_inst.beta.messages.tool_runner(
            model="claude-opus-4-8",
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            tools=tools,
            messages=messages,
        )

        last = None
        for message in runner:
            last = message
            messages.append({"role": "assistant", "content": message.content})
            tool_response = runner.generate_tool_call_response()
            if tool_response is not None:
                messages.append(tool_response)

            for block in message.content:
                if block.type == "text" and block.text:
                    print(block.text, flush=True)
                elif block.type == "tool_use":
                    args_str = ", ".join(
                        f"{k}={repr(v)[:60]}" for k, v in block.input.items()
                    )
                    print(f"\n[{block.name}({args_str})]", flush=True)

        if last is None or last.stop_reason != "pause_turn":
            break

        restarts += 1
        if restarts > max_restarts:
            print("[agent] giving up — still paused after max restarts", file=sys.stderr)
            break


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python agent.py \"your task or question\"")
        sys.exit(1)

    task = " ".join(sys.argv[1:])
    run_agent(task)
