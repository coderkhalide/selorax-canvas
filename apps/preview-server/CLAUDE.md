# Preview Server — Live Canvas Preview

Port 3004. Next.js 14 Server Component that reads live (unpublished) SpacetimeDB state.

## How It Works
1. `GET /[pageId]?tenantId=store_001`
2. Server Component connects to SpacetimeDB Maincloud (one-shot)
3. Subscribes filtered by `page_id + tenant_id`, reads nodes, disconnects
4. Renders via `<PageRenderer tree={tree} data={data} />`
5. Shows purple banner: "Preview — not published yet" + Publish Now button

## One-Shot STDB Pattern (Server Side)
```typescript
const nodes = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Preview timeout')), 10_000);
  DbConnection.builder()
    .withUri(process.env.SPACETIMEDB_URL!)
    .withDatabaseName(process.env.SPACETIMEDB_DB_NAME!)
    .onConnect(ctx => {
      ctx.subscriptionBuilder()
        .onApplied(() => {
          const nodes = Array.from(ctx.db.canvas_node.iter())
            .filter(n => n.page_id === pageId && n.tenant_id === tenantId);
          clearTimeout(timer);
          ctx.disconnect();
          resolve(nodes);
        })
        .subscribe([tables.canvas_node.where(r => r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId)))]);
    })
    .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
    .build();
});
```

## Key Files
```
src/
  module_bindings/         — AUTO-GENERATED (run make stdb-generate, never edit)
  utils/tree.ts            — Same buildTree() as backend
  app/
    [pageId]/page.tsx      — Server Component: one-shot STDB, render, preview banner
```

## Error States
- STDB timeout (>10s) → error message with debug hint
- No nodes (empty canvas) → "No content yet" + link to editor
- Both are graceful — no uncaught exceptions

## .env.local
```
SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
SPACETIMEDB_DB_NAME=selorax-canvas
BACKEND_URL=http://localhost:3001
DASHBOARD_URL=http://localhost:3002
TENANT_ID=store_001
TENANT_NAME=My Test Store
```

## Dev
```bash
next dev -p 3004
```
Access via: `http://localhost:3004/{pageId}?tenantId=store_001`
