# Canvas UX Overhaul — Design Document
**Date:** 2026-02-28
**Status:** Approved
**Reference:** `/Users/khalid/Desktop/app/landing-page-builder-v2`

---

## Overview

The current canvas dashboard (`apps/canvas-dashboard`) has solid backend infrastructure (SpacetimeDB real-time, AI agent, publish pipeline) but a poor editor UX — slow drag-and-drop due to direct STDB writes, no inline text editing, no elements panel, and an unpolished dark UI.

This overhaul introduces a **CanvasContext optimistic-first architecture** (inspired by v2's FunnelContext), a full **white/branded UI**, **inline editing**, **per-element settings**, and a polished **drag-and-drop system with visual drop zones** — all without breaking the existing node-based STDB schema.

**Approach B selected:** Context Layer + UI Overhaul.

---

## 1. Core Architecture: CanvasContext

### Problem
Every user interaction (drag, style edit, typing) currently calls a STDB reducer immediately. Network latency (100–1300ms) makes the canvas feel sluggish. v2 feels instant because it uses local React context as the primary state.

### Solution: Optimistic Local Context

```
User action → CanvasContext (instant update) → Sync Queue → STDB (100ms debounced)
AI action   → STDB reducer → useTable() merge → CanvasContext (auto-sync)
```

### CanvasContext State Shape

```ts
interface CanvasState {
  nodes: Map<string, CanvasNode>   // O(1) lookup by id
  rootIds: string[]                 // ordered root node ids
  selectedIds: Set<string>
  editingId: string | null          // currently inline-editing node id
  draggingId: string | null
  pendingSync: SyncOperation[]      // queued STDB writes
}

type SyncOperation =
  | { type: 'insert'; node: CanvasNode }
  | { type: 'update_styles'; nodeId: string; styles: Record<string, string> }
  | { type: 'update_props'; nodeId: string; props: Record<string, unknown> }
  | { type: 'update_settings'; nodeId: string; settings: Record<string, unknown> }
  | { type: 'move'; nodeId: string; newParentId: string | null; newOrder: string }
  | { type: 'delete'; nodeId: string }
```

### Sync Queue Rules

1. **Debounce:** Flush pending ops every 100ms
2. **Batch:** Multiple style updates to the same node merge into one reducer call
3. **AI wins:** When STDB pushes an update from an AI operation, it overwrites local state for that node
4. **User wins locally:** While a sync is pending, local state is authoritative for the UI
5. **On reconnect:** Re-subscribe and merge STDB state with any unsynced local ops

### STDB → Context Sync

```ts
// In CanvasInner (after useTable):
useEffect(() => {
  const incomingMap = new Map(flatNodes.map(n => [n.id, n]));
  dispatch({ type: 'STDB_SYNC', nodes: incomingMap });
}, [flatNodes]);
```

The `STDB_SYNC` action merges nodes that were NOT modified locally (no pending sync op for that id). AI-generated nodes (identified by the `ai_operation` table) always override local state.

---

## 2. White Theme & Brand Colors

### Brand Identity
- **Primary (Navy):** `#2D2F8F` — selection outlines, active tabs, nav accents
- **CTA (Orange):** `#F47920` — Publish button, AI submit, primary actions
- Logo: SeloraX navy + orange

### Color Tokens

```css
:root {
  /* Surfaces */
  --bg-app: #F3F4F6;         /* outside canvas, app chrome */
  --bg-panel: #FFFFFF;       /* left/right panels, toolbar */
  --bg-hover: #F9FAFB;       /* row hover, list item hover */
  --bg-selected: #EEEEF8;    /* selected row bg */

  /* Borders */
  --border: #E5E7EB;         /* panel dividers, section borders */
  --border-subtle: #F3F4F6;  /* very subtle separators */

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;

  /* Brand */
  --brand-navy: #2D2F8F;     /* accent, selection, active */
  --brand-orange: #F47920;   /* CTA buttons, AI actions */
  --brand-navy-light: #EEEEF8; /* light bg for navy accents */

  /* Canvas */
  --canvas-bg: #F3F4F6;      /* canvas viewport bg */
  --canvas-frame: #FFFFFF;   /* the white canvas frame */
  --canvas-shadow: 0 4px 24px rgba(0,0,0,0.08);

  /* Interactions */
  --selection-color: #2D2F8F;
  --drop-zone-color: #6366F1;
}
```

### Layout Dimensions
- Left panel: 260px
- Right panel: 280px
- Toolbar: 48px height
- Canvas frame: max 1200px width, centered

---

## 3. Left Panel (4 Tabs)

### Tab Order: Elements | Layers | Components | Funnels

### Elements Tab (NEW)

Grid of draggable element cards, grouped by category:

**Layout elements** (create `layout` nodeType in STDB):
- Section (full-width flex column)
- Row (flex row)
- Columns (2-column grid preset)
- Wrapper (div with flex column)

**Content elements** (create `element` nodeType):
- Heading (h1, h2, h3 — default h2)
- Paragraph (p tag)
- Button (button tag)
- Image (img tag)
- Divider (hr)

**Interactions:**
- **Click to add:** Inserts as child of selected node, or appended to root if nothing selected. Uses `resolveDropOrder` for ordering.
- **Drag to canvas:** Visual drop zones indicate where it will land.

**Default node props per type:**
```ts
const ELEMENT_DEFAULTS = {
  section:   { styles: { display: 'flex', flexDirection: 'column', padding: '40px 20px', width: '100%' } },
  row:       { styles: { display: 'flex', flexDirection: 'row', gap: '16px' } },
  columns:   { styles: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' } },
  wrapper:   { styles: { display: 'flex', flexDirection: 'column', gap: '8px' } },
  heading:   { props: { tag: 'h2', content: 'Heading' }, styles: { fontSize: '32px', fontWeight: '700' } },
  paragraph: { props: { tag: 'p', content: 'Paragraph text' }, styles: { fontSize: '16px' } },
  button:    { props: { tag: 'button', content: 'Button' }, styles: { padding: '12px 24px', borderRadius: '6px', background: '#F47920', color: '#fff' } },
  image:     { props: { tag: 'img', src: '' }, styles: { width: '100%', height: '200px', objectFit: 'cover' } },
  divider:   { props: { tag: 'hr' }, styles: { borderTop: '1px solid #E5E7EB', width: '100%' } },
};
```

### Layers Tab (Improved)

Existing LayersTree.tsx — improved with:
- **Collapse/expand** chevron for layout nodes
- **Inline rename** on double-click (blur to save)
- **Delete** icon on hover (calls deleteNodeCascade)
- **Lock indicator** icon
- **Drop zone highlights** while dragging (before/after/inside)
- White theme styling

### Components & Funnels Tabs

Keep existing functionality, update to white theme styling.

---

## 4. Canvas & Drag-and-Drop

### Node Rendering (CanvasNode.tsx)

Three node types:
1. **`layout`** — flex/grid container, renders children recursively, accepts drops
2. **`element`** — text, heading, img, button, divider — leaf nodes, no drop inside
3. **`component`** — ESM custom component, leaf, has Settings tab in right panel

### Selection

- **Single click** → select node, show selection outline + floating toolbar
- **Shift+click** → multi-select
- **Click canvas background** → deselect all
- **Selection outline:** `2px solid #2D2F8F` (navy)
- **Hover outline:** `1px dashed #D1D5DB`

### Floating Toolbar (above selected node)

```
┌─────────────────────────────────────────┐
│  ⠿  [Node Name Badge]  [⧉]  [🗑]  [🔒] │
└─────────────────────────────────────────┘
```
- `⠿` — drag handle
- `[Node Name]` — dark badge, single-click to rename inline
- `[⧉]` — duplicate (inserts adjacent, not at end)
- `[🗑]` — delete (cascade)
- `[🔒]` — lock/unlock toggle

### Inline Text Editing

**Trigger:** Double-click on `element` nodes with text content (heading, paragraph, button).

```tsx
// In CanvasNode.tsx
const isEditing = editingId === node.id;

// On double-click:
setEditingId(node.id);

// Render:
<div
  contentEditable={isEditing}
  suppressContentEditableWarning
  onBlur={(e) => {
    dispatch({ type: 'UPDATE_PROPS', nodeId: node.id, props: { content: e.currentTarget.textContent } });
    setEditingId(null);
  }}
  dangerouslySetInnerHTML={{ __html: node.props?.content ?? '' }}
/>
```

When `isEditing`, the node ignores drag events.

### Drag-and-Drop System

**Reference:** v2's three-layer DnD system (`/src/components/Canvas.tsx`, `ElementRenderer.tsx`, `LayersPanel.tsx`).

**Implementation:** Continue using `@dnd-kit/core` (already installed). Add drop position detection.

**Drop positions:**
- `before` — insert before hovered node (line indicator above)
- `after` — insert after hovered node (line indicator below)
- `inside` — append as last child of layout node (dashed border highlight)

**Detection logic** (from v2, adapted):
```ts
// In drag overlay / DragOver handler:
const rect = overElement.getBoundingClientRect();
const relativeY = event.clientY - rect.top;
const ratio = relativeY / rect.height;

if (overNode.nodeType === 'layout') {
  // Top 25% → before, Bottom 25% → after, Middle 50% → inside
  position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
} else {
  // Elements: only before/after
  position = ratio < 0.5 ? 'before' : 'after';
}
```

**Duplicate fix:**
```ts
// Currently duplicates go to end. Fix: insert adjacent to original.
const original = nodes.get(nodeId);
const nextSibling = getNextSibling(original); // same parent, order > original
const newOrder = resolveDropOrder(original.order, nextSibling?.order);
// Insert duplicate with newOrder, same parentId
```

**Drop zone validation:**
- Layout nodes: accept any child
- Element/component nodes: no children (drop → reparent to their parent instead)

---

## 5. Right Panel (2 Tabs)

### Properties Tab

Collapsible accordion sections, only relevant sections shown per node type:

| Section | Shown for |
|---------|-----------|
| Layout (flex/grid) | layout nodes |
| Size (w/h) | all nodes |
| Style (bg, border, shadow, radius) | all nodes |
| Typography (font, size, weight, color, align) | element nodes with text |

All inputs: controlled, update `CanvasContext` on change (debounced 300ms for text inputs, immediate for buttons/toggles). Sync queue flushes to STDB in background.

### Settings Tab

Shown when an `component` node is selected. Dynamically renders form from settings schema.

**Schema loading order:**
1. Check `ComponentVersion.settingsSchema` in MySQL DB via `/api/components/{componentId}/schema` — fast cached load
2. Attempt to dynamically import the ESM component URL and check for exported `settings` object — can override DB schema
3. Fall back to empty state with message "No settings defined for this component"

**Schema types supported** (ported from v2's `DynamicInputs.tsx`):

```ts
type SettingType =
  | 'text'           // text input
  | 'textarea'       // multiline text
  | 'number_slider'  // range + number input
  | 'select'         // dropdown
  | 'color'          // color picker
  | 'boolean'        // toggle
  | 'array'          // add/remove list (text items)
  | 'array_object'   // list of objects (e.g., slides with url + alt)
```

**Schema declaration in ESM component:**
```ts
// Component exports this alongside the React component:
export const settings = {
  slides: {
    type: 'array_object',
    label: 'Slides',
    itemSchema: {
      src: { type: 'text', label: 'Image URL' },
      alt: { type: 'text', label: 'Alt text' },
    }
  },
  autoplay: { type: 'boolean', label: 'Autoplay', default: false },
  slidesPerView: { type: 'number_slider', label: 'Slides per view', min: 1, max: 5, default: 3 },
};
```

Settings values saved to `canvas_node.settings` JSON field via `update_node_settings` reducer.

---

## 6. Toolbar

```
┌────────────────────────────────────────────────────────────────┐
│ [← Back]  SeloraX Canvas      [●Connected]  [Preview▶] [Publish]│
└────────────────────────────────────────────────────────────────┘
```

- **Back:** Returns to pages list
- **Title:** Tenant + "Canvas"
- **Connection dot:** Green (live) / Red (disconnected) — shows STDB connection status
- **Preview:** Opens preview in new tab (`/preview/{pageId}`)
- **Publish:** Orange CTA button — triggers publish pipeline

---

## 7. AI Bar

Keep existing AIBar.tsx and AIStatusBar.tsx functionality. Style update to white theme:
- White background, border-top separator
- Collapsible (chevron toggle)
- AI progress bar uses orange `#F47920`

---

## 8. What We Are NOT Changing

- `spacetime/src/module.ts` — STDB schema is untouched
- `apps/canvas-backend/` — all API routes, Mastra agent, publish pipeline untouched
- `packages/renderer/` — storefront renderer untouched
- `packages/types/` — shared types untouched
- `apps/storefront/` — untouched
- `apps/preview-server/` — untouched
- STDB `canvas_node` schema: still flat array with `parentId`, `order`, `styles`, `props`, `settings` JSON fields
- All existing utilities: `tree.ts`, `drop-order.ts`, `rubber-band.ts`, `selection.ts`, `clipboard.ts`

---

## 9. Files to Create / Modify

### New Files
```
apps/canvas-dashboard/src/context/
  CanvasContext.tsx              # Central state + sync queue
  useCanvas.ts                   # Hook to consume context

apps/canvas-dashboard/src/components/canvas/
  ElementsPanel.tsx              # New 4th left panel tab
  FloatingToolbar.tsx            # Floating action bar above selection
  DropZoneIndicator.tsx          # Visual drop line/highlight component
  DynamicInputs.tsx              # Schema-driven form renderer (from v2)
```

### Modified Files
```
apps/canvas-dashboard/src/app/canvas/[pageId]/
  components/CanvasPage.tsx      # Add CanvasContext.Provider
  components/Canvas.tsx          # Connect to context, update DnD drop logic
  components/CanvasNode.tsx      # Inline editing, floating toolbar, white theme
  components/panels/LeftPanel.tsx   # Add Elements tab
  components/panels/LayersTree.tsx  # Collapse/rename/delete improvements
  components/panels/RightPanel.tsx  # Properties + Settings tabs
  components/panels/StyleEditor.tsx # Controlled inputs, white theme
  components/panels/LayoutPanel.tsx # White theme, accordion
  components/toolbar/Toolbar.tsx    # White theme, brand colors
  components/toolbar/PublishButton.tsx # Orange CTA style

apps/canvas-dashboard/src/app/globals.css  # Full white theme rewrite
```

---

## 10. Implementation Phases

1. **Phase 1 — CanvasContext + Sync Queue** (foundation)
2. **Phase 2 — White Theme CSS** (visual polish)
3. **Phase 3 — Elements Tab + Click-to-Add** (add elements)
4. **Phase 4 — DnD Drop Zones + Duplicate Fix** (drag polish)
5. **Phase 5 — Inline Text Editing** (double-click edit)
6. **Phase 6 — Right Panel Redesign** (Properties accordion + Settings tab)
7. **Phase 7 — Floating Toolbar + Layers Improvements** (UX polish)
8. **Phase 8 — Dynamic Settings (DynamicInputs + ESM schema)** (per-component settings)

---

## 11. Key References from v2

| Feature | v2 File to Reference |
|---------|---------------------|
| Optimistic context | `src/context/FunnelContext.tsx` (1382 lines) |
| Drop zone detection | `src/components/ElementRenderer.tsx` lines 48-91 |
| Inline contentEditable | `src/components/EditableText.tsx` |
| Schema-driven form | `src/components/properties/DynamicInputs.tsx` |
| Layers panel improvements | `src/components/LayersPanel.tsx` |
| DnD scroll detection | `src/components/Canvas.tsx` lines 124-256 |
| Settings schema type | `src/types.ts` lines 137-186 |
| Custom component def | `src/components/custom-registry/ListBlock.tsx` |
