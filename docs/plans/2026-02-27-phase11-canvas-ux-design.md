# Phase 11 Canvas UX — Multi-Select, Layout Controls, Screenshots

**Date:** 2026-02-27

## Goal

Bring the canvas-dashboard to Figma/Framer quality by adding three features:
1. Multi-select with rubber band + full context menu (Group, Ungroup, Duplicate, Lock, Rename, Copy/Paste, Bring to Front/Back, Delete)
2. Flex + Grid layout controls in the right panel (visual icon-button UI, not text inputs)
3. Pixel-perfect PNG/JPG export via `html-to-image`, auto-thumbnail on Publish

---

## Architecture

### Feature 1: Multi-Select + Context Menu

**State change in `CanvasPage.tsx`:**
- Replace `selectedId: string | null` with `selectedIds: Set<string>`
- All child components receive `selectedIds` instead of `selectedId`

**Shift-click:** If Shift held, toggle node in `selectedIds`. Otherwise, clear and select one.

**Rubber band selection:**
- `mousedown` on `.canvas-frame` empty area (not on a node) → record `rubberStart: {x,y}`
- `mousemove` → update `rubberEnd: {x,y}`, draw `.rubber-band` overlay div
- `mouseup` → query all `[data-node-id]` with `getBoundingClientRect()`, add intersecting nodes to `selectedIds`

**Context menu (`ContextMenu.tsx`):**
- Triggered by `onContextMenu` on `.canvas-frame` (bubbles up from nodes)
- Positioned absolutely at cursor, closes on outside click / Escape
- Items:

| Item | Visibility | Operation |
|------|------------|-----------|
| Group Selection | ≥2 selected | `insert_node` (layout) + `move_node` × N under it |
| Ungroup | 1 layout node selected | `move_node` × N to layout's parent + `delete_node_cascade` |
| Duplicate | ≥1 selected | deep-copy subtree: `insert_node` × N with new `crypto.randomUUID()` IDs |
| Lock / Unlock | ≥1 selected | `lock_node` / `unlock_node` per node |
| Rename | 1 selected | inline input in menu, `update_node_props({ label })` |
| Copy | ≥1 selected | serialize tree to `sessionStorage['canvas-clipboard']` |
| Paste | clipboard exists | deserialize + `insert_node` × N |
| Bring to Front | ≥1 selected | `move_node` with `resolveDropOrder(lastSibling.order, undefined)` |
| Send to Back | ≥1 selected | `move_node` with `resolveDropOrder(undefined, firstSibling.order)` |
| Delete | ≥1 selected | `delete_node_cascade` per node |

**No new STDB reducers needed** — all operations use existing: `insert_node`, `move_node`, `lock_node`, `unlock_node`, `update_node_props`, `delete_node_cascade`.

**Visual:** All nodes in `selectedIds` get the `2px solid #7C3AED` selection outline. The rubber band box is `rgba(124,58,237,0.15)` fill + `1px solid #7C3AED` border.

---

### Feature 2: Flex + Grid Layout Controls

**Location:** New `LayoutPanel.tsx` component in the right panel, rendered above `StyleEditor`. Visible when any node is selected.

**Display mode toggle** — always visible:
```
[Block] [Flex] [Grid] [None]
```
Sets `node.styles.display`. When display changes to flex/grid, the layout subsection appears.

**Flex controls:**
- Direction: `[→ Row] [↓ Column]` icon button group → `flexDirection`
- Wrap: `[No Wrap] [Wrap]` → `flexWrap`
- Align Items: 4 icon buttons (start / center / end / stretch) → `alignItems`
- Justify Content: 5 icon buttons (start / center / end / space-between / space-around) → `justifyContent`
- Gap: single px input → `gap`

**Grid controls:**
- Columns: number input → `gridTemplateColumns: repeat(N, 1fr)`
- Rows: text input (auto or number) → `gridTemplateRows`
- Column Gap: px input → `columnGap`
- Row Gap: px input → `rowGap`
- Align Items: icon buttons → `alignItems`
- Justify Content: icon buttons → `justifyContent`

**All changes:** `conn.reducers.updateNodeStyles({ nodeId, tenantId, styles: { display, flexDirection, ... } })` — patch-merges into existing styles.

**Gap visualizer:** When a node with `display: flex` or `display: grid` is selected and expanded, thin `#7C3AED` lines appear between its direct children in the canvas, showing the gap value.

---

### Feature 3: Pixel-Perfect Screenshots + Auto-Thumbnail

**Library:** `html-to-image` (npm) — captures DOM as canvas, handles custom fonts, CSS shadows, transforms. Better fidelity than `html2canvas`.

**Export button** added to `Toolbar.tsx`:
```
[Export ↓]  [Publish]
```

**Export dialog (inline dropdown):**
- Format: PNG | JPG
- Scale: 1x | 2x (retina)
- Action: Download file | Copy to clipboard

**Implementation:**
```typescript
import { toPng, toJpeg } from 'html-to-image';

const frame = document.querySelector('.canvas-frame') as HTMLElement;
const dataUrl = await toPng(frame, { pixelRatio: scale });
// download or clipboard
```

**Auto-thumbnail on Publish:** After the publish pipeline completes, the dashboard captures `.canvas-frame` at 1x and POSTs the PNG blob to a new backend endpoint `POST /api/pages/:id/thumbnail` which uploads to R2 at `thumbnails/{tenantId}/{pageId}.png`. The page list API returns `thumbnailUrl` for the pages index view.

---

## Files Changed

### New files (dashboard)
- `components/ContextMenu.tsx` — right-click menu component
- `components/panels/LayoutPanel.tsx` — flex/grid controls
- `components/ui/IconButton.tsx` — reusable icon button with active state
- `utils/clipboard.ts` — serialize/deserialize node tree for copy/paste
- `utils/rubber-band.ts` — rubber band selection geometry helpers

### Modified files (dashboard)
- `CanvasPage.tsx` — selectedIds set, rubber band state, DndContext still wraps
- `Canvas.tsx` — passes selectedIds, rubber band overlay, onContextMenu
- `CanvasNode.tsx` — accepts selectedIds (array/set check)
- `panels/RightPanel.tsx` — add LayoutPanel above StyleEditor
- `toolbar/Toolbar.tsx` — add Export button with dropdown
- `app/globals.css` — rubber band CSS, context menu CSS, layout panel CSS, icon button CSS

### New files (backend)
- `routes/thumbnail.ts` — `POST /api/pages/:id/thumbnail` → upload to R2

### Modified files (backend)
- `routes/pages.ts` — add `thumbnailUrl` field to page responses

---

## CSS Design Tokens
- Selection outline: `2px solid #7C3AED`
- Rubber band fill: `rgba(124,58,237,0.15)`
- Rubber band border: `1px solid #7C3AED`
- Context menu bg: `#1a1d27`, border: `#2a2d3a`, item hover: `rgba(124,58,237,0.1)`
- Layout panel icons: `#4B5563` inactive, `#7C3AED` active
- Gap visualizer lines: `#7C3AED` at 0.5px

---

## Testing
- `multi-select.test.ts` — shift-click, rubber band geometry, Group/Ungroup
- `LayoutPanel.test.tsx` — display toggle, flex controls, grid controls, updateNodeStyles called
- `screenshot.test.ts` — html-to-image mock, download trigger, clipboard copy
