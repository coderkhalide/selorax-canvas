# Canvas V3 — Design Document
**Date:** 2026-02-28
**Status:** Approved

---

## Overview

Canvas V3 converts `apps/canvas-v2` into a production-grade page builder that is fully connected to the SeloraX backend (SpacetimeDB, MySQL, Redis, Cloudflare R2). The V2 UX (panels, drag-drop, AI chat, style editor, history) is preserved as the north star. Only the plumbing underneath changes.

---

## Core Philosophy

> "V2's UX is the north star. Everything we change is the plumbing underneath."

V2's components (`Canvas.tsx`, `ElementRenderer.tsx`, `PropertiesPanel.tsx`, all panels, floating toolbar, history system) remain largely untouched. The sync layer is isolated in a new `StdbSyncProvider` that wraps `FunnelBuilder`.

---

## State Model — Hybrid (Optimistic Local + STDB Persistence)

```
LOCAL USER ACTION
  → FunnelContext (immediate, zero latency — optimistic)
  → 100ms debounce → STDB reducer call (persistence + broadcast)

REMOTE COLLABORATOR / AI OPERATION
  → STDB reducer fires on their end
  → canvas_node subscription fires onInsert/onUpdate/onDelete
  → merge into FunnelContext (remote changes applied on local state)
  → merge rule: local wins for nodes currently being edited, remote wins otherwise
```

**Why this model:**
- The working user gets instant feedback (no network round-trip on every keystroke)
- Network delay or STDB latency is invisible to the local user
- Real-time collaboration still works — remote changes merge in from STDB
- AI operations (which go through STDB) also appear live via the same merge path

---

## Data Model Mapping

| FunnelElement (V2) | CanvasNode (STDB) |
|--------------------|-------------------|
| `id` | `id` |
| `type` ('section', 'row', 'col', 'headline', 'button', 'image', 'custom', ...) | `nodeType` ('layout' / 'element' / 'component') |
| `name` | `props.label` |
| `content` | `props.content` |
| `style` (CSSProperties) | `styles` (JSON string) |
| `children[]` (nested array) | flat nodes with `parentId` + `order` (lexicographic) |
| `tabletStyle` | `settings.breakpoints.md` |
| `mobileStyle` | `settings.breakpoints.sm` |
| `customType` | `settings.customType` |
| `data` (component props) | `settings.data` |
| `schemeId` | `settings.schemeId` |
| `className` | `settings.className` |

**Node type mapping:**
- `section`, `row`, `col`, `wrapper` → `nodeType: 'layout'`
- `headline`, `paragraph`, `button`, `image`, `video`, `icon`, `input`, `divider` → `nodeType: 'element'`
- `custom` (any customType) → `nodeType: 'component'`

---

## Architecture

### New Files

```
apps/canvas-v2/src/
├── providers/
│   └── StdbSyncProvider.tsx        # SpacetimeDB connection + sync (NEW)
├── lib/
│   ├── nodeConverter.ts            # FunnelElement ↔ CanvasNode bidirectional (NEW)
│   └── stdbOps.ts                  # Tree diff → STDB reducer calls (NEW)
├── hooks/
│   └── useStdbSync.ts              # Debounced sync hook (NEW)
├── app/
│   ├── editor/
│   │   └── [pageId]/
│   │       └── page.tsx            # Dynamic route (NEW, replaces /editor/page.tsx)
```

### Modified Files

```
├── components/
│   ├── FunnelBuilder.tsx           # Wrap with StdbSyncProvider, wire setElements on load
│   ├── Header.tsx                  # Add page/funnel switcher dropdown, publish → backend
│   ├── Sidebar.tsx                 # Add Components tab (ESM registry), Funnels tab
│   ├── PropertiesPanel.tsx         # Add breakpoint selector (SM/MD/LG/XL), keep existing
│   └── AgentChat.tsx               # Redirect to Mastra backend instead of OpenRouter
├── context/
│   └── FunnelContext.tsx           # Add merge action for remote STDB changes
```

### Kept As-Is (No Changes)

