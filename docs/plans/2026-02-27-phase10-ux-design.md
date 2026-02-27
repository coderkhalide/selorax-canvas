# Phase 10 UX Design — DnD + Component Browser + Funnel Builder

**Date:** 2026-02-27

## Goal
Bring the canvas-dashboard to Figma/Framer quality UX with three major features:
1. Drag & Drop node reordering (canvas + layers tree → `move_node` reducer)
2. Component library browser (left panel tab, fetches `/api/components`)
3. Funnel builder (visual flow editor, left panel tab, REST API)

## Architecture

### Left Panel: 3-Tab Structure
```
[Layers] [Components] [Funnels]
```
Tab state in `CanvasInner`, passed down to `LeftPanel`. Each tab is an independent component.

### DnD Library
`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- One `DndContext` wraps the entire canvas layout (in `CanvasPage`)
- Both layers tree items AND canvas nodes are draggable
- Drop zones: between siblings (reorder) and onto layout nodes (reparent)
- Ghost/overlay: `DragOverlay` with semi-transparent node preview
- On drop: calculate new `order` string via fractional indexing, call `conn.reducers.moveNode()`
- Locked nodes are non-draggable

### Fractional Indexing for Drop Order
- Nodes above drop target: `prevOrder`
- Nodes below drop target: `nextOrder`
- New order = midpoint string between prevOrder and nextOrder
- Edge cases: drop at start → order before first; drop at end → order after last

### Component Browser
- Fetch `GET /api/components` on tab open (with `x-tenant-id` header)
- Client-side search filter
- Grouped: "My Components" + "Public Library"
- Drag component card → `DragOverlay` + canvas drop zone → `conn.reducers.insertNode()` with `node_type: 'component'`
- Click card → inject at end of root node

### Funnel Builder
- Fetch `GET /api/funnels` on tab open
- Collapsible funnel list
- Expanded funnel: horizontal step cards with SVG arrows
- Step config flyout: page select, step type, on-success/skip actions
- All mutations via REST: POST /api/funnels, PATCH /api/funnels/:id
- Local optimistic state (no STDB — funnels live in MySQL only)
- Step reorder: dnd-kit sortable → PATCH

## Files Changed

### New files
- `panels/ComponentBrowser.tsx`
- `panels/FunnelBuilder.tsx`
- `panels/FunnelStepConfig.tsx`
- `__tests__/resolve-drop-order.test.ts`
- `__tests__/ComponentBrowser.test.tsx`
- `__tests__/FunnelBuilder.test.tsx`

### Modified files
- `panels/LeftPanel.tsx` — 3-tab header
- `panels/LayersTree.tsx` — dnd-kit drag handles + drop zones
- `Canvas.tsx` — drop zones between nodes
- `CanvasNode.tsx` — drag handle on hover
- `CanvasPage.tsx` — wrap with DndContext
- `app/globals.css` — DnD styles, component grid, funnel flow
- `package.json` — add dnd-kit packages

## CSS Design Tokens (consistent with existing dark theme)
- Drag handle: `#4B5563` (gray-600), appears on hover
- Drop indicator: `2px solid #7C3AED` (purple accent)
- Ghost opacity: `0.5`
- Component card: `#1a1d27` bg, `#7C3AED` border on hover
- Funnel step card: `#161921` bg, 12px border-radius
- Funnel arrow: `#7C3AED` SVG

## Testing
- `resolve-drop-order.test.ts` — unit tests for fractional index calculation
- `ComponentBrowser.test.tsx` — fetch on mount, search filter, inject on click
- `FunnelBuilder.test.tsx` — create funnel, add/remove steps, reorder
