# Canvas V3 — Phases 2–6 Design Document
**Date:** 2026-02-28
**Status:** Approved

---

## Overview

Phases 2–6 complete the V3 canvas editor built on top of `apps/canvas-v2`. Phase 1 (foundation / SpacetimeDB wiring) is already done. This document covers the remaining work:

- **Phase 2** — Pages & Funnels Dashboard
- **Phase 3** — Preview & Storefront Links
- **Phase 4** — Real-Time Collaboration
- **Phase 5** — AI Agent (Mastra wiring)
- **Phase 6** — ESM Component Registry

V2's UX (panels, drag-drop, AI chat, style editor, history) remains the north star. Only the plumbing changes.

---

## Phase 2 — Pages & Funnels Dashboard

### Goal
Replace the current redirect at `/` with a real home screen where users can browse, create, and navigate pages and funnels.

### Routes
- `/` — Dashboard home (new, replaces redirect to `/editor`)
- `/editor/[pageId]` — Editor (already done in Phase 1)

### Pages Tab
- Card grid showing all pages for the tenant (fetched from `GET /api/pages` with `x-tenant-id` header)
- Each card: title, type badge (Landing Page / Product Template / Collection / Funnel Step), last-edited timestamp
- "New Page" button → modal to pick type → `POST /api/pages` → redirect to `/editor/[newPageId]`
- Click card → navigate to `/editor/[pageId]`

### Funnels Tab
- List of funnels for the tenant (`GET /api/funnels`)
- Each funnel row: name + visual step flow (`Landing → Checkout → Upsell → ✅`)
- "New Funnel" → name input → `POST /api/funnels` → appears in list
- "Add Step" inside a funnel → creates a new page + links it as next step (`POST /api/funnels/:id/steps`)
- Click any step card → navigate to `/editor/[pageId]`

### Backend Endpoints Required
All already exist or are trivial additions to `canvas-backend`:
- `GET /api/pages` — list pages for tenant
- `POST /api/pages` — create page (title, type, slug auto-generated)
- `GET /api/funnels` — list funnels for tenant
- `POST /api/funnels` — create funnel
- `GET /api/funnels/:id` — get funnel with steps
- `POST /api/funnels/:id/steps` — add step (creates page + step record)

### New Files
```
apps/canvas-v2/src/
  app/
    page.tsx                          # Dashboard home (replaces redirect)
  components/
    dashboard/
      DashboardPage.tsx               # Main dashboard component
      PagesGrid.tsx                   # Page cards grid
      PageCard.tsx                    # Single page card
      NewPageModal.tsx                # Type picker modal
      FunnelsList.tsx                 # Funnels list
      FunnelRow.tsx                   # Single funnel with step flow
      NewFunnelModal.tsx              # Funnel name input
  hooks/
    useFunnels.ts                     # Fetch/create funnels + steps
```

---

## Phase 3 — Preview & Storefront Links

### Goal
Add Preview, View Live, and Publish buttons to the editor header so users can see their work at every stage.

### Header Additions (right side)
1. **Preview** button → `window.open(PREVIEW_URL/pageId, '_blank')`
   - `PREVIEW_URL = process.env.NEXT_PUBLIC_PREVIEW_URL` (default `http://localhost:3004`)
   - Shows live STDB state before publish
2. **View Live** button → `window.open(STOREFRONT_URL/slug, '_blank')`
   - `STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL` (default `http://localhost:3003`)
   - Shows last published version (slug fetched from page metadata)
3. **Publish** button → `POST canvas-backend /api/pages/[pageId]/publish`
   - Shows loading spinner during publish
   - Shows success toast on completion
   - Shows error toast on failure

### .env.local Additions
```env
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3004
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3003
```

### Modified Files
```
apps/canvas-v2/src/
  components/
    Header.tsx                        # Add Preview, View Live, Publish buttons
  hooks/
    usePublish.ts                     # Publish mutation + loading/error state
```

---

## Phase 4 — Real-Time Collaboration

### Goal
Changes made by one user appear live on other users' canvases. Live cursors show where other users are.

### Remote Merge
`StdbSyncProvider.tsx` currently syncs local → STDB (Phase 1) but ignores incoming remote changes.

Fix:
- `useTable(tables.canvas_node)` already fires on every insert/update/delete from any client
- After initialization, for each node change from STDB:
  - If node is in `dirtySet` (recently mutated locally) → skip (local wins)
  - Otherwise → convert `CanvasNode` → `FunnelElement` → dispatch `STDB_MERGE` action to `FunnelContext`
- `FunnelContext` handles `STDB_MERGE`: applies the remote node diff to the elements tree

### FunnelContext STDB_MERGE Action
```typescript
// In FunnelContext reducer
case 'STDB_MERGE': {
  const { nodeId, operation, element } = action.payload;
  if (operation === 'delete') return removeElementById(state, nodeId);
  if (operation === 'upsert') return upsertElementById(state, element);
  return state;
}
```

### Live Cursors
- On `mousemove` over canvas (throttled 50ms): `conn.reducers.upsertCursor({ pageId, tenantId, x, y })`
- On unmount: `conn.reducers.removeCursor({ pageId, tenantId })`
- `useTable(tables.active_cursor)` → filter by `pageId + tenantId` → render colored dot + name label per cursor
- Cursor color derived from userId hash (consistent per user)
- Cursor component floats absolutely over the canvas at (x, y) position