- `Canvas.tsx` — drag-drop, auto-scroll, drop zones
- `ElementRenderer.tsx` — recursive tree rendering
- `FloatingToolbar.tsx` — magic, layout, duplicate, delete
- `HistoryPanel.tsx` + `useHistory.ts` — undo/redo
- `StylePanel.tsx` — CSS property editor
- `ThemePanel.tsx` — color scheme system
- `LayersTree.tsx` (inside PropertiesPanel) — layers view
- `AIGenerationPanel.tsx` — AI component generation UI
- `AIWorkingOverlay.tsx` — loading state
- All custom component implementations (to be migrated in Phase 3)

---

## Phased Execution Plan

### Phase 1 — Foundation (SpacetimeDB Wiring)

**Goal:** V2 running connected to the real backend, editable by pageId.

1. Add dynamic route `app/editor/[pageId]/page.tsx`
2. Create `StdbSyncProvider.tsx`:
   - Reads `pageId` + `tenantId` from route params / middleware header
   - Creates SpacetimeDB connection (same pattern as canvas-dashboard)
   - Subscribes (raw SQL): `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`
   - On connect: fetch nodes → `flatNodesToTree()` → `setElements()` in FunnelContext
   - `useTable(canvas_node)` subscription → `onInsert/onUpdate/onDelete` → merge into FunnelContext
3. Create `nodeConverter.ts`:
   - `flatNodesToTree(nodes: CanvasNode[]): FunnelElement[]`
   - `treeToFlatOps(prev: FunnelElement[], next: FunnelElement[]): StdbOp[]`
4. Create `useStdbSync.ts`:
   - Takes `elements` from FunnelContext
   - On change: debounce 100ms → call `treeToFlatOps(prev, next)` → execute STDB reducers
5. Update `Header.tsx`:
   - Page switcher dropdown (fetches page list from backend REST)
   - Page types: Homepage, Collection, Product Template, Landing Page, Funnel Step
   - On select: navigate to `/editor/[pageId]`
6. Multi-tenant: read `x-tenant-id` from Next.js middleware, pass to STDB connection

**Output:** Can open `/editor/abc123` and see the live canvas state from STDB, edits persist.

---

### Phase 2 — Dashboard UX Port

**Goal:** Bring the best features from canvas-dashboard that V2 is missing.

1. **Rubber-band selection** — drag on empty canvas to multi-select nodes
2. **Context menu** (right-click):
   - Group selection → create layout wrapper
   - Ungroup → promote children to parent
   - Bring to front / Send to back (order manipulation)
   - Lock / Unlock node
   - Duplicate, Copy, Paste, Delete
3. **Live cursors** — colored SVG cursor + name for each connected user
4. **Funnel builder tab** in left sidebar:
   - Visual step flow cards (Landing → Checkout → Upsell → ✅)
   - Click step → navigate to that page's canvas
   - Configure step: type, routing action, URL
5. **Publish button** in Header → calls `canvas-backend /api/publish` (STDB → MySQL → Redis)
6. **AI operation status bar** — shows live progress from `ai_operation` STDB table

**Output:** Feature parity with canvas-dashboard's UX extras, plus V2's superior panels.

---

### Phase 3 — Component Registry

**Goal:** Replace V2's hardcoded custom components with the ESM component registry.

1. Remove `custom-registry.tsx` and `custom-registry/` folder
2. Add `ComponentBrowser` left sidebar tab:
   - Fetches components from `canvas-backend /api/components` (MySQL registry)
   - Shows name, preview thumbnail, version
   - Search + filter
3. Drag component from browser → canvas → injects as `nodeType: 'component'` with `componentUrl`
4. `ElementRenderer` handles `nodeType: 'component'` via dynamic ESM import (same as dashboard)
5. Migrate V2's 15 custom components:
   - Each gets built as proper ESM component
   - Uploaded to Cloudflare R2
   - Registered in MySQL `Component` table
   - Available in ComponentBrowser immediately

**Output:** Unlimited components from registry, AI-editable, stored in backend.

---

### Phase 4 — AI Upgrade

**Goal:** Connect AI to Mastra backend, add AI operation tracking.

