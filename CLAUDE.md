# SeloraX Canvas Platform — Root

## What This Is
AI-powered page builder monorepo. Merchants drag/drop and AI-generate pages in a real-time canvas editor. Published pages serve from a fast storefront via CDN.

## Monorepo Layout
```
apps/
  canvas-backend/   # Express API + Mastra AI agent (port 3001)
  canvas-dashboard/ # Next.js canvas editor + live STDB UI (port 3002)
  storefront/       # Next.js SSR storefront serving published pages (port 3003)
  preview-server/   # Next.js live preview of unpublished canvas state (port 3004)
packages/
  renderer/         # @selorax/renderer — SSR-compatible page tree renderer
  types/            # @selorax/types — shared TypeScript interfaces
  ui/               # @selorax/ui — shared UI components
spacetime/          # SpacetimeDB module (TypeScript → WASM → Maincloud)
```

## Real-Time Architecture
- **SpacetimeDB Maincloud** (`wss://maincloud.spacetimedb.com`, db: `selorax-canvas`) — live canvas state
- **DigitalOcean MySQL** — persistent pages, versions, components, experiments
- **DigitalOcean Redis** — serve cache + experiment routing + event queue
- **Cloudflare R2** — ESM component CDN
- Canvas state flows: STDB → publish pipeline → MySQL → Redis → storefront

## Non-Negotiable Rules
1. **`tenant_id` everywhere** — in every STDB subscription, MySQL query, AI tool call, MCP call
2. **SpacetimeDB = Maincloud only** — never Docker, never localhost STDB
3. **`subscribeToAllTables()` NEVER** — always filter by `page_id + tenant_id`
4. **Versions are immutable** — rollback = update `publishedVersionId` pointer only, never mutate a version
5. **`useTable` for live React state** — never poll REST for STDB data
6. **Component source always saved** in MySQL `ComponentVersion.sourceCode` — AI needs it for future edits
7. **`make stdb-generate` after every `module.ts` change** — regenerates bindings for all 3 apps
8. **`make elements-generate` after every custom element change** — regenerates bundles in `packages/renderer/src/elements/`; without it, new/modified elements render as blank space in storefront and preview

## Dev Commands
```bash
npm run dev:local          # Start all 4 services (requires .env at root)
make stdb-publish          # Deploy module to Maincloud
make stdb-generate         # Regenerate TypeScript bindings (run after module.ts changes)
make elements-generate     # Regenerate custom element bundles (run after adding/modifying custom elements)
cd apps/canvas-backend && npx prisma generate   # Regenerate Prisma client
cd apps/canvas-backend && npx prisma db push    # Sync schema to MySQL (dev)
```

## Environment
- `.env` at repo root — loaded by backend via `--env-file=../../.env`
- `.env.local` in each Next.js app — for `NEXT_PUBLIC_*` vars + `BACKEND_URL`
- Never commit `.env` or `apps/**/.env.local` (gitignored)
- `.env.example` is the committed template

## Key Package Names (CRITICAL — don't use wrong names)
- `spacetimedb` (NOT `spacetimedb-sdk`) — v2.0.1
- `@mastra/core` v1.8.0 — import from `@mastra/core/mastra`, `@mastra/core/agent`, `@mastra/core/tools`
- `@ai-sdk/anthropic` v3.0.0 — `anthropic('claude-sonnet-4-6')` pattern
- No `nanoid` — use `crypto.randomUUID()` (built-in Node 20)

## SpacetimeDB Module
- 4 tables: `canvas_node`, `active_cursor`, `ai_operation`, `component_build`
- 15 reducers: `insert_node`, `update_node_styles`, `update_node_props`, `update_node_settings`, `move_node`, `delete_node_cascade`, `lock_node`, `unlock_node`, `upsert_cursor`, `move_cursor`, `remove_cursor`, `create_ai_operation`, `update_ai_operation`, `create_component_build`, `stream_component_code`
- Index names must be globally unique across ALL tables (prefix with table name)
- `.optional()` for nullable fields (NOT `.nullable()`)