### Modified Files
```
apps/canvas-v2/src/
  providers/
    StdbSyncProvider.tsx              # Implement remote merge, cursor broadcast
  context/
    FunnelContext.tsx                 # Add STDB_MERGE action handler
  components/
    canvas/
      LiveCursors.tsx                 # Cursor overlay component (new)
    Canvas.tsx                        # Add mousemove handler + LiveCursors overlay
```

---

## Phase 5 — AI Agent (Mastra Wiring)

### Goal
Wire the existing `AgentChat.tsx` UI to the Mastra backend agent instead of OpenRouter. AI edits appear live on canvas via the Phase 4 real-time merge path.

### Current State
- `AgentChat.tsx` — full chat UI already built (messages, attachments, streaming)
- `/api/funnel-agent/route.ts` — streams from OpenRouter directly
- `mcp/tools.ts` — 40+ MCP tools already implemented for canvas editing

### Changes
1. **Replace `/api/funnel-agent/route.ts`** — proxy streaming to `canvas-backend /api/agent/stream`
   - Forward: `{ message, pageId, tenantId, attachments }`
   - Stream SSE back to client (same format AgentChat expects)
2. **`canvas-backend /api/agent/stream`** (already exists via Mastra) — Mastra agent with 16 tools (`insert_node`, `update_node_styles`, `get_page_nodes`, etc.) talking to STDB
3. AI edits flow: Mastra → STDB reducers → STDB broadcasts to all subscribers → Phase 4 merge → canvas updates live
4. **AI Status Bar** — new component at bottom of canvas
   - `useTable(tables.ai_operation)` → filter by `pageId + tenantId`
   - Shows: "AI is working... generating hero section (60%)"
   - Disappears when `status === 'completed'` or `status === 'failed'`

### Modified Files
```
apps/canvas-v2/src/
  app/
    api/
      funnel-agent/
        route.ts                      # Replace: proxy to canvas-backend instead of OpenRouter
  components/
    AIStatusBar.tsx                   # New: live AI operation status from STDB
    EditorLayout.tsx                  # Add AIStatusBar below canvas
```

---

## Phase 6 — ESM Component Registry

### Goal
Replace the static `custom-registry.tsx` with dynamic CDN loading. Components are fetched from the backend and loaded at runtime from Cloudflare R2.

### Current State
- 14 components statically imported in `custom-registry.tsx`
- All component code bundled into the app
- No way to add components without a code deploy

### Changes

#### Left Sidebar — Components Tab
- New tab in `Sidebar.tsx` (currently has Layout, Grid, Basic, Media, Custom)
- Fetches `GET /api/components` from canvas-backend (MySQL registry)
- Shows: name, category, thumbnail preview
- Search + category filter
- Drag to canvas → drops `type: 'custom'` node with `componentUrl` set to R2 URL

#### ElementRenderer — Dynamic Loading
```typescript
// For elements with type === 'custom' and a componentUrl:
const RemoteComponent = lazy(() => import(/* @vite-ignore */ element.componentUrl!));
return (
  <Suspense fallback={<div>Loading...</div>}>
    <RemoteComponent element={element} onUpdate={onUpdate} />
  </Suspense>
);
```

#### Component Migration
Migrate existing 14 components from static registry to ESM:
1. Each component built as standalone ESM module (default export: `React.FC<{element, onUpdate}>`)
2. Uploaded to Cloudflare R2 (public URL)
3. Registered in MySQL `Component` table with `componentUrl`, `name`, `category`, `thumbnail`
4. `custom-registry.tsx` removed (no more static imports)

#### next.config.mjs Update
Add allowed ESM import domains:
```javascript
experimental: {
  externalDir: true,
}
```

### New Files
```
apps/canvas-v2/src/
  components/
    ComponentBrowser.tsx              # ESM component browser (fetch + search + drag)
  hooks/
    useComponents.ts                  # Fetch component list from backend
scripts/
  migrate-components.ts              # Build + upload existing 14 components to R2
```

### Modified Files
```
apps/canvas-v2/src/
  components/
    Sidebar.tsx                       # Add Components tab with ComponentBrowser
    ElementRenderer.tsx               # Add dynamic ESM loading for custom nodes
  next.config.mjs                     # Allow cross-origin ESM imports
```

---

## Key Technical Notes

### Backend URLs (canvas-v2 .env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
NEXT_PUBLIC_SPACETIMEDB_DB=selorax-canvas
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3004
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3003
TENANT_ID=store_001
```

### Tenant Header Pattern
All backend calls include `x-tenant-id` header (injected by middleware on `/editor/*`, manually added on `/` dashboard routes).

### Remote Merge Rule
```typescript
// Local wins for nodes in dirtySet (edited in last 5 seconds)
// Remote wins for everything else
if (dirtySet.has(remoteNode.id)) return; // skip
dispatch({ type: 'STDB_MERGE', payload: { ... } });
```

### AI Streaming Format
Canvas-backend streams SSE in Vercel AI SDK format — same as what AgentChat already parses. No format change needed on the client.

### ESM Component Interface
```typescript
// Every ESM component must export this as default:
export default function MyComponent({
  element,
  onUpdate,
  isPreview,
}: {
  element: FunnelElement;
  onUpdate?: (id: string, updates: Partial<FunnelElement>) => void;
  isPreview?: boolean;
}) { ... }
```
