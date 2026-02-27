# Canvas Backend — Express API + Mastra AI

Port 3001. Express + TypeScript + Prisma + Mastra + SpacetimeDB client.

## Routes
| Route | Auth | Description |
|-------|------|-------------|
| GET /health | public | Service status |
| GET/POST/PATCH/DELETE /api/pages | tenant | Page CRUD |
| POST /api/pages/:id/publish | tenant | Full publish pipeline |
| GET /api/pages/:id/versions | tenant | Version history |
| POST /api/pages/:id/rollback/:versionId | tenant | Rollback (pointer update only) |
| GET/POST/PATCH/DELETE /api/components | tenant | Component registry |
| GET/POST/PATCH/DELETE /api/funnels | tenant | Funnel builder |
| GET/POST/PATCH/DELETE /api/experiments | tenant | A/B experiments |
| POST /api/ai/canvas | tenant | AI agent streaming |
| POST /api/events | public | Fire-and-forget event ingestion |
| GET /api/serve/:tenantId/:pageType/:slug | public | Serve published page |
| ALL /mcp | public | Mastra MCP endpoint |

## Tenant Middleware
MVP mode: reads `TENANT_ID` from env (hardcoded for single-tenant dev).
Production: reads `x-tenant-id` header. Attaches `req.tenant` to every request.

## Key File Locations
```
src/
  index.ts              — Express app setup, route registration
  middleware/tenant.ts  — Tenant resolution (MVP_MODE env check)
  db/index.ts           — PrismaClient singleton
  redis/client.ts       — ioredis with TLS + graceful disable
  spacetime/client.ts   — Node.js one-shot STDB client (getPageNodes, callReducer)
  utils/tree.ts         — buildTree() + flattenTree()
  utils/order.ts        — Fractional indexing helpers
  publish/index.ts      — STDB→MySQL→Redis→Cloudflare pipeline
  routes/
    pages.ts, serve.ts, components.ts, funnels.ts, ai.ts, experiments.ts, events.ts
  mastra/
    index.ts            — Mastra instance
    agents/canvas-agent.ts  — Claude Sonnet 4.6 with 16 tools
    tools/index.ts      — All 16 tool exports
    tools/*.ts          — Individual tool implementations
    mcp/server.ts       — MCPServer
```

## Publish Pipeline (publish/index.ts)
1. Verify page ownership in MySQL
2. Read flat nodes from SpacetimeDB (getPageNodes)
3. buildTree() → stripCanvasMetadata() → JSON.stringify()
4. SHA-256 hash for dedup — skip create if same content
5. Create immutable PageVersion row in MySQL
6. Update `page.publishedVersionId` (this IS the rollback mechanism)
7. Warm Redis cache (skip if Redis unavailable — `redis.status === 'ready'` guard)
8. Purge Cloudflare cache tags (skip if no env vars)

## AI Tools (16 total)
All tools use `createTool({ id, description, inputSchema, outputSchema, execute })`.
- All tools require `tenant_id` as first param (isolation)
- Canvas manipulation: `get_page_tree`, `get_node`, `find_nodes`, `insert_node`, `update_node_styles`, `update_node_props`, `update_node_settings`, `move_node`, `delete_node`
- Components: `search_components`, `get_component`, `build_component`, `inject_component`
- Pages: `list_pages`, `publish_page`
- Analytics: `get_analytics`

## SpacetimeDB Client Pattern
```typescript
// One-shot read
const nodes = await getPageNodes(pageId, tenantId);

// One-shot reducer call
await callReducer('insert_node', { id, page_id, tenant_id, ... });
```
Both connect → do work → disconnect. 10s timeout for reads, 5s for writes.

## Redis
- URL from `REDIS_URL` env var — auto-converts `redis://` to `rediss://` for DigitalOcean TLS
- Guards: check `redis && redis.status === 'ready'` before any call
- App works without Redis (MySQL fallback in serve route)
- `retryStrategy` stops after 3 attempts

## Environment (loaded via tsx --env-file=../../.env)
Critical: `--env-file` flag loads `.env` BEFORE any module imports. Inline dotenv won't work for module-level code (Redis client, etc.).

## Prisma Schema (12 models)
Page, PageVersion, Component, ComponentVersion, Funnel, FunnelStep, Experiment, ExperimentVariant, VisitorSession, ConversionEvent, ExperimentSnapshot, AiAnalysisResult

## Dev Script
```bash
tsx watch --env-file=../../.env src/index.ts
```
