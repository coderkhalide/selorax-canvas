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
Always filter by both `page_id` AND `tenant_id`:
```typescript
tables.canvas_node.where(r => r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId)))
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