1. Replace V2's `/api/funnel-agent` route → proxy to `canvas-backend /api/agent/stream`
2. Replace OpenRouter API calls (in `services/openai.ts`) → Mastra agent calls
3. Port Mastra's existing 16 tools → exposed as MCP tools to V2's `AgentChat`:
   - `insert_node`, `update_node_styles`, `update_node_props`, `get_page_nodes`, etc.
4. AI status bar pulls from `ai_operation` STDB table (live progress per operation)
5. AI component generation uses Mastra's `stream_component_code` + `component_build` STDB table
6. Keep V2's `AIGenerationPanel` UI — wire to Mastra instead of OpenRouter

**Output:** Mastra-powered AI agent with real tools, streaming, page-aware context.

---

### Phase 5 — Responsive + Animations

**Goal:** Industry-grade responsive controls and basic animation authoring.

1. **Responsive breakpoints**: Replace V2's `desktop/tablet/mobile` → `SM (640) / MD (768) / LG (1024) / XL (1280)`
   - Breakpoint selector in Header (device icons)
   - Canvas viewport scales to selected breakpoint
   - `StylePanel` shows active breakpoint styles, overrides stored in `settings.breakpoints.{sm,md,lg,xl}`
2. **Animation controls** (new accordion in PropertiesPanel):
   - Enter animation: fade, slide-up, slide-left, scale, none
   - Duration + delay (ms)
   - Trigger: on-load, on-scroll, on-hover
   - Stored in `settings.animation`
3. **Hover state editing**:
   - Toggle "Hover" in PropertiesPanel → StylePanel edits hover styles
   - Stored as `settings.hoverStyles`

**Output:** Designers can build responsive pages with animations, rival Framer/Webflow.

---

### Phase 6 — Color Theme + Polish

**Goal:** Persist themes to backend, polish undo/redo, add version history display.

1. **Color schemes persistence**: Store schemes in MySQL (via backend API), load on page open
2. **Global CSS editor** → saved to page record in MySQL via backend API
3. **Version history panel**: Show published versions from MySQL `PageVersion` table
   - Rollback = update `publishedVersionId` pointer (never mutates a version)
4. **Undo/redo hardening**: Ensure history snapshots capture STDB-synced state correctly
5. **Page metadata editor**: Edit page title, slug, SEO meta in Header drawer
6. **Template browser**: Load page templates from backend (replaces PocketBase)

**Output:** Production-ready platform with persistence, versioning, and theming.

---

## Key Technical Notes

### STDB Subscription (Raw SQL — Critical)
```typescript
// ALWAYS use raw SQL — query builder generates wrong column names
conn.subscriptionBuilder().subscribe([
  `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
]);
```

### Debounce Sync Pattern
```typescript
const pendingOps = useRef<StdbOp[]>([]);
const timer = useRef<ReturnType<typeof setTimeout>>();

function scheduleSync(prev: FunnelElement[], next: FunnelElement[]) {
  const ops = treeToFlatOps(prev, next);
  pendingOps.current.push(...ops);
  clearTimeout(timer.current);
  timer.current = setTimeout(() => {
    flushOps(pendingOps.current); // calls STDB reducers
    pendingOps.current = [];
  }, 100);
}
```

### Remote Merge Rule
```typescript
// In FunnelContext: STDB_MERGE action
// Only update nodes NOT in the local "dirty set" (recently mutated by user)
function mergeRemote(localElements: FunnelElement[], remoteNode: CanvasNode) {
  if (dirtySet.has(remoteNode.id)) return localElements; // local wins
  return applyRemoteNode(localElements, remoteNode);
}
```

### ESM Component Loading
```typescript
// Same pattern as canvas-dashboard CanvasNode.tsx
const Component = lazy(() => import(/* @vite-ignore */ componentUrl));
```

### Mastra Agent Integration
```typescript
// Replace V2's /api/funnel-agent with proxy to canvas-backend
// canvas-backend exposes: POST /api/agent/chat (streaming)
// Auth: x-tenant-id header
```

---

## What We Are NOT Building in V3

- A new app from scratch (we convert V2 in place)
- A new data model (FunnelElement stays as live state)
- A Figma-style absolute-positioning free canvas (still flex/grid flow, like Framer)
- Desktop app or offline mode
- Custom font upload (out of scope for now)
