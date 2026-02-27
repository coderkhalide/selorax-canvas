# SeloraX Canvas Platform — Build Plan

## Status: In Progress

## Architecture Summary

4 services + SpacetimeDB Maincloud + DigitalOcean MySQL + Redis

- **canvas-backend** (Express :3001) — REST, Mastra AI, MCP, publish pipeline
- **canvas-dashboard** (Next.js :3002) — Theme builder, direct STDB WebSocket
- **storefront** (Next.js :3003) — Customer renderer, REST only
- **preview-server** (Next.js :3004) — Pre-publish preview, reads live STDB

## Critical Rules (NEVER BREAK)

1. `tenant_id` in every STDB subscription, MySQL query, AI tool, MCP call
2. SpacetimeDB = Maincloud only, never Docker
3. `make stdb-generate` after every `module.ts` change
4. `subscribeToAllTables()` NEVER — always filter by `tenant_id` + `page_id`
5. Versions are immutable — rollback = pointer update only
6. `useTable` for live React state — never poll REST for STDB data
7. Component source code always saved (AI needs it for future edits)

## Phase Checklist

- [x] Phase 1 — Monorepo scaffold + environment
- [x] Phase 2 — SpacetimeDB module (4 tables, 15 reducers)
- [x] Phase 3 — Shared packages (@selorax/types, @selorax/renderer, @selorax/ui)
- [x] Phase 4 — canvas-backend (Express + Prisma + Mastra + all routes)
- [x] Phase 5 — canvas-dashboard (Next.js + STDB + Canvas UI)
- [x] Phase 6 — storefront (Next.js SSR renderer)
- [x] Phase 7 — preview-server (Next.js live STDB preview)
- [x] Phase 8 — Docker setup (4 services, no local DB/Redis)
- [x] Phase 9 — Experiment engine (routes/experiments.ts + routes/events.ts built into Phase 4)
- [ ] Phase 10 — Full UX polish (DnD, component library browser, funnel builder)

## Commands After Setup

```bash
# 1. Publish module to SpacetimeDB Maincloud
make stdb-publish

# 2. Generate typed client bindings for all 3 apps
make stdb-generate

# 3. Run Prisma migration against DigitalOcean MySQL
cd apps/canvas-backend && npx prisma migrate dev --name init

# 4. Start all services with hot reload
make dev
```

## Key File Paths

| File | Purpose |
|------|---------|
| `spacetime/src/module.ts` | STDB tables + reducers |
| `apps/canvas-backend/prisma/schema.prisma` | MySQL schema (12 models) |
| `apps/canvas-backend/src/publish/index.ts` | STDB → MySQL → Redis → CDN |
| `apps/canvas-backend/src/routes/serve.ts` | Storefront API |
| `apps/canvas-backend/src/spacetime/client.ts` | Node.js STDB one-shot client |
| `apps/canvas-backend/src/mastra/agents/canvas-agent.ts` | Claude Sonnet 4.6 agent |
| `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx` | Live STDB UI |
| `packages/renderer/src/PageRenderer.tsx` | SSR-compatible renderer |
| `.env` | All secrets (gitignored) |
| `docker-compose.yml` | 4 app services |
| `Makefile` | `make dev`, `make stdb-deploy` |

## Environment

Using real DigitalOcean MySQL + Redis (from env.txt). No local DB/Redis Docker services.
Docker only runs the 4 app services.
