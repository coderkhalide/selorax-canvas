# SeloraX Canvas Platform — Full Build Specification
## Claude Code Implementation Guide v2.0

> Read this entire document before writing any code. This is the complete, corrected spec.
>
> **Key corrections from v1.0:**
> - SpacetimeDB runs on **Maincloud** (cloud service) — NOT a Docker container
> - Clients connect **directly** to SpacetimeDB via WebSocket — no proxy
> - Backend is **Express** (Node.js) — not Bun/Hono
> - Use **`spacetime generate`** to get typed client bindings — never write them manually
> - Use **`useTable`** hook from `spacetimedb/react` for live data — never poll

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [How SpacetimeDB Actually Works](#2-how-spacetimedb-actually-works)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Tenant Scoping — The Core Rule](#4-tenant-scoping--the-core-rule)
5. [SpacetimeDB Module](#5-spacetimedb-module)
6. [Codegen — Generating Client Bindings](#6-codegen--generating-client-bindings)
7. [Service 1 — canvas-backend (Express)](#7-service-1--canvas-backend-express)
8. [Service 2 — canvas-dashboard (Next.js)](#8-service-2--canvas-dashboard-nextjs)
9. [Service 3 — storefront (Next.js)](#9-service-3--storefront-nextjs)
10. [Service 4 — preview-server (Next.js)](#10-service-4--preview-server-nextjs)
11. [Shared Packages](#11-shared-packages)
12. [Database Schema (MySQL)](#12-database-schema-mysql)
13. [Docker Setup](#13-docker-setup)
14. [Environment Variables](#14-environment-variables)
15. [Dev Workflow & Scripts](#15-dev-workflow--scripts)
16. [Build Order](#16-build-order)

---

## 1. What We Are Building

A **self-contained canvas platform** that lives alongside SeloraX. It does NOT depend on the main backend at all for MVP — tenant identity comes from ENV.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│           SPACETIMEDB MAINCLOUD (cloud — NOT Docker)                │
│                                                                     │
│  Module: selorax-canvas                                             │
│  URL:    wss://maincloud.spacetimedb.com                            │
│                                                                     │
│  Tables: canvas_node, active_cursor, ai_operation, component_build  │
│  Reducers: insert_node, update_node_styles, move_cursor, etc.       │
│                                                                     │
│  ← Clients connect directly via WebSocket. No proxy. No REST.       │
└──────────────┬──────────────────────────────────────────────────────┘
               │  WebSocket (direct — browser and Node.js both connect here)
    ┌──────────┼──────────────────────┐
    │          │                      │
    ▼          ▼                      ▼
canvas-dashboard  preview-server  canvas-backend (for publish + AI tools)
(Next.js :3002)  (Next.js :3004)  (Express :3001)

┌─────────────────────────────────────────────────────────────────────┐
│                   LOCAL DOCKER SERVICES                             │
│                                                                     │
│  canvas-backend   :3001  Express — REST, Mastra AI, MCP, publish   │
│  canvas-dashboard :3002  Next.js — theme builder (direct STDB WS)  │
│  storefront       :3003  Next.js — customer-facing renderer         │
│  preview-server   :3004  Next.js — pre-publish preview             │
│  canvas-db        :3307  MySQL — published pages, registry          │
│  redis            :6380  Redis — serve cache for storefront         │
│                                                                     │
│  One command: make dev                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### What Each Service Owns

```
SpacetimeDB (real-time, ephemeral):        Express + MySQL (persistent):
──────────────────────────────────         ────────────────────────────────
canvas_node rows (live canvas state)       pages table — slug, metadata
active_cursor rows (who's where)           page_versions — immutable snapshots
ai_operation rows (AI status/progress)     components registry
component_build rows (code stream)         funnels table
Reducers — the only write path             Publish pipeline
Subscriptions — the only read path         Mastra AI agent + MCP server
                                           Serve API → Redis → storefront
                                           Component CDN upload
```

### The Data Flow

```
EDITING:
  Merchant opens canvas-dashboard
  → Next.js middleware injects TENANT_ID from ENV
  → 'use client' component connects to SpacetimeDB Maincloud via WebSocket
  → subscribes: canvas_node WHERE page_id=X AND tenant_id=Y
  → human or AI calls reducers → SpacetimeDB broadcasts to all subscribers
  → all connected canvas clients see changes instantly

PREVIEW (pre-publish):
  Merchant clicks Preview
  → preview-server connects to SpacetimeDB as Node.js client
  → reads LIVE canvas_node rows (not published MySQL snapshot)
  → renders with @selorax/renderer — merchant sees exact live state

PUBLISH:
  Merchant clicks Publish → POST /api/pages/:id/publish
  → Express connects to SpacetimeDB as Node.js client
  → reads flat canvas_node rows for this page + tenant
  → buildTree() → clean JSON snapshot
  → INSERT into MySQL page_versions (immutable)
  → UPDATE pages.published_version_id pointer
  → SET in Redis (serve cache)
  → Cloudflare cache purge

SERVE (customer):
  Customer visits storefront
  → storefront calls GET /api/serve/:tenantId/:pageType/:slug
  → Express returns JSON tree from Redis (fast) or MySQL (fallback)
  → storefront renders with @selorax/renderer (SSR + revalidate)
  → SpacetimeDB NOT involved — clean separation
```

---

## 2. How SpacetimeDB Actually Works

**Read this before writing any code.**

### SpacetimeDB = database + server combined

```
Traditional:  Client → HTTP → Your Server → SQL → Database
SpacetimeDB:  Client → WebSocket → SpacetimeDB (module runs INSIDE the DB)
```

Your module (`spacetime/src/module.ts`) is published to Maincloud and runs **inside** the database. Reducers are atomic transactions — the **only** way to write data. Clients never write directly to tables.

### Deploy module → generate bindings → use bindings

```bash
# 1. Deploy module to Maincloud (once per schema change)
spacetime publish --server maincloud selorax-canvas

# 2. Generate TypeScript bindings from the deployed module
#    (run this after every module.ts change)
spacetime generate \
  --lang typescript \
  --out-dir apps/canvas-dashboard/src/module_bindings \
  --module-path ./spacetime

# The generated src/module_bindings/ folder contains:
# ├── index.ts           ← DbConnection, tables, reducers exports
# ├── canvas_node.ts     ← typed CanvasNode class
# ├── active_cursor.ts   ← typed ActiveCursor class
# ├── ai_operation.ts    ← typed AiOperation class
# └── component_build.ts ← typed ComponentBuild class
```

**Never edit files in `module_bindings/`. Always regenerate.**

### Direct WebSocket connection — no proxy

```typescript
// This is all you need to connect from any TypeScript environment
import { DbConnection, tables } from './module_bindings';

const conn = DbConnection.builder()
  .withUri('wss://maincloud.spacetimedb.com')
  .withDatabaseName('selorax-canvas')
  .onConnect(ctx => {
    ctx.subscriptionBuilder()
      .onApplied(() => console.log('Ready'))
      .subscribe([
        // Typed query builder — always filter by tenant + page
        tables.canvas_node.where(r =>
          r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
        ),
      ]);
  })
  .build();
```

### Subscriptions push updates automatically

```typescript
// SpacetimeDB pushes changes — no polling, no REST
conn.db.canvas_node.onInsert((ctx, node) => { /* fires on any insert */ });
conn.db.canvas_node.onUpdate((ctx, old, next) => { /* fires on any update */ });
conn.db.canvas_node.onDelete((ctx, node) => { /* fires on any delete */ });
```

### useTable hook — live React state

```typescript
import { useTable }  from 'spacetimedb/react';
import { tables }    from './module_bindings';

// Auto-updates whenever subscribed rows change
const [nodes, isLoading] = useTable(
  tables.canvas_node.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  )
);
```

### Express reads SpacetimeDB via Node.js client (for publish + AI tools)

```typescript
// apps/canvas-backend/src/spacetime/client.ts
import { DbConnection, tables } from '../module_bindings';

export async function getPageNodes(pageId: string, tenantId: string) {
  return new Promise<CanvasNode[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 10_000);

    DbConnection.builder()
      .withUri(process.env.SPACETIMEDB_URL!)
      .withDatabaseName(process.env.SPACETIMEDB_DB_NAME!)
      .onConnect(ctx => {
        ctx.subscriptionBuilder()
          .onApplied(() => {
            const nodes = Array.from(ctx.db.canvas_node.iter())
              .filter(n => n.page_id === pageId && n.tenant_id === tenantId);
            clearTimeout(timer);
            resolve(nodes);
          })
          .subscribe([
            tables.canvas_node.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
          ]);
      })
      .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
      .build();
  });
}
```

---

## 3. Monorepo Structure

```
selorax-canvas/
│
├── package.json                ← root npm workspaces
├── turbo.json                  ← turborepo pipeline
├── .env                        ← all secrets (gitignored)
├── .env.example                ← template (committed)
├── docker-compose.yml          ← local services only (MySQL, Redis + apps)
├── docker-compose.dev.yml      ← hot reload overrides
├── Makefile                    ← convenience commands
├── spacetime.json              ← SpacetimeDB CLI project config
│
├── spacetime/                  ← SpacetimeDB module (published to Maincloud)
│   ├── package.json
│   └── src/
│       └── module.ts           ← ALL tables + reducers (real-time backend)
│
├── apps/
│   ├── canvas-backend/         ← Express REST + AI + MCP + publish
│   ├── canvas-dashboard/       ← Next.js theme builder (direct STDB connection)
│   ├── storefront/             ← Next.js customer renderer (REST only)
│   └── preview-server/         ← Next.js pre-publish preview (STDB read)
│
└── packages/
    ├── renderer/               ← @selorax/renderer (~15kb, SSR + client)
    ├── types/                  ← @selorax/types (shared TypeScript types)
    └── ui/                     ← @selorax/ui (shared React components)
```

### Root package.json

```json
{
  "name": "selorax-canvas",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "spacetime"],
  "scripts": {
    "dev":            "turbo run dev",
    "build":          "turbo run build",
    "lint":           "turbo run lint",
    "stdb:publish":   "cd spacetime && spacetime publish --server maincloud selorax-canvas",
    "stdb:generate":  "npm run stdb:generate:backend && npm run stdb:generate:dashboard && npm run stdb:generate:preview",
    "stdb:generate:backend":   "spacetime generate --lang typescript --out-dir apps/canvas-backend/src/module_bindings --module-path ./spacetime",
    "stdb:generate:dashboard": "spacetime generate --lang typescript --out-dir apps/canvas-dashboard/src/module_bindings --module-path ./spacetime",
    "stdb:generate:preview":   "spacetime generate --lang typescript --out-dir apps/preview-server/src/module_bindings --module-path ./spacetime",
    "stdb:deploy":    "npm run stdb:publish && npm run stdb:generate",
    "docker:up":      "docker compose -f docker-compose.yml -f docker-compose.dev.yml up",
    "docker:down":    "docker compose down",
    "docker:logs":    "docker compose logs -f"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev":   { "cache": false, "persistent": true },
    "lint":  {}
  }
}
```

### spacetime.json

```json
{
  "dev": { "run": "npm run dev" }
}
```

---

## 4. Tenant Scoping — The Core Rule

**Every SpacetimeDB subscription, MySQL query, AI tool call, and MCP call MUST include `tenant_id`. No exceptions. One tenant's data never touches another's.**

```typescript
// Tenant object passed through every request
interface Tenant {
  id:     string;   // "store_001"
  name:   string;   // "My Store"
  domain: string;   // "mystore.selorax.com"
  plan:   string;   // "starter" | "pro" | "enterprise"
}
```

### Express Middleware

```typescript
// apps/canvas-backend/src/middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.MVP_MODE === 'true') {
    (req as any).tenant = {
      id:     process.env.TENANT_ID!,
      name:   process.env.TENANT_NAME!,
      domain: process.env.TENANT_DOMAIN!,
      plan:   process.env.TENANT_PLAN ?? 'pro',
    };
    return next();
  }
  // Production: resolve from JWT header
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'Tenant required' });
  // ... lookup from DB
}

export const getTenant = (req: Request): Tenant => (req as any).tenant;
```

### Next.js Middleware (canvas-dashboard)

```typescript
// apps/canvas-dashboard/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.MVP_MODE === 'true') {
    res.headers.set('x-tenant-id',   process.env.TENANT_ID!);
    res.headers.set('x-tenant-name', process.env.TENANT_NAME!);
    res.headers.set('x-tenant-plan', process.env.TENANT_PLAN ?? 'pro');
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### SpacetimeDB Subscriptions — ALWAYS Filtered by Tenant

```typescript
// ✅ Correct — always tenant + page scoped
ctx.subscriptionBuilder().subscribe([
  tables.canvas_node.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ),
  tables.active_cursor.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ),
]);

// ❌ NEVER do this — exposes all tenants' data
ctx.subscriptionBuilder().subscribeToAllTables();
```

---

## 5. SpacetimeDB Module

This file IS your entire real-time backend. Deploy it to Maincloud. Every table and reducer becomes a typed client binding after `spacetime generate`.

```typescript
// spacetime/src/module.ts
// Deploy:   spacetime publish --server maincloud selorax-canvas
// Bindings: npm run stdb:generate

import { schema, table, t } from 'spacetimedb/server';

export const spacetimedb = schema(

  // ── Canvas Nodes ────────────────────────────────────────────
  // One row per canvas node. Flat — tree rebuilt client-side with buildTree().
  // SpacetimeDB broadcasts row-level diffs — surgical real-time updates.
  table(
    {
      name: 'canvas_node',
      public: true,
      indexes: [
        { name: 'idx_page',        algorithm: 'btree', columns: ['page_id'] },
        { name: 'idx_parent',      algorithm: 'btree', columns: ['parent_id'] },
        { name: 'idx_page_tenant', algorithm: 'btree', columns: ['page_id', 'tenant_id'] },
      ],
    },
    {
      id:                t.string().primaryKey(),
      page_id:           t.string(),
      tenant_id:         t.string(),        // isolation key — always present
      node_type:         t.string(),        // 'layout' | 'element' | 'component' | 'slot'
      parent_id:         t.string().nullable(),
      order:             t.string(),        // fractional index e.g. "a0", "a1", "a0V"
      styles:            t.string(),        // JSON — ResponsiveStyles
      props:             t.string(),        // JSON — ElementProps
      settings:          t.string(),        // JSON — ComponentSettings
      children_ids:      t.string(),        // JSON — string[]
      component_url:     t.string().nullable(),
      component_id:      t.string().nullable(),
      component_version: t.string().nullable(),
      locked_by:         t.string().nullable(),
      locked_at:         t.u64().nullable(),
      updated_by:        t.string(),
      updated_at:        t.u64(),
    }
  ),

  // ── Active Cursors ──────────────────────────────────────────
  // One row per connected user. Shows live collaboration presence.
  // Deleted on disconnect. AI gets its own cursor (user_type: 'ai').
  table(
    {
      name: 'active_cursor',
      public: true,
      indexes: [
        { name: 'idx_page',   algorithm: 'btree', columns: ['page_id'] },
        { name: 'idx_tenant', algorithm: 'btree', columns: ['tenant_id'] },
      ],
    },
    {
      user_id:          t.string().primaryKey(),
      page_id:          t.string(),
      tenant_id:        t.string(),
      x:                t.f32(),
      y:                t.f32(),
      selected_node_id: t.string().nullable(),
      hovered_node_id:  t.string().nullable(),
      user_name:        t.string(),
      user_color:       t.string(),
      user_type:        t.string(),         // 'human' | 'ai'
      user_avatar:      t.string().nullable(),
      last_seen:        t.u64(),
    }
  ),

  // ── AI Operations ───────────────────────────────────────────
  // One row per AI agent invocation. Progress streamed in real-time.
  // All canvas clients see AI status live via subscription.
  table(
    {
      name: 'ai_operation',
      public: true,
      indexes: [
        { name: 'idx_page',   algorithm: 'btree', columns: ['page_id'] },
        { name: 'idx_tenant', algorithm: 'btree', columns: ['tenant_id'] },
      ],
    },
    {
      id:              t.string().primaryKey(),
      page_id:         t.string(),
      tenant_id:       t.string(),
      status:          t.string(),    // 'thinking'|'planning'|'building'|'applying'|'done'|'error'
      prompt:          t.string(),
      current_action:  t.string(),    // live status text shown on canvas
      progress:        t.u8(),        // 0–100
      plan:            t.string().nullable(),
      nodes_created:   t.string(),    // JSON string[]
      nodes_modified:  t.string(),    // JSON string[]
      nodes_deleted:   t.string(),    // JSON string[]
      error_message:   t.string().nullable(),
      started_at:      t.u64(),
      completed_at:    t.u64().nullable(),
    }
  ),

  // ── Component Builds ────────────────────────────────────────
  // One row per AI-generated component. preview_code streamed live chunk by chunk.
  table(
    {
      name: 'component_build',
      public: true,
      indexes: [
        { name: 'idx_op',     algorithm: 'btree', columns: ['operation_id'] },
        { name: 'idx_tenant', algorithm: 'btree', columns: ['tenant_id'] },
      ],
    },
    {
      id:            t.string().primaryKey(),
      tenant_id:     t.string(),
      operation_id:  t.string(),
      status:        t.string(),      // 'generating'|'compiling'|'uploading'|'ready'|'error'
      description:   t.string(),
      progress:      t.u8(),
      preview_code:  t.string().nullable(),   // appended chunk by chunk
      compiled_url:  t.string().nullable(),
      component_id:  t.string().nullable(),
      created_at:    t.u64(),
      completed_at:  t.u64().nullable(),
    }
  ),

);

// ── Reducers ────────────────────────────────────────────────────────
// Reducers are the ONLY way to write data. They run as atomic transactions.
// Clients call via generated bindings: conn.reducers.insert_node(...)

spacetimedb.reducer('insert_node', {
  id: t.string(), page_id: t.string(), tenant_id: t.string(),
  node_type: t.string(), parent_id: t.string().nullable(), order: t.string(),
  styles: t.string(), props: t.string(), settings: t.string(), children_ids: t.string(),
  component_url: t.string().nullable(), component_id: t.string().nullable(),
  component_version: t.string().nullable(),
}, (ctx, args) => {
  ctx.db.canvas_node.insert({
    ...args,
    locked_by: null, locked_at: null,
    updated_by: ctx.sender.toHexString(),
    updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('update_node_styles', {
  node_id: t.string(), styles: t.string(),   // JSON patch — deep merged
}, (ctx, { node_id, styles }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.styles || '{}'), ...JSON.parse(styles) };
  ctx.db.canvas_node.id.update({
    ...node, styles: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('update_node_props', {
  node_id: t.string(), props: t.string(),
}, (ctx, { node_id, props }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.props || '{}'), ...JSON.parse(props) };
  ctx.db.canvas_node.id.update({
    ...node, props: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('update_node_settings', {
  node_id: t.string(), settings: t.string(),
}, (ctx, { node_id, settings }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.settings || '{}'), ...JSON.parse(settings) };
  ctx.db.canvas_node.id.update({
    ...node, settings: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('move_node', {
  node_id: t.string(), new_parent_id: t.string(), new_order: t.string(),
}, (ctx, { node_id, new_parent_id, new_order }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  ctx.db.canvas_node.id.update({
    ...node, parent_id: new_parent_id, order: new_order,
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('delete_node_cascade', {
  node_id: t.string(),
}, (ctx, { node_id }) => {
  function cascade(id: string) {
    for (const child of ctx.db.canvas_node.iter()) {
      if (child.parent_id === id) cascade(child.id);
    }
    const node = ctx.db.canvas_node.id.find(id);
    if (node) ctx.db.canvas_node.id.delete(node);
  }
  cascade(node_id);
});

spacetimedb.reducer('lock_node', { node_id: t.string() }, (ctx, { node_id }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const caller = ctx.sender.toHexString();
  if (node.locked_by && node.locked_by !== caller) return;
  ctx.db.canvas_node.id.update({
    ...node, locked_by: caller, locked_at: BigInt(Date.now()),
    updated_by: caller, updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('unlock_node', { node_id: t.string() }, (ctx, { node_id }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  if (node.locked_by !== ctx.sender.toHexString()) return;
  ctx.db.canvas_node.id.update({
    ...node, locked_by: null, locked_at: null,
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

spacetimedb.reducer('upsert_cursor', {
  page_id: t.string(), tenant_id: t.string(),
  x: t.f32(), y: t.f32(),
  selected_node_id: t.string().nullable(), hovered_node_id: t.string().nullable(),
  user_name: t.string(), user_color: t.string(), user_type: t.string(),
  user_avatar: t.string().nullable(),
}, (ctx, args) => {
  const user_id  = ctx.sender.toHexString();
  const existing = ctx.db.active_cursor.user_id.find(user_id);
  const now      = BigInt(Date.now());
  if (existing) {
    ctx.db.active_cursor.user_id.update({ ...existing, ...args, user_id, last_seen: now });
  } else {
    ctx.db.active_cursor.insert({ ...args, user_id, last_seen: now });
  }
});

spacetimedb.reducer('move_cursor', {
  x: t.f32(), y: t.f32(),
  selected_node_id: t.string().nullable(), hovered_node_id: t.string().nullable(),
}, (ctx, args) => {
  const cursor = ctx.db.active_cursor.user_id.find(ctx.sender.toHexString());
  if (!cursor) return;
  ctx.db.active_cursor.user_id.update({ ...cursor, ...args, last_seen: BigInt(Date.now()) });
});

spacetimedb.reducer('remove_cursor', {}, ctx => {
  const cursor = ctx.db.active_cursor.user_id.find(ctx.sender.toHexString());
  if (cursor) ctx.db.active_cursor.user_id.delete(cursor);
});

spacetimedb.reducer('create_ai_operation', {
  id: t.string(), page_id: t.string(), tenant_id: t.string(), prompt: t.string(),
}, (ctx, args) => {
  ctx.db.ai_operation.insert({
    ...args, status: 'thinking', current_action: 'Understanding your request...',
    progress: 0, plan: null,
    nodes_created: '[]', nodes_modified: '[]', nodes_deleted: '[]',
    error_message: null, started_at: BigInt(Date.now()), completed_at: null,
  });
});

spacetimedb.reducer('update_ai_operation', {
  op_id: t.string(), status: t.string(), current_action: t.string(), progress: t.u8(),
}, (ctx, { op_id, status, current_action, progress }) => {
  const op = ctx.db.ai_operation.id.find(op_id);
  if (!op) return;
  const isDone = status === 'done' || status === 'error';
  ctx.db.ai_operation.id.update({
    ...op, status, current_action, progress,
    completed_at: isDone ? BigInt(Date.now()) : op.completed_at,
  });
});

spacetimedb.reducer('create_component_build', {
  id: t.string(), tenant_id: t.string(), operation_id: t.string(), description: t.string(),
}, (ctx, args) => {
  ctx.db.component_build.insert({
    ...args, status: 'generating', progress: 0,
    preview_code: null, compiled_url: null, component_id: null,
    created_at: BigInt(Date.now()), completed_at: null,
  });
});

spacetimedb.reducer('stream_component_code', {
  build_id: t.string(), code_chunk: t.string(),
}, (ctx, { build_id, code_chunk }) => {
  const build = ctx.db.component_build.id.find(build_id);
  if (!build) return;
  ctx.db.component_build.id.update({
    ...build, preview_code: (build.preview_code ?? '') + code_chunk,
  });
});

spacetimedb.reducer('update_component_build', {
  build_id: t.string(), status: t.string(), progress: t.u8(),
  compiled_url: t.string().nullable(), component_id: t.string().nullable(),
}, (ctx, { build_id, status, progress, compiled_url, component_id }) => {
  const build  = ctx.db.component_build.id.find(build_id);
  if (!build) return;
  const isDone = status === 'ready' || status === 'error';
  ctx.db.component_build.id.update({
    ...build, status, progress,
    compiled_url: compiled_url ?? build.compiled_url,
    component_id: component_id ?? build.component_id,
    completed_at: isDone ? BigInt(Date.now()) : build.completed_at,
  });
});
```

---

## 6. Codegen — Generating Client Bindings

After publishing or changing the module, regenerate bindings for all consumers.

```bash
# 1. Publish module to Maincloud
spacetime publish --server maincloud selorax-canvas

# 2. Generate bindings for canvas-backend (Node.js client — publish + AI tools)
spacetime generate \
  --lang typescript \
  --out-dir apps/canvas-backend/src/module_bindings \
  --module-path ./spacetime

# 3. Generate bindings for canvas-dashboard (browser — live editing)
spacetime generate \
  --lang typescript \
  --out-dir apps/canvas-dashboard/src/module_bindings \
  --module-path ./spacetime

# 4. Generate bindings for preview-server (Node.js — reads live nodes)
spacetime generate \
  --lang typescript \
  --out-dir apps/preview-server/src/module_bindings \
  --module-path ./spacetime
```

Or just run `make stdb-deploy` which does all of the above in one command.

**Generated folder structure (same for each app):**

```
src/module_bindings/
├── index.ts            ← DbConnection, tables, reducers, queries exports
├── canvas_node.ts      ← CanvasNode type + table accessor
├── active_cursor.ts    ← ActiveCursor type + table accessor
├── ai_operation.ts     ← AiOperation type + table accessor
├── component_build.ts  ← ComponentBuild type + table accessor
└── reducers.ts         ← Fully typed reducer callers
```

**Never edit files in `module_bindings/`. Regenerate instead.**

---

## 7. Service 1 — canvas-backend (Express)

**Stack:** Node.js + Express + TypeScript  
**Port:** 3001  
**Role:** REST APIs, Mastra AI agent, MCP server, publish pipeline.  
**Connects to:** MySQL, Redis, SpacetimeDB Maincloud (as Node.js client).

### File Structure

```
apps/canvas-backend/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    ← Express app entry
    ├── middleware/
    │   ├── tenant.ts               ← tenant resolution
    │   └── logger.ts
    ├── routes/
    │   ├── pages.ts                ← CRUD + publish
    │   ├── serve.ts                ← GET /api/serve (storefront API)
    │   ├── components.ts           ← registry CRUD
    │   ├── funnels.ts
    │   └── ai.ts                   ← AI agent trigger + stream
    ├── db/
    │   └── index.ts                ← PrismaClient singleton
    ├── module_bindings/            ← AUTO-GENERATED — never edit
    ├── spacetime/
    │   └── client.ts               ← Node.js STDB client helpers
    ├── redis/
    │   └── client.ts               ← ioredis
    ├── publish/
    │   └── index.ts                ← STDB → MySQL → Redis → CDN
    ├── cdn/
    │   └── upload.ts               ← DO Spaces
    ├── mastra/
    │   ├── index.ts                ← Mastra instance
    │   ├── agents/
    │   │   └── canvas-agent.ts     ← Claude-powered agent
    │   ├── tools/
    │   │   ├── index.ts            ← exports all tools
    │   │   ├── get-page-tree.ts    ← reads STDB nodes + buildTree()
    │   │   ├── get-node.ts
    │   │   ├── find-nodes.ts
    │   │   ├── insert-node.ts      ← calls STDB reducer
    │   │   ├── update-node-styles.ts
    │   │   ├── update-node-props.ts
    │   │   ├── update-node-settings.ts
    │   │   ├── move-node.ts
    │   │   ├── delete-node.ts
    │   │   ├── search-components.ts
    │   │   ├── get-component.ts
    │   │   ├── build-component.ts
    │   │   ├── inject-component.ts
    │   │   ├── list-pages.ts
    │   │   ├── publish-page.ts
    │   │   └── get-analytics.ts
    │   └── mcp/
    │       └── server.ts           ← MCPServer (Claude Desktop, Cursor)
    └── utils/
        ├── tree.ts                 ← buildTree(), flattenTree()
        └── order.ts                ← fractional indexing
```

### src/index.ts

```typescript
import express   from 'express';
import cors      from 'cors';
import { tenantMiddleware } from './middleware/tenant';
import pagesRouter      from './routes/pages';
import serveRouter      from './routes/serve';
import componentsRouter from './routes/components';
import funnelsRouter    from './routes/funnels';
import aiRouter         from './routes/ai';
import { mastra }       from './mastra';

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({
  status: 'ok', service: 'canvas-backend',
  tenant:   process.env.TENANT_ID ?? 'dynamic',
  mvpMode:  process.env.MVP_MODE === 'true',
  stdb:     process.env.SPACETIMEDB_URL,
}));

app.use('/api/pages',      tenantMiddleware, pagesRouter);
app.use('/api/serve',      serveRouter);           // public — no tenant middleware
app.use('/api/components', tenantMiddleware, componentsRouter);
app.use('/api/funnels',    tenantMiddleware, funnelsRouter);
app.use('/api/ai',         tenantMiddleware, aiRouter);

// MCP endpoint
app.all('/mcp', async (req, res) => {
  const mcp      = mastra.getMCPServer('seloraxMcp');
  const response = await mcp.handleRequest(req);
  res.status(response.status).json(response.body);
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   SeloraX Canvas Backend                ║
║   Port:   ${PORT}                           ║
║   Tenant: ${process.env.TENANT_ID ?? 'dynamic'}               ║
║   STDB:   ${process.env.SPACETIMEDB_URL} ║
╚══════════════════════════════════════════╝`);
});
```

### src/spacetime/client.ts

```typescript
// Node.js SpacetimeDB client — used by publish pipeline + AI tools
import { DbConnection, tables } from '../module_bindings';

const STDB_URL  = process.env.SPACETIMEDB_URL!;
const STDB_NAME = process.env.SPACETIMEDB_DB_NAME!;

export type CanvasNode = import('../module_bindings/canvas_node').CanvasNode;

// Read all flat nodes for a page (one-shot — connects, fetches, disconnects)
export async function getPageNodes(pageId: string, tenantId: string): Promise<CanvasNode[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SpacetimeDB timeout')), 10_000);
    DbConnection.builder()
      .withUri(STDB_URL).withDatabaseName(STDB_NAME)
      .onConnect(ctx => {
        ctx.subscriptionBuilder()
          .onApplied(() => {
            const nodes = Array.from(ctx.db.canvas_node.iter())
              .filter(n => n.page_id === pageId && n.tenant_id === tenantId);
            clearTimeout(timer);
            ctx.disconnect();
            resolve(nodes);
          })
          .subscribe([tables.canvas_node.where(r =>
            r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
          )]);
      })
      .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
      .build();
  });
}

// Call a reducer from Express (used by AI tools)
export async function callReducer(
  name: keyof import('../module_bindings').Reducers,
  args: Record<string, any>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Reducer timeout')), 5_000);
    DbConnection.builder()
      .withUri(STDB_URL).withDatabaseName(STDB_NAME)
      .onConnect(ctx => {
        (ctx.reducers as any)[name](args);
        setTimeout(() => { clearTimeout(timer); ctx.disconnect(); resolve(); }, 300);
      })
      .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
      .build();
  });
}
```

### src/publish/index.ts

```typescript
import { prisma }        from '../db';
import { redis }         from '../redis/client';
import { getPageNodes }  from '../spacetime/client';
import { buildTree }     from '../utils/tree';
import { createHash }    from 'crypto';

export async function publishPage(pageId: string, tenantId: string) {
  // 1. Verify ownership
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
  });
  if (!page) throw new Error('Page not found or access denied');

  // 2. Read live nodes from SpacetimeDB Maincloud
  const flatNodes = await getPageNodes(pageId, tenantId);
  if (!flatNodes.length) throw new Error('No nodes — open canvas editor first');

  // 3. Build + serialize
  const tree     = buildTree(flatNodes);
  const clean    = stripCanvasMetadata(tree);
  const treeJson = JSON.stringify(clean);
  const treeHash = createHash('sha256').update(treeJson).digest('hex');

  // 4. Dedup — same content?
  const existing = await prisma.pageVersion.findFirst({
    where: { pageId, treeHash },
  });

  let versionId: string;

  if (existing) {
    versionId = existing.id;
  } else {
    // 5. Save new immutable version
    const version = await prisma.pageVersion.create({
      data: { pageId, tenantId, tree: treeJson, treeHash, publishedBy: 'system' },
    });
    versionId = version.id;
  }

  // 6. Update page pointer
  await prisma.page.update({
    where: { id: pageId },
    data:  { publishedVersionId: versionId, publishedAt: new Date() },
  });

  // 7. Warm Redis cache
  const cacheKey = `serve:${tenantId}:${page.pageType}:${page.slug}`;
  await redis.set(cacheKey, JSON.stringify({
    tree: clean, versionId, updatedAt: new Date().toISOString(),
  }), 'EX', 3600);

  // 8. Purge Cloudflare (if configured)
  if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: [`tenant-${tenantId}`, `page-${pageId}`] }),
      }
    );
  }

  console.log(`[publish] ${pageId} → version ${versionId} (tenant: ${tenantId})`);
  return { id: versionId, pageId, tenantId, publishedAt: new Date() };
}

function stripCanvasMetadata(node: any): any {
  const { lockedBy, lockedAt, updatedBy, updatedAt, ...clean } = node;
  if (clean.children) clean.children = clean.children.map(stripCanvasMetadata);
  return clean;
}
```

### src/routes/serve.ts

```typescript
// Production serving API — storefront calls this for page JSON trees
// Public — no tenant middleware. tenantId is in the URL.
import { Router } from 'express';
import { prisma } from '../db';
import { redis }  from '../redis/client';

const router = Router();

// GET /api/serve/:tenantId/:pageType/:slug
router.get('/:tenantId/:pageType/:slug', async (req, res) => {
  const { tenantId, pageType, slug } = req.params;

  // 1. Redis (fast path)
  const cacheKey = `serve:${tenantId}:${pageType}:${slug}`;
  const cached   = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.json(JSON.parse(cached));
  }

  // 2. MySQL (slow path)
  const page = await prisma.page.findFirst({
    where: {
      tenantId, pageType, slug,
      publishedVersionId: { not: null },
    },
  });
  if (!page) return res.status(404).json({ error: 'Not found or not published' });

  const version = await prisma.pageVersion.findUnique({
    where: { id: page.publishedVersionId! },
  });
  if (!version) return res.status(404).json({ error: 'Version not found' });

  const payload = { tree: JSON.parse(version.tree), versionId: version.id };

  // 3. Populate cache
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);

  res.setHeader('X-Cache', 'MISS');
  res.json(payload);
});

// GET /api/serve/:tenantId/pages — list all published pages (for storefront routing)
router.get('/:tenantId/pages', async (req, res) => {
  const pages = await prisma.page.findMany({
    where: {
      tenantId: req.params.tenantId,
      publishedVersionId: { not: null },
    },
    select: { id: true, slug: true, pageType: true, title: true },
  });
  res.json(pages);
});

export default router;
```

### src/routes/ai.ts

```typescript
import { Router }      from 'express';
import { getTenant }   from '../middleware/tenant';
import { mastra }      from '../mastra';
import { callReducer } from '../spacetime/client';
import { nanoid }      from 'nanoid';

const router = Router();

// POST /api/ai/canvas — trigger canvas agent, stream response
router.post('/canvas', async (req, res) => {
  const tenant = getTenant(req);
  const { prompt, page_id, selected_node_id } = req.body;

  if (!prompt || !page_id)
    return res.status(400).json({ error: 'prompt and page_id required' });

  // Create AI operation in SpacetimeDB — all canvas clients see it instantly
  const op_id = nanoid();
  await callReducer('create_ai_operation', {
    id: op_id, page_id, tenant_id: tenant.id, prompt,
  });

  // Stream response
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Operation-Id', op_id);

  const agent = mastra.getAgent('canvasAgent');

  try {
    const stream = await agent.stream(
      `Tenant ID: ${tenant.id}\nPage ID: ${page_id}\n` +
      (selected_node_id ? `Selected node: ${selected_node_id}\n` : '') +
      `User request: ${prompt}`,
      { runtimeContext: { op_id, tenant_id: tenant.id, page_id } }
    );
    for await (const chunk of stream.textStream) res.write(chunk);
  } finally {
    res.end();
  }
});

export default router;
```

### src/mastra/tools/get-page-tree.ts

```typescript
import { createTool }   from '@mastra/core/tools';
import { z }            from 'zod';
import { getPageNodes } from '../../spacetime/client';
import { buildTree }    from '../../utils/tree';

export const getPageTreeTool = createTool({
  id: 'get_page_tree',
  description: 'Get page as nested tree. ALWAYS call this first before making edits.',
  inputSchema:  z.object({
    tenant_id: z.string().describe('Tenant ID — required'),
    page_id:   z.string().describe('Page ID to fetch'),
  }),
  outputSchema: z.object({ tree: z.any(), node_count: z.number() }),
  execute: async ({ context }) => {
    const flatNodes = await getPageNodes(context.page_id, context.tenant_id);
    return { tree: buildTree(flatNodes), node_count: flatNodes.length };
  },
});
```

### src/mastra/tools/insert-node.ts

```typescript
import { createTool }    from '@mastra/core/tools';
import { z }             from 'zod';
import { nanoid }        from 'nanoid';
import { callReducer }   from '../../spacetime/client';

export const insertNodeTool = createTool({
  id: 'insert_node',
  description: 'Insert a new node. Changes appear live on canvas instantly.',
  inputSchema: z.object({
    tenant_id:         z.string(),
    page_id:           z.string(),
    parent_id:         z.string(),
    position:          z.string().describe('"first" | "last" | "after:<nodeId>"'),
    node_type:         z.enum(['layout', 'element', 'component', 'slot']),
    styles:            z.record(z.any()).optional(),
    props:             z.record(z.any()).optional(),
    settings:          z.record(z.any()).optional(),
    component_id:      z.string().optional(),
    component_url:     z.string().optional(),
    component_version: z.string().optional(),
  }),
  outputSchema: z.object({ node_id: z.string(), message: z.string() }),
  execute: async ({ context }) => {
    const id = nanoid();
    await callReducer('insert_node', {
      id,
      page_id:           context.page_id,
      tenant_id:         context.tenant_id,
      parent_id:         context.parent_id,
      order:             resolveOrder(context.position),
      node_type:         context.node_type,
      styles:            JSON.stringify(context.styles    ?? {}),
      props:             JSON.stringify(context.props     ?? {}),
      settings:          JSON.stringify(context.settings  ?? {}),
      children_ids:      '[]',
      component_id:      context.component_id      ?? null,
      component_url:     context.component_url     ?? null,
      component_version: context.component_version ?? null,
    });
    return { node_id: id, message: 'Node inserted — visible on canvas now' };
  },
});

function resolveOrder(position: string): string {
  if (position === 'first') return 'a0';
  if (position === 'last')  return `z${Date.now().toString(36)}`;
  return `m${Date.now().toString(36)}`;
}
```

### src/mastra/agents/canvas-agent.ts

```typescript
import { Agent }     from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';
import * as tools    from '../tools';

export const canvasAgent = new Agent({
  id:   'canvas-agent',
  name: 'SeloraX Canvas Agent',
  model: anthropic('claude-sonnet-4-6'),

  instructions: `
    You are an expert e-commerce designer operating the SeloraX visual canvas.
    Your edits appear live on screen for all collaborators instantly.

    CRITICAL RULES:
    - ALWAYS scope every operation to the tenant_id in the request. Never cross tenants.
    - ALWAYS call get_page_tree FIRST before making any changes.
    - ALWAYS call search_components BEFORE build_component — reuse existing ones.
    - NEVER publish without explicit user confirmation.
    - Make surgical edits — only change what was asked.

    NODE TYPES:
    - layout:    flex/grid/block containers
    - element:   text, heading, image, button, video, divider
    - component: ESM components from registry
    - slot:      named placeholders for dynamic content

    STYLE PATTERNS:
    - Responsive: { "padding": "60px", "_sm": { "padding": "20px" } }
    - Hover:      { "background": "#000", "_hover": { "opacity": "0.8" } }
    - Tokens:     { "content": "Welcome to {{store.name}}" }

    POSITIONS: "first" | "last" | "after:<nodeId>"

    E-COMMERCE PRINCIPLES:
    - One clear primary CTA per section
    - Social proof near conversion points
    - Mobile-first — always add _sm overrides
    - Urgency elements above the fold

    When done, briefly summarize what changed and why.
  `,

  tools: {
    getPageTree:        tools.getPageTreeTool,
    getNode:            tools.getNodeTool,
    getNodeChildren:    tools.getNodeChildrenTool,
    findNodes:          tools.findNodesTool,
    insertNode:         tools.insertNodeTool,
    updateNodeStyles:   tools.updateNodeStylesTool,
    updateNodeProps:    tools.updateNodePropsTool,
    updateNodeSettings: tools.updateNodeSettingsTool,
    moveNode:           tools.moveNodeTool,
    deleteNode:         tools.deleteNodeTool,
    searchComponents:   tools.searchComponentsTool,
    getComponent:       tools.getComponentTool,
    buildComponent:     tools.buildComponentTool,
    injectComponent:    tools.injectComponentTool,
    listPages:          tools.listPagesTool,
    publishPage:        tools.publishPageTool,
    getAnalytics:       tools.getAnalyticsTool,
  },
});
```

### src/mastra/mcp/server.ts

```typescript
import { MCPServer }   from '@mastra/mcp';
import * as tools      from '../tools';
import { canvasAgent } from '../agents/canvas-agent';

// tenant_id is REQUIRED in every tool — enforces isolation across tenants
export const seloraxMcp = new MCPServer({
  name: 'selorax-canvas', version: '1.0.0',
  tools: {
    getPageTree: tools.getPageTreeTool, getNode: tools.getNodeTool,
    getNodeChildren: tools.getNodeChildrenTool, findNodes: tools.findNodesTool,
    insertNode: tools.insertNodeTool, updateNodeStyles: tools.updateNodeStylesTool,
    updateNodeProps: tools.updateNodePropsTool, updateNodeSettings: tools.updateNodeSettingsTool,
    moveNode: tools.moveNodeTool, deleteNode: tools.deleteNodeTool,
    searchComponents: tools.searchComponentsTool, getComponent: tools.getComponentTool,
    buildComponent: tools.buildComponentTool, injectComponent: tools.injectComponentTool,
    listPages: tools.listPagesTool, publishPage: tools.publishPageTool,
    getAnalytics: tools.getAnalyticsTool,
  },
  agents: { canvasAgent },
});
```

### src/mastra/index.ts

```typescript
import { Mastra }      from '@mastra/core/mastra';
import { canvasAgent } from './agents/canvas-agent';
import { seloraxMcp }  from './mcp/server';

export const mastra = new Mastra({
  agents: { canvasAgent },
  mcpServers: { seloraxMcp },
});
```

### src/utils/tree.ts

```typescript
export interface FlatNode {
  id: string; page_id: string; tenant_id: string;
  node_type: string; parent_id: string | null; order: string;
  styles: string; props: string; settings: string; children_ids: string;
  component_url?: string | null; component_id?: string | null; component_version?: string | null;
}

export function buildTree(flatNodes: FlatNode[]): any {
  const map = new Map<string, any>();
  for (const n of flatNodes) {
    map.set(n.id, {
      id: n.id, type: n.node_type, _order: n.order,
      styles:   safeJson(n.styles,   {}),
      props:    safeJson(n.props,    {}),
      settings: safeJson(n.settings, {}),
      children: [],
      url:              n.component_url    ?? undefined,
      componentId:      n.component_id     ?? undefined,
      componentVersion: n.component_version ?? undefined,
    });
  }

  let root: any = null;
  for (const n of flatNodes) {
    const treeNode = map.get(n.id)!;
    if (!n.parent_id) { root = treeNode; }
    else { map.get(n.parent_id)?.children.push(treeNode); }
  }

  function sort(node: any) {
    if (!node) return;
    node.children.sort((a: any, b: any) => a._order.localeCompare(b._order));
    node.children.forEach(sort);
  }
  sort(root);

  function clean(node: any): any {
    if (!node) return null;
    const { _order, ...rest } = node;
    rest.children = rest.children.map(clean);
    return rest;
  }

  return clean(root);
}

function safeJson(s: string, fallback: any) {
  try { return JSON.parse(s); } catch { return fallback; }
}
```

---

## 8. Service 2 — canvas-dashboard (Next.js)

**Stack:** Next.js 14 (App Router)  
**Port:** 3002  
**Role:** Theme builder UI. Browser connects DIRECTLY to SpacetimeDB Maincloud via WebSocket.

### File Structure

```
apps/canvas-dashboard/
├── Dockerfile
├── package.json
├── next.config.ts
├── middleware.ts                      ← injects tenant from ENV
└── src/
    ├── module_bindings/               ← AUTO-GENERATED
    ├── utils/tree.ts                  ← buildTree()
    └── app/
        ├── layout.tsx
        └── canvas/
            └── [pageId]/
                ├── page.tsx           ← server component — passes tenant to client
                └── components/
                    ├── CanvasPage.tsx ← 'use client' — SpacetimeDB connection
                    ├── Canvas.tsx     ← renders tree, handles selection
                    ├── CanvasNode.tsx ← recursive node renderer
                    ├── panels/
                    │   ├── LeftPanel.tsx    ← layers + components
                    │   ├── RightPanel.tsx   ← style + settings editor
                    │   ├── LayersTree.tsx
                    │   └── StyleEditor.tsx
                    ├── toolbar/
                    │   ├── Toolbar.tsx
                    │   ├── DeviceToggle.tsx
                    │   └── PublishButton.tsx
                    └── ai/
                        ├── AIBar.tsx            ← prompt input
                        ├── AIStatusBar.tsx      ← live op status (from STDB)
                        └── ComponentBuildPanel.tsx
```

### app/canvas/[pageId]/page.tsx — Server Component

```typescript
import { headers } from 'next/headers';
import CanvasPage  from './components/CanvasPage';

export default async function CanvasRoute({ params }: { params: { pageId: string } }) {
  const headersList = await headers();
  const tenantId    = headersList.get('x-tenant-id')!;
  const tenantName  = headersList.get('x-tenant-name') ?? 'My Store';
  return <CanvasPage pageId={params.pageId} tenantId={tenantId} tenantName={tenantName} />;
}
```

### components/CanvasPage.tsx — Client Component (Direct SpacetimeDB)

```typescript
'use client';
import { useEffect, useState }       from 'react';
import { DbConnection, tables }      from '@/module_bindings';
import { useTable }                  from 'spacetimedb/react';
import { buildTree }                 from '@/utils/tree';
import Canvas       from './Canvas';
import LeftPanel    from './panels/LeftPanel';
import RightPanel   from './panels/RightPanel';
import Toolbar      from './toolbar/Toolbar';
import AIBar        from './ai/AIBar';
import AIStatusBar  from './ai/AIStatusBar';

export default function CanvasPage({
  pageId, tenantId, tenantName,
}: { pageId: string; tenantId: string; tenantName: string }) {
  const [conn,       setConn]       = useState<DbConnection | null>(null);
  const [connected,  setConnected]  = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Direct WebSocket connection to SpacetimeDB Maincloud — from the browser
  useEffect(() => {
    const connection = DbConnection.builder()
      .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URL!)
      .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB!)
      .onConnect(ctx => {
        setConnected(true);
        // Subscribe ONLY to this tenant's page — never globally
        ctx.subscriptionBuilder()
          .onApplied(() => console.log('[STDB] Canvas ready'))
          .subscribe([
            tables.canvas_node.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.active_cursor.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.ai_operation.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.component_build.where(r =>
              r.tenant_id.eq(tenantId)
            ),
          ]);
      })
      .onDisconnect(() => setConnected(false))
      .build();

    setConn(connection);
    return () => connection.disconnect();
  }, [pageId, tenantId]);

  // useTable — live React state, auto-updates on any row change
  const [flatNodes]  = useTable(tables.canvas_node.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));
  const [cursors]    = useTable(tables.active_cursor.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));
  const [aiOps]      = useTable(tables.ai_operation.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));

  const tree       = flatNodes.length > 0 ? buildTree(flatNodes) : null;
  const activeAiOp = aiOps.find(op => op.status !== 'done' && op.status !== 'error');
  const selectedNode = flatNodes.find(n => n.id === selectedId) ?? null;

  if (!connected) return (
    <div className="canvas-loading">
      <div className="spinner" />
      <p>Connecting to SpacetimeDB...</p>
    </div>
  );

  return (
    <div className="canvas-layout">
      <Toolbar conn={conn} pageId={pageId} tenantId={tenantId} tenantName={tenantName} />
      <div className="canvas-body">
        <LeftPanel flatNodes={flatNodes} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="canvas-area">
          {activeAiOp && <AIStatusBar operation={activeAiOp} />}
          <Canvas
            tree={tree} cursors={cursors}
            selectedId={selectedId} onSelect={setSelectedId} conn={conn}
          />
          <AIBar
            conn={conn} pageId={pageId}
            tenantId={tenantId} selectedNodeId={selectedId}
          />
        </div>
        <RightPanel node={selectedNode} conn={conn} tenantId={tenantId} />
      </div>
    </div>
  );
}
```

### components/ai/AIBar.tsx

```typescript
'use client';
import { useState } from 'react';
import type { DbConnection } from '@/module_bindings';

const EXAMPLES = [
  'Make the hero section more premium and dark',
  'Add a countdown timer above the buy button',
  'Add social proof and trust badges',
  'Make this page mobile-friendly',
  'Build an urgency section with live stock counter',
];

export default function AIBar({
  conn, pageId, tenantId, selectedNodeId,
}: { conn: DbConnection | null; pageId: string; tenantId: string; selectedNodeId: string | null }) {
  const [prompt,  setPrompt]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/ai/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, page_id: pageId, tenant_id: tenantId, selected_node_id: selectedNodeId }),
    });

    // Stream tokens — actual canvas updates come via SpacetimeDB subscription
    const reader = res.body?.getReader();
    if (reader) {
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        dec.decode(value); // tokens stream but STDB shows real progress
      }
    }

    setPrompt('');
    setLoading(false);
  }

  return (
    <div className="ai-bar">
      <span className="ai-bar-icon">✨</span>
      <div className="ai-bar-input-wrap">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          placeholder="Describe what you want to change..."
          disabled={loading}
        />
        {!prompt && !loading && (
          <div className="ai-examples">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setPrompt(ex)} className="ai-chip">{ex}</button>
            ))}
          </div>
        )}
      </div>
      <button onClick={handleSubmit} disabled={loading || !prompt.trim()} className="ai-submit">
        {loading ? '⋯' : '→'}
      </button>
    </div>
  );
}
```

### components/ai/AIStatusBar.tsx

```typescript
'use client';
// Data comes from SpacetimeDB subscription — auto-updates in real-time
import type { AiOperation } from '@/module_bindings/ai_operation';

const STATUS_COLORS: Record<string, string> = {
  thinking: '#7C3AED', planning: '#2563EB', building: '#059669',
  applying: '#D97706', done: '#16A34A',    error: '#DC2626',
};

export default function AIStatusBar({ operation }: { operation: AiOperation }) {
  const color = STATUS_COLORS[operation.status] ?? '#7C3AED';
  return (
    <div className="ai-status-bar" style={{ borderColor: color }}>
      <span className="ai-dot" style={{
        background: color,
        animation: operation.status !== 'done' ? 'pulse 1s infinite' : 'none',
      }} />
      <span className="ai-action">{operation.current_action}</span>
      <div className="ai-progress-track">
        <div className="ai-progress-fill" style={{ width: `${operation.progress}%`, background: color }} />
      </div>
      <span className="ai-pct">{operation.progress}%</span>
    </div>
  );
}
```

---

## 9. Service 3 — storefront (Next.js)

**Stack:** Next.js 14  
**Port:** 3003  
**Role:** Customer-facing renderer. Calls Express REST → renders JSON tree. **SpacetimeDB NOT used here.**

### app/[[...slug]]/page.tsx

```typescript
import { PageRenderer } from '@selorax/renderer';

const BACKEND = process.env.BACKEND_URL!;

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const slug     = params.slug ?? [];
  const tenantId = process.env.TENANT_ID!;
  const { pageType, pagSlug } = resolvePageType(slug);

  const res = await fetch(`${BACKEND}/api/serve/${tenantId}/${pageType}/${pagSlug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return <div style={{ padding: 40 }}>Page not found</div>;

  const { tree } = await res.json();
  const data = { store: { name: process.env.TENANT_NAME ?? 'My Store' }, device: 'desktop' };

  return <PageRenderer tree={tree} data={data} />;
}

function resolvePageType(slug: string[]) {
  if (!slug.length)            return { pageType: 'home',    pagSlug: 'index' };
  if (slug[0] === 'products')  return { pageType: 'product', pagSlug: slug[1] ?? '' };
  if (slug[0] === 'pages')     return { pageType: 'custom',  pagSlug: slug[1] ?? '' };
  return { pageType: 'custom', pagSlug: slug.join('/') };
}
```

---

## 10. Service 4 — preview-server (Next.js)

**Stack:** Next.js 14  
**Port:** 3004  
**Role:** Pre-publish preview. Reads LIVE SpacetimeDB nodes (not published MySQL snapshot).  
Merchant sees exactly what will go live before clicking Publish.

```typescript
// apps/preview-server/app/[pageId]/page.tsx
import { DbConnection, tables } from '@/module_bindings';
import { PageRenderer }         from '@selorax/renderer';
import { buildTree }            from '@/utils/tree';

export default async function PreviewPage({
  params, searchParams,
}: { params: { pageId: string }; searchParams: { tenantId?: string } }) {
  const pageId   = params.pageId;
  const tenantId = searchParams.tenantId ?? process.env.TENANT_ID!;

  // One-shot: connect → subscribe → get nodes → disconnect
  const flatNodes = await new Promise<any[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview timeout')), 10_000);

    DbConnection.builder()
      .withUri(process.env.SPACETIMEDB_URL!)
      .withDatabaseName(process.env.SPACETIMEDB_DB!)
      .onConnect(ctx => {
        ctx.subscriptionBuilder()
          .onApplied(() => {
            const nodes = Array.from(ctx.db.canvas_node.iter())
              .filter(n => n.page_id === pageId && n.tenant_id === tenantId);
            clearTimeout(timer);
            ctx.disconnect();
            resolve(nodes);
          })
          .subscribe([tables.canvas_node.where(r =>
            r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
          )]);
      })
      .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
      .build();
  });

  if (!flatNodes.length) return <div>No nodes found. Open canvas editor first.</div>;

  const tree = buildTree(flatNodes);
  const data = { store: { name: process.env.TENANT_NAME ?? 'My Store' } };

  return (
    <>
      {/* Preview banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: '#7C3AED', color: '#fff', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16, fontSize: 14,
      }}>
        <span>⚠️ Preview — not published yet</span>
        <a href={`${process.env.DASHBOARD_URL}/canvas/${pageId}`}
           style={{ color: '#fff', textDecoration: 'underline' }}>
          ← Back to Editor
        </a>
        <form method="POST" action={`${process.env.BACKEND_URL}/api/pages/${pageId}/publish`}
              style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <button type="submit" style={{
            background: '#fff', color: '#7C3AED', border: 'none',
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          }}>
            Publish Now
          </button>
        </form>
      </div>
      <div style={{ marginTop: 40 }}>
        <PageRenderer tree={tree} data={data} />
      </div>
    </>
  );
}
```

---

## 11. Shared Packages

### @selorax/renderer — packages/renderer

Target: **< 15kb gzipped**. Works SSR + client. No canvas deps. Pure render.

```typescript
// packages/renderer/src/PageRenderer.tsx
'use client';
import { memo, useState, useEffect } from 'react';

const MODULE_CACHE = new Map<string, React.ComponentType<any>>();

export function PageRenderer({ tree, data }: { tree: any; data: any }) {
  return <RenderNode node={tree} data={data} />;
}

const RenderNode = memo(function RenderNode({ node, data }: any) {
  if (!node) return null;
  const styles = resolveStyles(node.styles, data?.device);

  switch (node.type) {
    case 'layout':
      return (
        <div style={styles} data-id={node.id}>
          {node.children?.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)}
        </div>
      );
    case 'element':   return <RenderElement   node={node} styles={styles} data={data} />;
    case 'component': return <RenderComponent node={node} styles={styles} data={data} />;
    case 'slot': {
      const content = data?.slots?.[node.name] ?? node.fallback ?? [];
      return (
        <div style={styles} data-slot={node.name}>
          {content.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)}
        </div>
      );
    }
    default: return null;
  }
});

function RenderElement({ node, styles, data }: any) {
  const props = node.props ?? {};
  const text  = (s: string) => resolveTokens(s ?? '', data);

  switch (props.tag) {
    case 'text':    return <p style={styles}>{text(props.content)}</p>;
    case 'heading': {
      const Tag = (props.level ?? 'h2') as 'h1';
      return <Tag style={styles}>{text(props.content)}</Tag>;
    }
    case 'image':   return <img src={props.src} alt={props.alt ?? ''} style={styles} />;
    case 'button':  return (
      <button style={styles} onClick={() => handleAction(props.action)}>
        {text(props.label)}
      </button>
    );
    case 'divider': return <hr style={styles} />;
    default:        return <div style={styles}>{props.content}</div>;
  }
}

function RenderComponent({ node, styles, data }: any) {
  const [Comp, setComp] = useState<any>(() => MODULE_CACHE.get(node.url) ?? null);

  useEffect(() => {
    if (MODULE_CACHE.has(node.url)) { setComp(() => MODULE_CACHE.get(node.url)!); return; }
    import(/* @vite-ignore */ node.url)
      .then(m => { MODULE_CACHE.set(node.url, m.default); setComp(() => m.default); })
      .catch(() => setComp(null));
  }, [node.url]);

  if (!Comp) return <div style={{ ...styles, minHeight: 60, background: '#f5f5f5', borderRadius: 4 }} />;
  return <div style={styles}><Comp settings={node.settings ?? {}} data={data} /></div>;
}

function resolveStyles(styles: any, device?: string): any {
  if (!styles) return {};
  const { _sm, _md, _lg, _hover, _active, _focus, ...base } = styles;
  if (device === 'mobile' && _sm) Object.assign(base, _sm);
  if (device === 'tablet' && _md) Object.assign(base, _md);
  return base;
}

function resolveTokens(value: string, data: any): string {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (_, path) =>
    path.trim().split('.').reduce((o: any, k: string) => o?.[k], data) ?? ''
  );
}

function handleAction(action: any) {
  if (!action) return;
  if (action.type === 'link') window.location.href = action.url;
}
```

---

## 12. Database Schema (MySQL — Prisma)

Separate canvas MySQL database — not shared with main SeloraX e-commerce DB.

### Setup

```bash
# Install
npm install prisma @prisma/client --save
npx prisma init --datasource-provider mysql

# After editing schema.prisma:
npx prisma migrate dev --name init       # dev (creates migration file + applies)
npx prisma migrate deploy                # prod (applies pending migrations)
npx prisma generate                      # regenerate PrismaClient after schema changes
```

### apps/canvas-backend/src/db/index.ts

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### prisma/schema.prisma

Place this file at `apps/canvas-backend/prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ── Pages ─────────────────────────────────────────────────────────────────────
model Page {
  id                 String    @id @default(cuid())
  tenantId           String    @map("tenant_id")
  slug               String
  pageType           String    @map("page_type")
  title              String?
  publishedVersionId String?   @map("published_version_id")
  metaTitle          String?   @map("meta_title")
  metaDescription    String?   @db.Text @map("meta_description")
  createdAt          DateTime  @default(now()) @map("created_at")
  publishedAt        DateTime? @map("published_at")

  versions     PageVersion[]
  experiments  Experiment[]
  funnelSteps  FunnelStep[]

  @@unique([tenantId, pageType, slug])
  @@index([tenantId])
  @@map("pages")
}

// Immutable snapshots — every publish creates a new row.
// Rollback = update Page.publishedVersionId pointer only. Never mutate tree.
model PageVersion {
  id          String    @id @default(cuid())
  pageId      String    @map("page_id")
  tenantId    String    @map("tenant_id")
  tree        String    @db.LongText           // full JSON tree — never mutated
  treeHash    String?   @map("tree_hash")      // sha256 for dedup
  publishedBy String?   @map("published_by")
  publishedAt DateTime? @default(now()) @map("published_at")

  page                Page                 @relation(fields: [pageId], references: [id])
  experimentVariants  ExperimentVariant[]

  @@index([pageId])
  @@index([pageId, treeHash])
  @@map("page_versions")
}

// ── Components ────────────────────────────────────────────────────────────────
// tenantId null = global marketplace component
model Component {
  id             String    @id @default(cuid())
  tenantId       String?   @map("tenant_id")
  name           String
  description    String?   @db.Text
  category       String?
  tags           String?   @db.Text             // JSON string[]
  schemaJson     String    @db.Text @map("schema_json")
  currentVersion String    @default("1.0.0") @map("current_version")
  currentUrl     String?   @map("current_url")
  origin         String    @default("dev")      // 'dev' | 'ai' | 'marketplace'
  isPublic       Boolean   @default(false) @map("is_public")
  aiPrompt       String?   @db.Text @map("ai_prompt")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  versions ComponentVersion[]

  @@index([tenantId])
  @@map("components")
}

// Source code always saved — AI needs it for future edits
model ComponentVersion {
  id            String   @id @default(cuid())
  componentId   String   @map("component_id")
  version       String
  sourceCode    String   @db.LongText @map("source_code")
  compiledUrl   String   @map("compiled_url")
  changeSummary String?  @db.Text @map("change_summary")
  aiPrompt      String?  @db.Text @map("ai_prompt")
  isStable      Boolean  @default(false) @map("is_stable")
  createdAt     DateTime @default(now()) @map("created_at")

  component Component @relation(fields: [componentId], references: [id])

  @@index([componentId])
  @@map("component_versions")
}

// ── Funnels ───────────────────────────────────────────────────────────────────
model Funnel {
  id          String    @id @default(cuid())
  tenantId    String    @map("tenant_id")
  name        String
  goal        String?
  status      String    @default("draft")  // 'draft' | 'live' | 'archived'
  aiGenerated Boolean   @default(false) @map("ai_generated")
  aiPrompt    String?   @db.Text @map("ai_prompt")
  createdAt   DateTime  @default(now()) @map("created_at")
  publishedAt DateTime? @map("published_at")

  steps FunnelStep[]

  @@index([tenantId])
  @@map("funnels")
}

model FunnelStep {
  id        String  @id @default(cuid())
  funnelId  String  @map("funnel_id")
  pageId    String  @map("page_id")
  stepOrder Int     @map("step_order")
  stepType  String? @map("step_type")
  name      String?
  onSuccess String  @db.Text @map("on_success")  // JSON action
  onSkip    String? @db.Text @map("on_skip")

  funnel Funnel @relation(fields: [funnelId], references: [id])
  page   Page   @relation(fields: [pageId], references: [id])

  @@index([funnelId])
  @@map("funnel_steps")
}

// ── Experiment Engine ─────────────────────────────────────────────────────────
model Experiment {
  id                  String    @id @default(cuid())
  tenantId            String    @map("tenant_id")
  pageId              String    @map("page_id")
  funnelId            String?   @map("funnel_id")
  name                String
  hypothesis          String?   @db.Text
  status              String    @default("draft")
  // 'draft' | 'running' | 'paused' | 'concluded' | 'archived'
  primaryMetric       String    @default("conversion_rate") @map("primary_metric")
  // 'conversion_rate' | 'revenue_per_visitor' | 'cta_click_rate' | 'scroll_depth'
  trafficMode         String    @default("sticky") @map("traffic_mode")
  minSampleSize       Int       @default(500) @map("min_sample_size")    // soft floor — informational
  analysisWindowDays  Int       @default(7) @map("analysis_window_days") // PRIMARY AI trigger
  confidenceThreshold Float     @default(0.95) @map("confidence_threshold")
  winnerVariantId     String?   @map("winner_variant_id")
  winnerReason        String?   @db.Text @map("winner_reason")
  startedAt           DateTime? @map("started_at")
  endedAt             DateTime? @map("ended_at")
  scheduledEndAt      DateTime? @map("scheduled_end_at")
  aiGenerated         Boolean   @default(false) @map("ai_generated")
  aiPrompt            String?   @db.Text @map("ai_prompt")
  createdAt           DateTime  @default(now()) @map("created_at")

  page       Page                @relation(fields: [pageId], references: [id])
  variants   ExperimentVariant[]
  snapshots  ExperimentSnapshot[]
  analyses   AiAnalysisResult[]

  @@index([tenantId])
  @@index([pageId])
  @@index([tenantId, status])
  @@map("experiments")
}

// Each variant IS a PageVersion snapshot. trafficWeight values must sum to 1.0.
model ExperimentVariant {
  id              String   @id @default(cuid())
  experimentId    String   @map("experiment_id")
  tenantId        String   @map("tenant_id")
  pageId          String   @map("page_id")
  name            String                           // "control", "variant-b"
  description     String?  @db.Text
  pageVersionId   String   @map("page_version_id")
  trafficWeight   Float    @default(0.5) @map("traffic_weight")
  isControl       Boolean  @default(false) @map("is_control")
  status          String   @default("active")      // 'active' | 'paused' | 'winner' | 'loser'
  aiGenerated     Boolean  @default(false) @map("ai_generated")
  aiChangeSummary String?  @db.Text @map("ai_change_summary")
  createdAt       DateTime @default(now()) @map("created_at")

  experiment  Experiment  @relation(fields: [experimentId], references: [id])
  pageVersion PageVersion @relation(fields: [pageVersionId], references: [id])
  sessions    VisitorSession[]
  events      ConversionEvent[]
  snapshots   ExperimentSnapshot[]

  @@index([experimentId])
  @@index([tenantId])
  @@map("experiment_variants")
}

// Visitor → variant assignment (sticky). Primary store is Redis (30-day TTL).
// MySQL copy for long-term analysis and AI training.
model VisitorSession {
  id              String    @id @default(cuid())
  tenantId        String    @map("tenant_id")
  experimentId    String    @map("experiment_id")
  variantId       String    @map("variant_id")
  visitorId       String    @map("visitor_id")  // anonymous UUID from localStorage
  device          String?                        // 'desktop' | 'tablet' | 'mobile'
  country         String?
  referrer        String?
  utmSource       String?   @map("utm_source")
  utmMedium       String?   @map("utm_medium")
  utmCampaign     String?   @map("utm_campaign")
  landedAt        DateTime  @default(now()) @map("landed_at")
  convertedAt     DateTime? @map("converted_at")
  conversionValue Float?    @map("conversion_value")

  variant ExperimentVariant @relation(fields: [variantId], references: [id])

  @@index([experimentId])
  @@index([variantId])
  @@index([tenantId, visitorId])
  @@map("visitor_sessions")
}

// Raw event stream — collected async, never blocks page render.
// Fire-and-forget via sendBeacon. Training data for AI loop.
model ConversionEvent {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  experimentId String   @map("experiment_id")
  variantId    String   @map("variant_id")
  sessionId    String   @map("session_id")
  visitorId    String   @map("visitor_id")
  eventType    String   @map("event_type")
  // 'page_view' | 'scroll_25' | 'scroll_50' | 'scroll_75' | 'scroll_100'
  // 'cta_click' | 'checkout_initiated' | 'purchase_completed'
  // 'video_play' | 'video_complete' | 'custom:{name}'
  elementId    String?  @map("element_id")    // canvas node id
  elementLabel String?  @map("element_label")
  value        Float?                          // revenue for purchase events
  metadata     String?  @db.Text              // JSON blob
  occurredAt   DateTime @default(now()) @map("occurred_at")

  variant ExperimentVariant @relation(fields: [variantId], references: [id])

  @@index([experimentId])
  @@index([variantId])
  @@index([experimentId, eventType])
  @@index([tenantId, occurredAt])
  @@map("conversion_events")
}

// Hourly aggregates — what the AI optimizer actually reads.
model ExperimentSnapshot {
  id                String   @id @default(cuid())
  experimentId      String   @map("experiment_id")
  variantId         String   @map("variant_id")
  tenantId          String   @map("tenant_id")
  snapshotAt        DateTime @default(now()) @map("snapshot_at")
  visitors          Int      @default(0)
  pageViews         Int      @default(0) @map("page_views")
  ctaClicks         Int      @default(0) @map("cta_clicks")
  checkoutsStarted  Int      @default(0) @map("checkouts_started")
  purchases         Int      @default(0)
  revenue           Float    @default(0)
  ctaClickRate      Float?   @map("cta_click_rate")
  conversionRate    Float?   @map("conversion_rate")
  revenuePerVisitor Float?   @map("revenue_per_visitor")
  scroll25Rate      Float?   @map("scroll_25_rate")
  scroll50Rate      Float?   @map("scroll_50_rate")
  scroll75Rate      Float?   @map("scroll_75_rate")
  scroll100Rate     Float?   @map("scroll_100_rate")
  periodStart       DateTime? @map("period_start")
  periodEnd         DateTime? @map("period_end")

  experiment Experiment        @relation(fields: [experimentId], references: [id])
  variant    ExperimentVariant @relation(fields: [variantId], references: [id])

  @@index([experimentId])
  @@index([variantId])
  @@map("experiment_snapshots")
}

// Decision log — every AI analysis. Merchant can see full reasoning.
model AiAnalysisResult {
  id              String    @id @default(cuid())
  experimentId    String    @map("experiment_id")
  tenantId        String    @map("tenant_id")
  triggeredBy     String    @map("triggered_by")  // 'time_window' | 'manual'
  status          String                           // 'pending' | 'running' | 'completed' | 'inconclusive' | 'failed'
  recommendation  String?                          // 'continue_testing' | 'declare_winner' | 'stop_test' | 'create_new_variant'
  winnerVariantId String?   @map("winner_variant_id")
  confidenceScore Float?    @map("confidence_score")
  reasoning       String?   @db.Text
  insightsJson    String?   @db.Text @map("insights_json")
  nextActionJson  String?   @db.Text @map("next_action_json")
  appliedAt       DateTime? @map("applied_at")
  approvedBy      String?   @map("approved_by")
  createdAt       DateTime  @default(now()) @map("created_at")

  experiment Experiment @relation(fields: [experimentId], references: [id])

  @@index([experimentId])
  @@index([tenantId, status])
  @@map("ai_analysis_results")
}
```

### package.json additions for canvas-backend

```json
{
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  },
  "scripts": {
    "db:migrate":  "prisma migrate dev",
    "db:deploy":   "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:studio":   "prisma studio",
    "db:reset":    "prisma migrate reset"
  }
}
```

---

## 13. Docker Setup

**SpacetimeDB is on Maincloud — NOT in Docker.**  
Docker only contains: MySQL, Redis, and the four app services.

### docker-compose.yml

```yaml
version: '3.9'

services:

  canvas-backend:
    build:
      context: ./apps/canvas-backend
      dockerfile: Dockerfile
    container_name: canvas-backend
    ports: ["3001:3001"]
    env_file: .env
    environment:
      DATABASE_URL:        mysql://root:${DB_PASSWORD}@canvas-db:3306/selorax_canvas
      REDIS_URL:           redis://redis:6379
      PORT:                3001
    depends_on:
      canvas-db: { condition: service_healthy }
      redis:     { condition: service_started }
    restart: unless-stopped
    networks: [canvas]

  canvas-dashboard:
    build:
      context: ./apps/canvas-dashboard
      dockerfile: Dockerfile
    container_name: canvas-dashboard
    ports: ["3002:3000"]
    env_file: .env
    environment:
      BACKEND_URL:                 http://canvas-backend:3001
      NEXT_PUBLIC_BACKEND_URL:     http://localhost:3001
      NEXT_PUBLIC_SPACETIMEDB_URL: ${SPACETIMEDB_URL}
      NEXT_PUBLIC_SPACETIMEDB_DB:  ${SPACETIMEDB_DB_NAME}
    depends_on: [canvas-backend]
    restart: unless-stopped
    networks: [canvas]

  storefront:
    build:
      context: ./apps/storefront
      dockerfile: Dockerfile
    container_name: canvas-storefront
    ports: ["3003:3000"]
    env_file: .env
    environment:
      BACKEND_URL: http://canvas-backend:3001
    depends_on: [canvas-backend]
    restart: unless-stopped
    networks: [canvas]

  preview-server:
    build:
      context: ./apps/preview-server
      dockerfile: Dockerfile
    container_name: canvas-preview
    ports: ["3004:3000"]
    env_file: .env
    environment:
      BACKEND_URL:      http://canvas-backend:3001
      SPACETIMEDB_URL:  ${SPACETIMEDB_URL}
      SPACETIMEDB_DB:   ${SPACETIMEDB_DB_NAME}
      DASHBOARD_URL:    http://localhost:3002
    depends_on: [canvas-backend]
    restart: unless-stopped
    networks: [canvas]

  canvas-db:
    image: mysql:8.0
    container_name: canvas-mysql
    ports: ["3307:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE:      selorax_canvas
    volumes:
      - canvas_db_data:/var/lib/mysql
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks: [canvas]

  redis:
    image: redis:7-alpine
    container_name: canvas-redis
    ports: ["6380:6379"]
    volumes: [redis_data:/data]
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks: [canvas]

volumes:
  canvas_db_data:
  redis_data:

networks:
  canvas:
    name: selorax-canvas
```

### docker-compose.dev.yml — Hot Reload

```yaml
version: '3.9'
services:
  canvas-backend:
    build: { target: dev }
    volumes:
      - ./apps/canvas-backend/src:/app/src
    command: npx ts-node-dev --respawn --transpile-only src/index.ts

  canvas-dashboard:
    build: { target: dev }
    volumes:
      - ./apps/canvas-dashboard:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev -- -p 3000

  storefront:
    build: { target: dev }
    volumes:
      - ./apps/storefront:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev -- -p 3000

  preview-server:
    build: { target: dev }
    volumes:
      - ./apps/preview-server:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev -- -p 3000
```

### Dockerfile — Express backend

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS prod
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Dockerfile — Next.js apps (same pattern for all three)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-p", "3000"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS prod
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 14. Environment Variables

```bash
# .env — never commit this file

# ── MVP Tenant ─────────────────────────────────────────────────
MVP_MODE=true
TENANT_ID=store_001
TENANT_NAME=My Test Store
TENANT_DOMAIN=localhost:3003
TENANT_PLAN=pro

# ── SpacetimeDB Maincloud ──────────────────────────────────────
# These are used by canvas-backend, canvas-dashboard, preview-server
SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
SPACETIMEDB_DB_NAME=selorax-canvas
# Setup: spacetime login → spacetime publish --server maincloud selorax-canvas

# ── MySQL ──────────────────────────────────────────────────────
DB_PASSWORD=selorax_dev_password

# ── AI ─────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Component CDN (DigitalOcean Spaces) ───────────────────────
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_BUCKET=selorax-components
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

# ── Cloudflare (optional for MVP) ─────────────────────────────
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
```

### .env.example (commit this)

```bash
MVP_MODE=true
TENANT_ID=
TENANT_NAME=
TENANT_DOMAIN=
TENANT_PLAN=pro
SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
SPACETIMEDB_DB_NAME=
DB_PASSWORD=
ANTHROPIC_API_KEY=
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_BUCKET=
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
```

---

## 15. Dev Workflow & Scripts

### Makefile

```makefile
.PHONY: dev prod down logs stdb-publish stdb-generate stdb-deploy db-migrate db-reset

# ── SpacetimeDB (Maincloud) ────────────────────────────────────
stdb-publish:
	cd spacetime && spacetime publish --server maincloud selorax-canvas

stdb-generate:
	spacetime generate --lang typescript --out-dir apps/canvas-backend/src/module_bindings --module-path ./spacetime
	spacetime generate --lang typescript --out-dir apps/canvas-dashboard/src/module_bindings --module-path ./spacetime
	spacetime generate --lang typescript --out-dir apps/preview-server/src/module_bindings --module-path ./spacetime
	@echo "✓ Bindings generated"

# Full deploy: publish to cloud + regenerate bindings
stdb-deploy: stdb-publish stdb-generate

# ── Docker ─────────────────────────────────────────────────────
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

prod:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-%:
	docker compose logs -f $*

clean:
	docker compose down -v

# ── Database ───────────────────────────────────────────────────
db-migrate:
	docker compose exec canvas-backend npm run db:migrate

db-reset:
	docker compose stop canvas-db
	docker volume rm selorax-canvas_canvas_db_data || true
	docker compose up -d canvas-db
	sleep 8
	$(MAKE) db-migrate

shell-%:
	docker compose exec $* sh

status:
	docker compose ps
```

### What `make dev` looks like

```
canvas-backend   | ╔══════════════════════════════════════════╗
canvas-backend   | ║   SeloraX Canvas Backend                ║
canvas-backend   | ║   Port:   3001                           ║
canvas-backend   | ║   Tenant: store_001                      ║
canvas-backend   | ║   STDB:   wss://maincloud.spacetimedb.com║
canvas-backend   | ╚══════════════════════════════════════════╝
canvas-dashboard | ▲ Next.js 14 ready on http://localhost:3000
canvas-storefront| ▲ Next.js 14 ready on http://localhost:3000
canvas-preview   | ▲ Next.js 14 ready on http://localhost:3000
canvas-mysql     | ready for connections on port 3306
canvas-redis     | Ready to accept connections tcp 127.0.0.1:6379
```

### Service URLs

```
canvas-backend API  → http://localhost:3001
canvas-backend MCP  → http://localhost:3001/mcp
canvas-dashboard    → http://localhost:3002
storefront          → http://localhost:3003
preview-server      → http://localhost:3004/[pageId]
SpacetimeDB         → wss://maincloud.spacetimedb.com (cloud)
MySQL               → localhost:3307
Redis               → localhost:6380
```

---

## 16. Build Order

Build in this exact sequence. Each phase must pass before starting the next.

### Phase 1 — SpacetimeDB Module + Codegen (Day 1)

- [ ] Create `spacetime/src/module.ts` with all 4 tables and all reducers
- [ ] `spacetime login` — authenticate CLI with Maincloud account
- [ ] `make stdb-publish` — module live on Maincloud
- [ ] Verify at https://spacetimedb.com/profile — `selorax-canvas` visible
- [ ] `make stdb-generate` — bindings in all 3 apps
- [ ] Verify `src/module_bindings/index.ts` exists in each app

**Done when:** Module shows on spacetimedb.com/profile and bindings are generated.

### Phase 2 — Monorepo Scaffold + Docker (Day 1)

- [ ] All folder structures + package.json files
- [ ] Dockerfiles for all 4 apps
- [ ] `docker-compose.yml` + `docker-compose.dev.yml`
- [ ] Makefile + `.env` + `.env.example` + `spacetime.json`
- [ ] `make dev` → MySQL + Redis healthy, Express returns 200 on `/health`

**Done when:** `make dev` → all containers up, `/health` returns ok.

### Phase 3 — MySQL Schema + Express APIs (Day 2)

- [ ] Prisma schema for all tables (`npx prisma migrate dev --name init`)
- [ ] `npm run db:migrate` creates all tables
- [ ] Tenant middleware (reads from ENV in MVP mode)
- [ ] Pages CRUD routes
- [ ] Serve API (`/api/serve/:tenantId/:pageType/:slug`)
- [ ] Components + Funnels routes
- [ ] Redis client configured
- [ ] SpacetimeDB Node.js client (`getPageNodes`, `callReducer`)
- [ ] Test: `POST /api/pages` creates a page in MySQL

**Done when:** Can CRUD pages, Redis connected, SpacetimeDB client connects.

### Phase 4 — Publish Pipeline (Day 2-3)

- [ ] `buildTree()` utility
- [ ] `POST /api/pages/:id/publish` route
- [ ] Full pipeline: STDB nodes → MySQL version → Redis cache
- [ ] End-to-end test: insert node to STDB manually via CLI → publish → `/api/serve` returns tree

**Done when:** Manual STDB insert → publish → serve returns valid JSON tree.

### Phase 5 — @selorax/renderer (Day 3)

- [ ] `packages/renderer` with `PageRenderer`
- [ ] All 4 node types render correctly
- [ ] Responsive style resolution, token resolution, ESM component loading
- [ ] Storefront `[[...slug]]` page calls `/api/serve` and renders

**Done when:** `localhost:3003` renders a published page from MySQL.

### Phase 6 — Canvas Dashboard (Day 3-4)

- [ ] Next.js app + `middleware.ts`
- [ ] `CanvasPage.tsx` — connects to SpacetimeDB Maincloud from browser
- [ ] `useTable` hooks for nodes, cursors, AI ops
- [ ] Basic layout: toolbar + left panel + canvas + right panel + AI bar
- [ ] Canvas renders live tree from SpacetimeDB subscription

**Done when:** `localhost:3002` shows canvas with live nodes from SpacetimeDB cloud.

### Phase 7 — Live Editing (Day 4-5)

- [ ] Style editor → calls `conn.reducers.update_node_styles()`
- [ ] Node insertion from left panel
- [ ] Cursor tracking → `conn.reducers.move_cursor()` on mouse move
- [ ] Other cursors appear from `useTable(active_cursor)`
- [ ] Node lock on select, unlock on deselect

**Done when:** Edit styles → canvas updates live. Multiple tabs show each other's cursors.

### Phase 8 — Preview Server (Day 5)

- [ ] Preview server connects to STDB, reads live nodes, disconnects
- [ ] Renders with PageRenderer
- [ ] Preview banner with publish button
- [ ] `localhost:3004/[pageId]` shows live canvas state before publish

**Done when:** Preview shows same state as canvas editor in real-time.

### Phase 9 — Mastra AI Agent (Day 5-7)

- [ ] All tools with `createTool()` — each requires `tenant_id`
- [ ] Canvas agent + MCP server
- [ ] `POST /api/ai/canvas` streaming
- [ ] AI creates operation in STDB → AIStatusBar appears on canvas
- [ ] AI calls insert_node reducer → node appears live

**Done when:** Prompt in AIBar → AI cursor appears → node added live → status shows progress.

### Phase 10 — Full UX Polish (Day 7-10)

- [ ] DnD node reordering
- [ ] Component library browser
- [ ] Component build panel (live code stream from STDB)
- [ ] Publish button → full pipeline → storefront updates
- [ ] Funnel builder UI

**Done when:** Full flow works: edit → preview → publish → live on storefront.

---

## Key Rules — Never Violate

1. **tenant_id everywhere** — every STDB subscription, MySQL query, AI tool, MCP call
2. **SpacetimeDB is Maincloud** — never run it in Docker or self-host
3. **Regenerate after every module change** — `make stdb-generate` after any `module.ts` edit
4. **SpacetimeDB = editing only** — storefront never touches SpacetimeDB
5. **Express is the publish bridge** — reads STDB, writes MySQL + Redis
6. **Versions are immutable** — rollback = pointer update, never data mutation
7. **Save component source** — AI needs original source for future edits
8. **useTable for live data** — never poll, never REST SpacetimeDB data from client
9. **Never `subscribeToAllTables()`** — always filter by `tenant_id` and `page_id`
10. **`make dev` must always work** from a clean clone with only `.env` filled in

---

*SeloraX Canvas Platform — Build Spec v2.0*
*SpacetimeDB Maincloud (cloud) · Express backend · Direct WebSocket from clients*
*Ready for Claude Code*

---

## 17. Experiment Engine — A/B Testing + AI Optimization Loop

> **The USP:** Every page on SeloraX is not a static page — it's an experiment slot. The schema supports multiple variants per page, visitor-sticky traffic splitting, conversion event collection, and a future AI reinforcement loop — all from day one. Merchants never think about this complexity. Post-MVP, the AI automatically creates challenger variants, analyzes winners, and progressively learns what works for each tenant's audience.

---

### 17.1 The Mental Model

```
WRONG model (what most builders do):
  Page → one published version

SELORAX model:
  Page → Experiment → Variants (A, B, C...)
              │
              ├─ Each variant IS a page_versions snapshot
              ├─ Traffic split between variants (visitor-sticky)
              ├─ Events collected per variant
              └─ AI decides winner → becomes new control → loop repeats
```

**A funnel is a chain of experiments:**

```
Funnel: "Summer Course Launch"
│
├── Step 1: Landing Page  /summer-course
│   └── Experiment: "hook-test-aug"
│       ├── Variant A (control):  testimonial hero          60% traffic
│       ├── Variant B:            video hero                30% traffic
│       └── Variant C:            countdown + urgency hero  10% traffic
│
├── Step 2: Upsell Page  /summer-course/upsell
│   └── Experiment: "price-anchor-test"
│       ├── Variant A: "$97" with "$197" crossed out        50%
│       └── Variant B: "just $3.23/day"                    50%
│
└── Step 3: Thank You  /summer-course/thank-you
    └── Experiment: "ty-referral"
        ├── Variant A: simple thank you                     50%
        └── Variant B: thank you + refer-a-friend offer     50%
```

Key insight: every page always has at least one variant (the control). A/B testing is always structurally "on" — you just start with one variant and add challengers when ready.

---

### 17.2 Prisma Schema — Experiment Engine Models

All experiment tables are defined in `prisma/schema.prisma` (Section 12).

The 6 models added for the experiment engine are:

- **`Experiment`** — one test per page, one `running` at a time. Stores hypothesis, primaryMetric, analysisWindowDays (AI trigger), and winner.
- **`ExperimentVariant`** — each variant points to a `PageVersion`. `trafficWeight` values must sum to `1.0` across active variants.
- **`VisitorSession`** — anonymous visitor → variant assignment (sticky). Primary fast store is Redis `vsess:{tenantId}:{pageId}:{visitorId}` (30-day TTL). MySQL copy for long-term analysis.
- **`ConversionEvent`** — raw event stream: `page_view`, `scroll_25/50/75/100`, `cta_click`, `checkout_initiated`, `purchase_completed`, `custom:{name}`. Never written inline — queued to Redis, bulk-flushed to MySQL by the event worker.
- **`ExperimentSnapshot`** — hourly aggregates per variant (visitors, rates, revenue). Created by the snapshot worker. What the AI optimizer reads.
- **`AiAnalysisResult`** — decision log. Every AI analysis stored with full reasoning, insights, and recommendation.

All models use `@default(cuid())` for IDs (Prisma generates them — no `nanoid` needed for DB records).

Refer to Section 12 for the complete Prisma schema including all relations and indexes.

### 17.3 The Variant Serving Flow

This is the **critical hot path**. Every storefront page load goes through this. Must be fast.

```
Customer visits  →  GET /api/serve/:tenantId/:pageType/:slug
                     + header: x-visitor-id: <uuid>

STEP 1 — Is there an active experiment on this page?
  Redis: exp:page:{tenantId}:{pageId}
  → HIT (null):    no experiment → serve published version normally (fast path)
  → HIT (config):  experiment running → continue to step 2
  → MISS:          check MySQL → cache result → continue

STEP 2 — Assign or recall visitor's variant (sticky)
  Redis: vsess:{tenantId}:{pageId}:{visitorId}
  → HIT:   use existing {variantId, sessionId}
  → MISS:  new visitor →
           roll = Math.random()  (0.0–1.0)
           match against variant weight buckets:
             e.g. [{from: 0.0, to: 0.6, variantId: 'A'},
                   {from: 0.6, to: 0.9, variantId: 'B'},
                   {from: 0.9, to: 1.0, variantId: 'C'}]
           SET Redis: vsess:...  → 30-day TTL  (sticky from now on)
           ASYNC: INSERT visitor_session to MySQL (non-blocking)

STEP 3 — Fetch variant's tree
  Redis: vtree:{variantId}    (pre-warmed when experiment starts)
  → HIT:  return immediately
  → MISS: fetch from page_versions WHERE id = variant.pageVersionId
           re-warm Redis

STEP 4 — Respond
  {
    tree:         {...},
    variantId:    "variant-b",      ← null if no experiment
    experimentId: "exp-123",         ← null if no experiment
    sessionId:    "sess-abc",        ← client uses for event attribution
  }

STEP 5 — Client fires page_view event (sendBeacon, non-blocking)
  POST /api/events  { tenantId, experimentId, variantId, sessionId, visitorId, eventType: 'page_view' }
```

**Cache-Control:**
- Experiment running → `private, max-age=0` — never CDN-cached (per-visitor)
- No experiment → `public, s-maxage=60` — CDN-cacheable as before

---

### 17.4 Updated Serve Route

```typescript
// apps/canvas-backend/src/routes/serve.ts  (full replacement — experiment-aware)
import { Router } from 'express';
import { prisma } from '../db';
import { redis }  from '../redis/client';
import { nanoid } from 'nanoid';

const router = Router();

router.get('/:tenantId/:pageType/:slug', async (req, res) => {
  const { tenantId, pageType, slug } = req.params;
  const visitorId = (req.headers['x-visitor-id'] as string) ?? 'anonymous';
  const ua        = req.headers['user-agent'] ?? '';

  // Fetch page
  const page = await prisma.page.findFirst({
    where: { tenantId, pageType, slug, publishedVersionId: { not: null } },
  });
  if (!page) return res.status(404).json({ error: 'Not found' });

  // Check for active experiment
  const activeExp = await getActiveExperiment(tenantId, page.id);

  let treeJson:     string;
  let variantId:    string | null = null;
  let experimentId: string | null = null;
  let sessionId:    string | null = null;

  if (activeExp) {
    const assigned = await getOrAssignVariant(tenantId, page.id, visitorId, activeExp, ua);
    variantId    = assigned.variantId;
    experimentId = activeExp.experimentId;
    sessionId    = assigned.sessionId;

    const cached = await redis.get(`vtree:${variantId}`);
    if (cached) {
      treeJson = cached;
    } else {
      const variant = await prisma.experimentVariant.findUnique({ where: { id: variantId } });
      const version = await prisma.pageVersion.findUnique({ where: { id: variant!.pageVersionId } });
      treeJson = version?.tree ?? '{}';
      await redis.set(`vtree:${variantId}`, treeJson, 'EX', 86400);
    }
  } else {
    const cacheKey = `serve:${tenantId}:${pageType}:${slug}`;
    const cached   = await redis.get(cacheKey);
    if (cached) {
      treeJson = JSON.parse(cached).treeJson;
    } else {
      const version = await prisma.pageVersion.findUnique({ where: { id: page.publishedVersionId! } });
      treeJson = version?.tree ?? '{}';
      await redis.set(cacheKey, JSON.stringify({ treeJson }), 'EX', 3600);
    }
  }

  res.setHeader('Cache-Control',
    variantId ? 'private, max-age=0' : 'public, s-maxage=60, stale-while-revalidate=300'
  );
  res.json({ tree: JSON.parse(treeJson), variantId, experimentId, sessionId });
});

// ── Variant assignment (sticky) ───────────────────────────────────────────────
async function getOrAssignVariant(
  tenantId:  string,
  pageId:    string,
  visitorId: string,
  exp:       { experimentId: string; buckets: Array<{ variantId: string; from: number; to: number }> },
  ua:        string,
) {
  const key = `vsess:${tenantId}:${pageId}:${visitorId}`;
  const hit  = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const roll      = Math.random();
  const bucket    = exp.buckets.find(b => roll >= b.from && roll < b.to)
    ?? exp.buckets[exp.buckets.length - 1];
  const variantId = bucket.variantId;
  const sessionId = nanoid();

  await redis.set(key, JSON.stringify({ variantId, sessionId }), 'EX', 2592000); // 30 days

  // Fire-and-forget session record
  prisma.visitorSession.create({
    data: {
      id: sessionId, tenantId,
      experimentId: exp.experimentId,
      variantId, visitorId,
      device: detectDevice(ua),
    },
  }).catch(console.error);

  return { variantId, sessionId };
}

// ── Active experiment lookup (Redis-cached, 60s TTL) ──────────────────────────
async function getActiveExperiment(tenantId: string, pageId: string) {
  const cached = await redis.get(`exp:page:${tenantId}:${pageId}`);
  if (cached) return cached === 'null' ? null : JSON.parse(cached);

  const exp = await prisma.experiment.findFirst({
    where: { tenantId, pageId, status: 'running' },
  });

  if (!exp) {
    await redis.set(`exp:page:${tenantId}:${pageId}`, 'null', 'EX', 60);
    return null;
  }

  const variants = await prisma.experimentVariant.findMany({
    where: { experimentId: exp.id, status: 'active' },
  });

  let cursor = 0;
  const buckets = variants.map(v => {
    const b = { variantId: v.id, from: cursor, to: cursor + v.trafficWeight };
    cursor += v.trafficWeight;
    return b;
  });

  const config = { experimentId: exp.id, buckets };
  await redis.set(`exp:page:${tenantId}:${pageId}`, JSON.stringify(config), 'EX', 60);
  return config;
}

function detectDevice(ua: string): string {
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

// GET /api/serve/:tenantId/pages
router.get('/:tenantId/pages', async (req, res) => {
  const pages = await prisma.page.findMany({
    where: { tenantId: req.params.tenantId, publishedVersionId: { not: null } },
    select: { id: true, slug: true, pageType: true, title: true },
  });
  res.json(pages);
});

export default router;
```

---

### 17.5 Experiment Management Routes

```typescript
// apps/canvas-backend/src/routes/experiments.ts
import { Router }    from 'express';
import { getTenant } from '../middleware/tenant';
import { prisma }    from '../db';
import { redis }     from '../redis/client';

const router = Router();

// Create experiment
router.post('/', async (req, res) => {
  const tenant = getTenant(req);
  const exp = await prisma.experiment.create({
    data: {
      tenantId:           tenant.id,
      pageId:             req.body.pageId,
      funnelId:           req.body.funnelId,
      name:               req.body.name,
      hypothesis:         req.body.hypothesis,
      primaryMetric:      req.body.primaryMetric ?? 'conversion_rate',
      trafficMode:        'sticky',
      minSampleSize:      req.body.minSampleSize ?? 500,
      analysisWindowDays: req.body.analysisWindowDays ?? 7,
      status:             'draft',
    },
  });
  res.json({ id: exp.id });
});

// Add variant — pageVersionId is an existing page_version snapshot
router.post('/:id/variants', async (req, res) => {
  const tenant  = getTenant(req);
  const variant = await prisma.experimentVariant.create({
    data: {
      experimentId:    req.params.id,
      tenantId:        tenant.id,
      pageId:          req.body.pageId,
      name:            req.body.name,
      description:     req.body.description,
      pageVersionId:   req.body.pageVersionId,
      trafficWeight:   req.body.trafficWeight ?? 0.5,
      isControl:       req.body.isControl ?? false,
      aiGenerated:     req.body.aiGenerated ?? false,
      aiChangeSummary: req.body.aiChangeSummary,
    },
  });

  // Pre-warm variant tree in Redis immediately
  const version = await prisma.pageVersion.findUnique({ where: { id: req.body.pageVersionId } });
  if (version) await redis.set(`vtree:${variant.id}`, version.tree, 'EX', 86400);

  res.json({ id: variant.id });
});

// Start experiment — validates weights sum to 1.0
router.post('/:id/start', async (req, res) => {
  const tenant   = getTenant(req);
  const variants = await prisma.experimentVariant.findMany({ where: { experimentId: req.params.id } });

  const total = variants.reduce((s, v) => s + v.trafficWeight, 0);
  if (Math.abs(total - 1.0) > 0.01) {
    return res.status(400).json({ error: `Weights must sum to 1.0 (got ${total.toFixed(2)})` });
  }

  const exp = await prisma.experiment.update({
    where: { id: req.params.id, tenantId: tenant.id },
    data:  { status: 'running', startedAt: new Date() },
  });

  await redis.del(`exp:page:${tenant.id}:${exp.pageId}`);
  res.json({ status: 'running' });
});

router.post('/:id/pause', async (req, res) => {
  await prisma.experiment.update({ where: { id: req.params.id }, data: { status: 'paused' } });
  res.json({ status: 'paused' });
});

router.post('/:id/resume', async (req, res) => {
  await prisma.experiment.update({ where: { id: req.params.id }, data: { status: 'running' } });
  res.json({ status: 'running' });
});

// Declare winner — promotes variant's tree as the page's published version
router.post('/:id/conclude', async (req, res) => {
  const tenant = getTenant(req);
  const { winnerVariantId, winnerReason } = req.body;

  const variant = await prisma.experimentVariant.findUnique({ where: { id: winnerVariantId } });
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  // Promote winner as new published version
  await prisma.page.update({
    where: { id: variant.pageId },
    data:  { publishedVersionId: variant.pageVersionId, publishedAt: new Date() },
  });

  const exp = await prisma.experiment.update({
    where: { id: req.params.id },
    data:  { status: 'concluded', endedAt: new Date(), winnerVariantId, winnerReason },
  });

  await redis.del(`exp:page:${tenant.id}:${exp.pageId}`);

  // Warm standard serve cache with winner's tree
  const page = await prisma.page.findUnique({ where: { id: exp.pageId } });
  if (page) {
    const tree = await redis.get(`vtree:${winnerVariantId}`);
    if (tree) await redis.set(
      `serve:${tenant.id}:${page.pageType}:${page.slug}`,
      JSON.stringify({ treeJson: tree }),
      'EX', 3600,
    );
  }

  res.json({ status: 'concluded', winnerVariantId });
});

// Get results
router.get('/:id/results', async (req, res) => {
  const exp = await prisma.experiment.findUnique({
    where: { id: req.params.id },
    include: {
      variants:  true,
      snapshots: { orderBy: { snapshotAt: 'desc' } },
      analyses:  { orderBy: { createdAt: 'desc'  } },
    },
  });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  res.json(exp);
});

export default router;
```

---

### 17.6 Event Ingestion — Fire-and-Forget

```typescript
// apps/canvas-backend/src/routes/events.ts
// Must respond in < 50ms. Push to Redis queue, don't write MySQL inline.
import { Router } from 'express';
import { redis }  from '../redis/client';
import { nanoid } from 'nanoid';

const router = Router();

// POST /api/events
router.post('/', async (req, res) => {
  const { tenantId, experimentId, variantId, eventType } = req.body;
  if (!tenantId || !experimentId || !variantId || !eventType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Push raw event to Redis queue for async bulk write
  await redis.lpush('events:queue', JSON.stringify({
    id: nanoid(), ...req.body, occurredAt: new Date().toISOString(),
  }));

  // Increment Redis counter for live dashboard (never needs MySQL)
  const counterKey = `evcount:${experimentId}:${variantId}:${eventType}`;
  await redis.incr(counterKey);
  await redis.expire(counterKey, 86400 * 7);  // 7-day window

  res.status(202).json({ ok: true });  // respond immediately
});

// GET /api/events/live/:experimentId — real-time counts from Redis
// Dashboard polls this every 30s
router.get('/live/:experimentId', async (req, res) => {
  const keys = await redis.keys(`evcount:${req.params.experimentId}:*`);
  const counts: Record<string, Record<string, number>> = {};

  await Promise.all(keys.map(async key => {
    const parts     = key.split(':');
    const variantId = parts[2];
    const eventType = parts.slice(3).join(':');  // handles custom:name
    if (!counts[variantId]) counts[variantId] = {};
    counts[variantId][eventType] = parseInt(await redis.get(key) ?? '0');
  }));

  res.json(counts);
});

export default router;
```

### Event Writer Worker (Redis → MySQL bulk write)

```typescript
// apps/canvas-backend/src/workers/event-writer.ts
import { redis }  from '../redis/client';
import { prisma } from '../db';

export function startEventWorker() {
  setInterval(async () => {
    const batch: any[] = [];
    for (let i = 0; i < 100; i++) {
      const raw = await redis.rpop('events:queue');
      if (!raw) break;
      try { batch.push(JSON.parse(raw)); } catch { /* skip malformed */ }
    }
    if (!batch.length) return;

    await prisma.conversionEvent.createMany({
      data: batch.map(e => ({
        id:           e.id,
        tenantId:     e.tenantId,
        experimentId: e.experimentId,
        variantId:    e.variantId,
        sessionId:    e.sessionId,
        visitorId:    e.visitorId,
        eventType:    e.eventType,
        elementId:    e.elementId    ?? null,
        elementLabel: e.elementLabel ?? null,
        value:        e.value        ?? null,
        metadata:     e.metadata ? JSON.stringify(e.metadata) : null,
        occurredAt:   new Date(e.occurredAt),
      })),
      skipDuplicates: true,
    }).catch(console.error);
  }, 5_000);  // flush every 5 seconds
}
```

---

### 17.7 Client Tracking — @selorax/renderer

Zero configuration for merchants. Tracking fires automatically when renderer mounts.

```typescript
// packages/renderer/src/tracking.ts

const BACKEND = typeof process !== 'undefined'
  ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? '') : '';

export interface TrackingCtx {
  tenantId:     string;
  experimentId: string | null;
  variantId:    string | null;
  sessionId:    string | null;
  visitorId:    string;
}

export function initTracking(ctx: TrackingCtx) {
  if (typeof window === 'undefined' || !ctx.experimentId) return;

  // Page view fires immediately
  fire(ctx, 'page_view', null, null);

  // Scroll depth — tracks 25/50/75/100% milestones
  const fired = new Set<number>();
  window.addEventListener('scroll', () => {
    const scrollable = document.body.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const pct = Math.round((window.scrollY / scrollable) * 100);
    [25, 50, 75, 100].forEach(t => {
      if (pct >= t && !fired.has(t)) {
        fired.add(t);
        fire(ctx, `scroll_${t}`, null, null, { depth: pct });
      }
    });
  }, { passive: true });

  // CTA clicks — canvas nodes with data-track attribute auto-tracked
  document.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-track]') as HTMLElement | null;
    if (el) fire(ctx, 'cta_click', el.dataset.nodeId ?? null, el.dataset.track ?? null);
  });
}

// Explicit events — call from storefront code
export function trackCheckoutInitiated(ctx: TrackingCtx) {
  fire(ctx, 'checkout_initiated', null, 'checkout');
}
export function trackPurchase(ctx: TrackingCtx, orderId: string, value: number) {
  fire(ctx, 'purchase_completed', null, 'purchase', { orderId, value });
}
export function trackCustom(ctx: TrackingCtx, name: string, data?: Record<string, any>) {
  fire(ctx, `custom:${name}`, null, name, data);
}

function fire(
  ctx: TrackingCtx, eventType: string,
  elementId: string | null, elementLabel: string | null,
  metadata?: Record<string, any>,
) {
  if (!ctx.experimentId) return;  // no experiment = no noise

  const payload = JSON.stringify({
    tenantId: ctx.tenantId, experimentId: ctx.experimentId,
    variantId: ctx.variantId, sessionId: ctx.sessionId, visitorId: ctx.visitorId,
    eventType, elementId, elementLabel,
    metadata: { ...metadata, device: getDevice() },
  });

  // sendBeacon: survives page unload, never blocks user interaction
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${BACKEND}/api/events`, payload);
  } else {
    fetch(`${BACKEND}/api/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, keepalive: true,
    }).catch(() => {});  // silent fail — tracking never crashes the page
  }
}

export function getVisitorId(tenantId: string): string {
  try {
    const key    = `_sx_vid_${tenantId}`;
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    const id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(key, id);
    return id;
  } catch { return 'anonymous'; }
}

function getDevice() {
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}
```

### Updated PageRenderer — Auto-initializes tracking

```typescript
// packages/renderer/src/PageRenderer.tsx — updated signature + useEffect
'use client';
import { useEffect } from 'react';
import { initTracking, getVisitorId, type TrackingCtx } from './tracking';

interface PageRendererProps {
  tree:          any;
  data:          any;
  // Passed from storefront's /api/serve response
  tenantId?:     string;
  variantId?:    string | null;
  experimentId?: string | null;
  sessionId?:    string | null;
}

export function PageRenderer({
  tree, data,
  tenantId, variantId, experimentId, sessionId,
}: PageRendererProps) {
  useEffect(() => {
    if (!tenantId || !experimentId) return;
    const ctx: TrackingCtx = {
      tenantId, experimentId,
      variantId:  variantId  ?? null,
      sessionId:  sessionId  ?? null,
      visitorId:  getVisitorId(tenantId),
    };
    initTracking(ctx);
  }, [tenantId, experimentId, variantId, sessionId]);

  return <RenderNode node={tree} data={data} />;
  // ... rest unchanged
}
```

### Updated Storefront — sends visitor ID, passes tracking props

```typescript
// apps/storefront/app/[[...slug]]/page.tsx — updated
import { cookies, headers } from 'next/headers';
import { PageRenderer }     from '@selorax/renderer';

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const slug     = params.slug ?? [];
  const tenantId = process.env.TENANT_ID!;
  const { pageType, pagSlug } = resolvePageType(slug);

  // Get or set visitor ID via cookie (server-side for SSR)
  const cookieStore = await cookies();
  let visitorId = cookieStore.get(`_sx_vid_${tenantId}`)?.value;
  // (Client-side localStorage is the real source; cookie is for SSR header forwarding only)

  const res = await fetch(`${BACKEND}/api/serve/${tenantId}/${pageType}/${pagSlug}`, {
    cache:   'no-store',  // experiment responses must not be cached at this layer
    headers: {
      'x-visitor-id': visitorId ?? 'anonymous',
    },
  });
  if (!res.ok) return <div>Page not found</div>;

  const { tree, variantId, experimentId, sessionId } = await res.json();
  const data = { store: { name: process.env.TENANT_NAME }, device: 'desktop' };

  return (
    <PageRenderer
      tree={tree} data={data}
      tenantId={tenantId}
      variantId={variantId}
      experimentId={experimentId}
      sessionId={sessionId}
    />
  );
}
```

---

### 17.8 Snapshot Worker — Hourly Aggregation

```typescript
// apps/canvas-backend/src/workers/snapshot-job.ts
// Runs hourly. Aggregates raw events → experiment_snapshots.
// Triggers AI analysis after analysisWindowDays (default 7).

import { prisma } from '../db';

export function startSnapshotJob() {
  setInterval(runSnapshotJob, 60 * 60 * 1000);
  runSnapshotJob().catch(console.error);  // also run on startup
}

async function runSnapshotJob() {
  const running = await prisma.experiment.findMany({ where: { status: 'running' } });

  for (const exp of running) {
    const variants = await prisma.experimentVariant.findMany({
      where: { experimentId: exp.id },
    });
    for (const v of variants) await snapshotVariant(exp, v);
    await maybeQueueAnalysis(exp);
  }
}

async function snapshotVariant(exp: any, variant: any) {
  const now = new Date();

  // Count events grouped by type using Prisma groupBy
  const eventGroups = await prisma.conversionEvent.groupBy({
    by:     ['eventType'],
    where:  { variantId: variant.id },
    _count: { id: true },
  });

  const c: Record<string, number> = {};
  for (const g of eventGroups) c[g.eventType] = g._count.id;

  const sessionCount = await prisma.visitorSession.count({ where: { variantId: variant.id } });

  const revenueAgg = await prisma.conversionEvent.aggregate({
    where:  { variantId: variant.id, eventType: 'purchase_completed' },
    _sum:   { value: true },
  });

  const visitors  = sessionCount;
  const purchases = c['purchase_completed'] || 0;
  const revenue   = revenueAgg._sum.value ?? 0;
  const clicks    = c['cta_click'] || 0;

  await prisma.experimentSnapshot.create({
    data: {
      experimentId: exp.id,
      variantId:    variant.id,
      tenantId:     exp.tenantId,
      snapshotAt:   now,
      visitors,
      pageViews:        c['page_view']          || 0,
      ctaClicks:        clicks,
      checkoutsStarted: c['checkout_initiated'] || 0,
      purchases,
      revenue,
      ctaClickRate:      visitors > 0 ? clicks    / visitors : 0,
      conversionRate:    visitors > 0 ? purchases / visitors : 0,
      revenuePerVisitor: visitors > 0 ? revenue   / visitors : 0,
      scroll25Rate:  visitors > 0 ? (c['scroll_25']  || 0) / visitors : 0,
      scroll50Rate:  visitors > 0 ? (c['scroll_50']  || 0) / visitors : 0,
      scroll75Rate:  visitors > 0 ? (c['scroll_75']  || 0) / visitors : 0,
      scroll100Rate: visitors > 0 ? (c['scroll_100'] || 0) / visitors : 0,
      periodStart:  exp.startedAt,
      periodEnd:    now,
    },
  });
}

async function maybeQueueAnalysis(exp: any) {
  if (!exp.startedAt) return;

  const windowMs = (exp.analysisWindowDays ?? 7) * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(exp.startedAt).getTime() < windowMs) return;

  // Don't queue if one already pending or completed
  const existing = await prisma.aiAnalysisResult.findFirst({
    where: {
      experimentId: exp.id,
      status:       { in: ['pending', 'completed'] },
    },
  });
  if (existing) return;

  await prisma.aiAnalysisResult.create({
    data: {
      experimentId: exp.id,
      tenantId:     exp.tenantId,
      triggeredBy:  'time_window',
      status:       'pending',
    },
  });
  console.log(`[snapshot-job] queued AI analysis for experiment ${exp.id}`);
}
```

---

### 17.9 AI Analysis Agent + Worker (Post-MVP — structure in place from day one)

```typescript
// apps/canvas-backend/src/mastra/agents/experiment-analysis-agent.ts
import { Agent }     from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';

export const experimentAnalysisAgent = new Agent({
  id:   'experiment-analysis-agent',
  model: anthropic('claude-sonnet-4-6'),
  instructions: `
    You are an expert e-commerce conversion rate optimizer.
    You analyze A/B test data and make decisions about which page variants perform best.

    You receive JSON with:
    - experiment: name, hypothesis, primaryMetric, daysRunning
    - variants: each with name, isControl, aiChangeSummary, and latest snapshot metrics
      (visitors, ctaClickRate, conversionRate, revenuePerVisitor, scroll25Rate...scroll100Rate)

    Output ONLY valid JSON (no preamble, no markdown):
    {
      "recommendation": "declare_winner" | "continue_testing" | "stop_test" | "create_new_variant",
      "winnerVariantId": "variant-id or null",
      "confidenceScore": 0.0,
      "reasoning": "Plain English. What drove the difference. Why it works for this audience.",
      "insights": [
        { "key": "scroll_correlation", "finding": "Users who scroll past 50% convert 4x better" }
      ],
      "nextAction": {
        "type": "create_new_variant",
        "suggestion": "Test a version with countdown timer above CTA",
        "hypothesis": "Urgency near CTA will push hesitant buyers to act faster"
      }
    }

    Rules:
    - Never recommend declaring a winner with < 100 visitors per variant
    - Explain in plain English — merchants are not data scientists
    - Focus on what CHANGED between variants and WHY it worked
    - If data is unclear, say continue_testing and explain what's needed
  `,
});
```

```typescript
// apps/canvas-backend/src/workers/ai-analysis-worker.ts
// Picks up 'pending' ai_analysis_results and runs Claude on them.
// Activate post-MVP. Schema + data collection runs from day one.

import { prisma } from '../db';
import { mastra } from '../mastra';

export function startAiAnalysisWorker() {
  setInterval(processPending, 5 * 60 * 1000);  // every 5 minutes
}

async function processPending() {
  const pending = await prisma.aiAnalysisResult.findMany({
    where: { status: 'pending' },
    take:  3,
  });

  for (const job of pending) {
    await runAnalysis(job).catch(async err => {
      console.error(`[ai-analysis] failed ${job.id}:`, err);
      await prisma.aiAnalysisResult.update({
        where: { id: job.id },
        data:  { status: 'failed' },
      });
    });
  }
}

async function runAnalysis(job: any) {
  await prisma.aiAnalysisResult.update({
    where: { id: job.id },
    data:  { status: 'running' },
  });

  const exp = await prisma.experiment.findUnique({ where: { id: job.experimentId } });
  const variants = await prisma.experimentVariant.findMany({
    where: { experimentId: job.experimentId },
  });
  const snapshots = await prisma.experimentSnapshot.findMany({
    where:   { experimentId: job.experimentId },
    orderBy: { snapshotAt: 'desc' },
  });

  // Latest snapshot per variant
  const latest = new Map<string, any>();
  for (const s of snapshots) {
    if (!latest.has(s.variantId)) latest.set(s.variantId, s);
  }

  const context = JSON.stringify({
    experiment: {
      name:          exp!.name,
      hypothesis:    exp!.hypothesis,
      primaryMetric: exp!.primaryMetric,
      daysRunning:   Math.round((Date.now() - new Date(exp!.startedAt!).getTime()) / 86400_000),
    },
    variants: variants.map(v => ({
      id:              v.id,
      name:            v.name,
      isControl:       v.isControl,
      aiChangeSummary: v.aiChangeSummary,
      trafficWeight:   v.trafficWeight,
      metrics:         latest.get(v.id),
    })),
  });

  const agent  = mastra.getAgent('experimentAnalysisAgent');
  const result = await agent.generate(context, { output: 'json' });
  const parsed = JSON.parse(result.text);

  await prisma.aiAnalysisResult.update({
    where: { id: job.id },
    data: {
      status:          'completed',
      recommendation:  parsed.recommendation,
      winnerVariantId: parsed.winnerVariantId,
      confidenceScore: parsed.confidenceScore,
      reasoning:       parsed.reasoning,
      insightsJson:    JSON.stringify(parsed.insights),
      nextActionJson:  JSON.stringify(parsed.nextAction),
    },
  });

  console.log(`[ai-analysis] ${parsed.recommendation} for experiment ${exp!.id}`);
}
```

Wire everything into `index.ts`:

```typescript
// Append to canvas-backend/src/index.ts

import { startEventWorker }  from './workers/event-writer';
import { startSnapshotJob }  from './workers/snapshot-job';
// import { startAiAnalysisWorker } from './workers/ai-analysis-worker';  // enable post-MVP

import experimentsRouter from './routes/experiments';
import eventsRouter      from './routes/events';

app.use('/api/experiments', tenantMiddleware, experimentsRouter);
app.use('/api/events',      eventsRouter);   // public — no tenant middleware (called by storefront)

startEventWorker();
startSnapshotJob();
// startAiAnalysisWorker();  // enable post-MVP
```

---

### 17.10 Dashboard — Experiment Panel

```typescript
// apps/canvas-dashboard/app/canvas/[pageId]/components/experiments/ExperimentPanel.tsx
'use client';
import { useEffect, useState } from 'react';

export default function ExperimentPanel({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const [exp,     setExp]     = useState<any>(null);
  const [metrics, setMetrics] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/experiments?pageId=${pageId}`, {
      headers: { 'x-tenant-id': tenantId },
    }).then(r => r.json()).then(d => setExp(d.active ?? null));
  }, [pageId]);

  // Poll live Redis counters every 30s
  useEffect(() => {
    if (!exp) return;
    const poll = () => fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/events/live/${exp.id}`)
      .then(r => r.json()).then(setMetrics);
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [exp?.id]);

  if (!exp) return (
    <div className="experiment-empty">
      <p>No active experiment on this page.</p>
      <button className="btn-primary">+ Start A/B Test</button>
    </div>
  );

  return (
    <div className="experiment-panel">
      <div className="exp-header">
        <span className={`status-dot status-${exp.status}`} />
        <h3>{exp.name}</h3>
        {exp.hypothesis && <p className="hypothesis">{exp.hypothesis}</p>}
      </div>

      <div className="variants-list">
        {exp.variants?.map((v: any) => {
          const m      = metrics[v.id] ?? {};
          const views  = m['page_view']         ?? 0;
          const clicks = m['cta_click']          ?? 0;
          const buys   = m['purchase_completed'] ?? 0;
          const ctr    = views > 0 ? ((clicks / views) * 100).toFixed(1) : '—';
          const cvr    = views > 0 ? ((buys   / views) * 100).toFixed(2) : '—';

          return (
            <div key={v.id} className={`variant-card ${v.isControl ? 'is-control' : ''}`}>
              <div className="variant-header">
                <span className="variant-name">{v.name}</span>
                {v.isControl && <span className="badge-control">control</span>}
                <span className="traffic-pct">{Math.round(v.trafficWeight * 100)}%</span>
              </div>
              <div className="variant-metrics">
                <div className="metric"><span>Views</span><strong>{views.toLocaleString()}</strong></div>
                <div className="metric"><span>CTR</span><strong>{ctr}%</strong></div>
                <div className="metric"><span>CVR</span><strong>{cvr}%</strong></div>
              </div>
              {v.aiChangeSummary && (
                <p className="ai-change">✨ {v.aiChangeSummary}</p>
              )}
              <button
                className="btn-winner"
                onClick={() => declareWinner(exp.id, v.id, tenantId)}
              >
                Declare Winner
              </button>
            </div>
          );
        })}
      </div>

      {exp.latestAnalysis && (
        <div className="ai-analysis-card">
          <h4>🤖 AI Analysis</h4>
          <p className="recommendation">{exp.latestAnalysis.recommendation}</p>
          <p className="reasoning">{exp.latestAnalysis.reasoning}</p>
          {exp.latestAnalysis.insights?.map((ins: any) => (
            <div key={ins.key} className="insight">💡 {ins.finding}</div>
          ))}
        </div>
      )}
    </div>
  );
}

async function declareWinner(experimentId: string, variantId: string, tenantId: string) {
  if (!confirm('Declare this variant as the winner? The page will switch immediately.')) return;
  await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/experiments/${experimentId}/conclude`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body:    JSON.stringify({ winnerVariantId: variantId, winnerReason: 'merchant_selected' }),
  });
  window.location.reload();
}
```

---

### 17.11 The AI Automation Loop (Post-MVP)

Once data is flowing, this is the full self-optimization cycle:

```
TRIGGER: merchant clicks "Let AI create a challenger" OR scheduler detects
  minSampleSize reached with no clear winner
               ↓
Canvas Agent:
  1. get_page_tree(page_id, tenant_id)     ← reads current control
  2. Reviews latest snapshot metrics       ← what's underperforming
  3. Makes targeted edits via reducers:
     e.g. if scroll_50_rate is low →
       - Move CTA above fold
       - Shorten hero copy
       - Add urgency element (countdown)
       - Increase button contrast
  4. publish_page(page_id, tenant_id)      ← saves as new page_version
               ↓
POST /api/experiments/:id/variants {
  pageVersionId:   newVersionId,
  name:            "variant-c-ai",
  trafficWeight:   0.20,        ← 20% traffic to test challenger
  aiGenerated:     true,
  aiChangeSummary: "Moved CTA above fold, added 24h countdown, shortened hero copy"
}
               ↓
Experiment live immediately. Visitor-sticky. No flicker.
               ↓
After 7 days (default, configurable per experiment):
  Snapshot job detects time window reached → queues AI analysis job
  AI analysis agent reads snapshots → produces recommendation JSON
  Dashboard shows: "Variant C wins. +34% CVR. CTA above fold drove it."
  Merchant approves OR auto-applies (configurable)
               ↓
Winner becomes new control. Old variants archived.
AI generates next challenger hypothesis based on winning insights.
Cycle repeats → page continuously self-optimizes.
```

---

### 17.12 Build Phases for Experiment Engine

**Phase 11 — Schema + Core Routes (Day 10–11)**
- [ ] Migrations for all 6 new tables
- [ ] `POST /api/experiments` — create
- [ ] `POST /api/experiments/:id/variants` — add variant + pre-warm cache
- [ ] `POST /api/experiments/:id/start` — validate weights + start
- [ ] `POST /api/experiments/:id/conclude` — declare winner + promote version
- [ ] `GET /api/experiments/:id/results` — data for dashboard
- [ ] Updated serve route — experiment-aware variant assignment + sticky sessions
- [ ] `POST /api/events` + `GET /api/events/live/:id`
- [ ] Wire routes into `index.ts`
- [ ] **Test:** Start experiment on page → open two incognito windows → each sees different variant consistently

**Phase 12 — Client Tracking (Day 11)**
- [ ] `tracking.ts` in `@selorax/renderer`
- [ ] `PageRenderer` auto-fires `page_view` + scroll milestones
- [ ] Canvas element nodes with `data-track` attribute auto-trigger `cta_click`
- [ ] Storefront passes `variantId`, `experimentId`, `sessionId` to `PageRenderer`
- [ ] **Test:** Load storefront → Redis counters increment → MySQL populated by event worker

**Phase 13 — Workers + Dashboard (Day 11–12)**
- [ ] `event-writer.ts` (Redis queue → bulk MySQL every 5s)
- [ ] `snapshot-job.ts` (hourly aggregates per variant)
- [ ] Both started in `index.ts`
- [ ] `ExperimentPanel.tsx` in canvas-dashboard with live metrics (30s polling)
- [ ] Declare winner flow → storefront switches immediately
- [ ] **Test:** Fire 50 events → dashboard shows live counts → declare winner → storefront serves winner's tree

**Phase 14 — AI Analysis Loop (Post-MVP)**
- [ ] `experiment-analysis-agent.ts` added to Mastra + `index.ts`
- [ ] `ai-analysis-worker.ts` — polls pending analyses every 5 min
- [ ] Activate `startAiAnalysisWorker()` in `index.ts`
- [ ] AI creates challenger variants via canvas agent
- [ ] **Test:** 500+ events per variant → AI analysis fires → recommendation appears in dashboard → approve → storefront switches

---

### 17.13 What This Unlocks — The Full Picture

```
MVP (Phases 11–13) — ship this:
  ✓ Every page is an experiment slot — always
  ✓ Create A/B tests in canvas dashboard
  ✓ Visitor-sticky traffic split — no flicker, funnel-safe
  ✓ Auto-tracked: page views, scroll depth, CTA clicks, purchases
  ✓ Live metrics in dashboard (Redis, 30s refresh)
  ✓ Declare winner → storefront instantly switches to that tree
  ✓ Full history in MySQL for AI training later

Post-MVP (Phase 14):
  ✓ AI analyzes experiments when sample size reached
  ✓ AI creates challenger variants using canvas agent (sees canvas + metrics)
  ✓ AI recommends winner in plain English with insight breakdowns
  ✓ Closed-loop: winner insights feed next challenger hypothesis

Long-term USP:
  ✓ Every SeloraX funnel self-optimizes over time with zero merchant effort
  ✓ Cross-experiment learning: "Above-fold CTAs always win for this tenant"
  ✓ Seasonal signals: "Video heroes perform 40% better in Q4 for this niche"
  ✓ External data enrichment: weather, ad spend, competitor pricing → AI context
  ✓ Funnel-level optimization: optimize the chain, not just individual pages
  ✓ Multi-armed bandit: dynamic traffic reallocation (not fixed splits)
  ✓ Cross-tenant learning (anonymized): industry benchmarks and patterns
```