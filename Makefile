.PHONY: dev prod down logs stdb-publish stdb-generate stdb-deploy db-migrate db-reset status

# ── SpacetimeDB (Maincloud) ────────────────────────────────────
stdb-publish:
	cd spacetime && echo "y" | spacetime publish selorax-canvas --module-path $(CURDIR)/spacetime --server maincloud

stdb-generate:
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/canvas-backend/src/module_bindings --module-path $(CURDIR)/spacetime
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/canvas-dashboard/src/module_bindings --module-path $(CURDIR)/spacetime
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/preview-server/src/module_bindings --module-path $(CURDIR)/spacetime
	@echo "✓ Bindings generated for backend, dashboard, preview-server"

# Full deploy: publish to Maincloud + regenerate bindings
stdb-deploy: stdb-publish stdb-generate

# ── Local dev (no Docker) ──────────────────────────────────────
dev-local:
	npm run dev:local

# ── Docker ─────────────────────────────────────────────────────
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

prod:
	docker compose -f docker-compose.yml up -d

down:
	docker compose down

logs:
	docker compose logs -f

# Shell into a running service: make shell-canvas-backend
shell-%:
	docker compose exec $* sh

status:
	docker compose ps

# ── Database ───────────────────────────────────────────────────
db-migrate:
	cd apps/canvas-backend && npx prisma migrate dev

db-deploy:
	cd apps/canvas-backend && npx prisma migrate deploy

db-reset:
	cd apps/canvas-backend && npx prisma migrate reset

db-studio:
	cd apps/canvas-backend && npx prisma studio

# ── Install ────────────────────────────────────────────────────
install:
	npm install
