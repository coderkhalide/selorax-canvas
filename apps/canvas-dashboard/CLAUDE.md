# Canvas Dashboard — Real-Time Editor

Port 3002. Next.js 14 App Router with live SpacetimeDB subscriptions.

## Core Architecture
The canvas editor connects directly to SpacetimeDB Maincloud from the browser. All canvas state (nodes, cursors, AI operations) is live — no polling.

```
/canvas/[pageId]
  page.tsx (Server Component)
    → reads headers → passes tenant props
    → <CanvasPage /> (Client Component)
        → SpacetimeDBProvider (connectionBuilder)
          → <CanvasInner />
              useTable(canvas_node.where(page_id + tenant_id))
              useTable(active_cursor.where(page_id + tenant_id))
              useTable(ai_operation.where(page_id + tenant_id))
```

## NEVER Use subscribeToAllTables()
Always filter by both `page_id` AND `tenant_id`. Use RAW SQL strings (NOT query builder `.where()` — DB columns are snake_case but query builder uses camelCase and generates wrong SQL):
```typescript
// CORRECT — raw SQL with snake_case DB column names:
conn.subscriptionBuilder().subscribe([
  `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
  `SELECT * FROM active_cursor WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
]);

// WRONG — query builder generates wrong SQL ('pageId' not 'page_id'):
// tables.canvas_node.where(r => r.page_id.eq(pageId)) — r.page_id is undefined
// tables.canvas_node.where(r => r.pageId.eq(pageId))  — generates pageId in SQL (not page_id)
```

## useTable — Read From Local Cache
Since the subscription already filters rows, `useTable` can use unfiltered table refs:
```typescript
const [flatNodes] = useTable(tables.canvas_node);   // only subscribed rows in cache
const [cursors]   = useTable(tables.active_cursor);
const [aiOps]     = useTable(tables.ai_operation);
```
`useTable` returns `readonly[]` — spread when passing to mutable args: `[...flatNodes]`

## Generated Row Fields Are camelCase
The SpacetimeDB SDK generates camelCase JS property names from snake_case DB columns:
- `row.pageId` (not `row.page_id`)
- `row.tenantId` (not `row.tenant_id`)
- `row.nodeType` (not `row.node_type`)
- `row.parentId` (not `row.parent_id`)
- `row.componentUrl` (not `row.component_url`)
- `row.lockedBy`, `row.lockedAt`

## Reducer Names Are camelCase
```typescript
conn.reducers.moveCursor({ x, y, selectedNodeId, hoveredNodeId })
conn.reducers.lockNode({ nodeId })
conn.reducers.unlockNode({ nodeId })
conn.reducers.updateNodeStyles({ nodeId, styles })
conn.reducers.insertNode({ id, pageId, tenantId, ... })
```

## useSpacetimeDB Cast
```typescript
const conn = useSpacetimeDB() as unknown as DbConnection | null;
```

## SpacetimeDB React Pattern
```typescript
// Outer: create connectionBuilder (not .build()!), wrap with provider
const connectionBuilder = useMemo(() =>
  DbConnection.builder()
    .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URL!)
    .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB!)
    .onConnect((conn) => {
      conn.subscriptionBuilder()
        .onApplied(() => console.log('ready'))
        .subscribe([tables.canvas_node.where(...)]);
    })
, [pageId, tenantId]);

return <SpacetimeDBProvider connectionBuilder={connectionBuilder}><CanvasInner /></SpacetimeDBProvider>;

// Inner: use hooks
const conn = useSpacetimeDB() as DbConnection | null;
const [flatNodes] = useTable(tables.canvas_node.where(r => r.page_id.eq(pageId)));
```

## Key Files
```
src/
  module_bindings/          — AUTO-GENERATED (run make stdb-generate, never edit)
  utils/tree.ts             — buildTree() same as backend
  middleware.ts             — injects x-tenant-id header in MVP mode
  app/
    layout.tsx
    canvas/[pageId]/
      page.tsx              — Server Component: reads headers
      components/
        CanvasPage.tsx      — 'use client', SpacetimeDBProvider wrapper + CanvasInner
        Canvas.tsx          — Renders tree, click-to-select
        CanvasNode.tsx      — Recursive node renderer
        panels/
          LeftPanel.tsx     — Layers tree + component browser
          RightPanel.tsx    — Style editor + settings
          LayersTree.tsx
          StyleEditor.tsx
        toolbar/
          Toolbar.tsx       — Device toggle, publish button
          PublishButton.tsx — Calls POST /api/pages/:id/publish
        ai/
          AIBar.tsx         — Prompt input, streams to /api/ai/canvas
          AIStatusBar.tsx   — Live AI op status from STDB (useTable)
          ComponentBuildPanel.tsx — Streams preview_code from STDB
```

## Node Interactions
- **Select node**: `conn.reducers.lock_node(nodeId, userId)` → unlock on deselect
- **Edit styles**: `conn.reducers.update_node_styles(nodeId, styles)` — deep merge
- **Move**: `conn.reducers.move_node(nodeId, newParentId, order)`
- **Cursor**: throttled `mousemove` → `conn.reducers.move_cursor(x, y, nodeId)`

## AI Bar Streaming
`POST /api/ai/canvas` → SSE stream → update status in UI
Meanwhile STDB broadcasts `ai_operation` row updates to all clients.

## .env.local
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
NEXT_PUBLIC_SPACETIMEDB_DB=selorax-canvas
TENANT_ID=store_001
TENANT_NAME=My Test Store
```

## Dev
```bash
next dev -p 3002
```
config: `next.config.mjs` (NOT .ts — Next.js 14 doesn't support next.config.ts)
