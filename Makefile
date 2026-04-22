.PHONY: dev dev-backend dev-frontend dev-website \
        install install-backend \
        migrate migrate-create \
        test test-backend test-frontend test-e2e \
        lint typecheck format \
        docker-up docker-down docker-reset \
        bootstrap

# ── Local dev ─────────────────────────────────────────────────────────────────

dev: docker-up
	pnpm turbo dev

dev-backend:
	cd apps/backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend:
	pnpm --filter @cba/frontend dev

dev-website:
	pnpm --filter @cba/website dev

# ── Install ───────────────────────────────────────────────────────────────────

install:
	pnpm install

install-backend:
	cd apps/backend && uv sync --extra dev

bootstrap: install install-backend docker-up migrate
	@echo "✓ Bootstrap complete. Run 'make dev' to start."

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	cd apps/backend && uv run alembic upgrade head

migrate-create:
	@read -p "Migration name: " name; \
	cd apps/backend && uv run alembic revision --autogenerate -m "$$name"

migrate-down:
	cd apps/backend && uv run alembic downgrade -1

# ── Tests ─────────────────────────────────────────────────────────────────────

test: test-backend test-frontend

test-backend:
	cd apps/backend && uv run pytest -q

test-frontend:
	pnpm turbo test

test-e2e:
	pnpm --filter @cba/e2e e2e

# ── Code quality ──────────────────────────────────────────────────────────────

lint:
	pnpm turbo lint
	cd apps/backend && uv run ruff check .

typecheck:
	pnpm turbo typecheck
	cd apps/backend && uv run mypy app

format:
	pnpm format
	cd apps/backend && uv run ruff format .

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up:
	docker compose -f infra/docker-compose.yml up -d --wait

docker-down:
	docker compose -f infra/docker-compose.yml down

docker-reset:
	docker compose -f infra/docker-compose.yml down -v
	docker compose -f infra/docker-compose.yml up -d --wait
	$(MAKE) migrate
