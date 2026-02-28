# Funnel Management + Drop Zone Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans then superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a standalone funnel management UI in canvas-dashboard and improve canvas drop zone UX to match v2's polished drag-and-drop experience.

**Architecture:** Two independent features. Funnel management adds new Next.js routes (`/funnels`, `/funnels/[funnelId]`) backed by existing Express routes. Drop zone improvements extend the existing @dnd-kit setup with visual enhancements and panel-to-canvas drag support.

**Tech Stack:** Next.js 14 App Router, @dnd-kit/core, Express + Prisma (existing), React hooks, CSS custom properties

---

## Feature 1: Funnel Management Pages

### Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/funnels` | Server Component | Lists all tenant funnels as card grid |
| `/funnels/[funnelId]` | Server Component | Shows funnel detail with step flow |

Both fetch from the canvas-backend (port 3001) using `x-tenant-id` header. After mutations, client calls `router.refresh()` to trigger server re-fetch.

### Files to Create

```
apps/canvas-dashboard/src/app/funnels/
  page.tsx                          — Server Component: fetches GET /api/funnels
  [funnelId]/
    page.tsx                        — Server Component: fetches GET /api/funnels/:id
    components/
      FunnelDetailView.tsx          — Step flow, + Add Step, step card actions
      ConfigureStepModal.tsx        — Step type + on-success config modal
      AddStepModal.tsx              — Page selector + step type modal
  components/
    FunnelList.tsx                  — Card grid with + New Funnel button
    FunnelCard.tsx                  — Single card: name, status, step count, actions
    CreateFunnelModal.tsx           — Modal with name input → POST /api/funnels
```

### Data Flow

**Listing page:**
```
Server: fetch(`${BACKEND}/api/funnels`, { headers: { 'x-tenant-id': tenantId } })
→ pass data to <FunnelList> client component
```

**Detail page:**
```
Server: fetch(`${BACKEND}/api/funnels/${funnelId}`, { ... })
→ pass funnel (with steps + page info) to <FunnelDetailView>
```

**Mutations (all client-side, then router.refresh()):**
- Create funnel: `POST /api/funnels` `{ name }`
- Delete funnel: `DELETE /api/funnels/:id`
- Add step: `POST /api/funnels/:id` with step body — wait, backend doesn't have add-step endpoint separately. Steps are created when creating funnel or via a full update.

> **Note:** The backend `POST /api/funnels` accepts optional `steps[]`. Adding a step to an existing funnel requires `PATCH /api/funnels/:id` — but current backend only patches name/goal/status. For step management, we'll need a `POST /api/funnels/:id/steps` endpoint or use the Mastra `update_funnel_steps` tool pattern.

> **Alternative for step CRUD:** Call `PATCH /api/funnels/:id` with updated steps array by first fetching current steps, merging, then posting.

### UI Spec

**`/funnels` — Listing Page:**
- Page header: "Funnels" title + `+ New Funnel` button (top right)
- Card grid (3 columns on desktop, responsive): each card shows:
  - Funnel name (bold)
  - Status badge: `draft` (gray), `live` (green), `archived` (muted)
  - Step count: "3 steps" or "No steps yet"
  - Actions: `Edit` (→ `/funnels/[id]`), `Preview` (→ opens first step page in new tab)
  - Hover: delete icon (confirmation before DELETE)
- Empty state: "No funnels yet. Create your first funnel."

**`CreateFunnelModal`:**
- Fields: Name (required text input)
- Submit → `POST /api/funnels { name, tenantId }` → `router.refresh()` + close modal

**`/funnels/[funnelId]` — Detail Page:**
- Back link → `/funnels`
- Funnel name (h1) + status badge + Edit Name button (inline rename)
- Vertical step flow:
  ```
  [Step 1] Landing • page-slug
  [Edit Page] [Preview] [Configure] [Remove]
       ↓
  [Step 2] Checkout • checkout-slug
  [Edit Page] [Preview] [Configure] [Remove]
       ↓
  [+ Add Step]
  ```
- Each step card: step number, step type badge, page name/slug, 4 action buttons
- `Edit Page` → `/canvas/[pageId]`
- `Preview` → open preview URL in new tab
- `Configure` → opens `ConfigureStepModal`
- `Remove` → DELETE step from funnel (confirm first)

**`AddStepModal`:**
- Fetches `GET /api/pages` to get list of pages (page name + slug)
- Dropdown/select for page
- Step type dropdown: landing, checkout, upsell, downsell, thankyou
- Step order: auto-appended at end (stepOrder = current steps.length)
- Submit → adds step to funnel via PATCH

**`ConfigureStepModal`:**
- Step name (text)
- Step type (dropdown)
- On Success action: next / skip / external URL
- Save → PATCH step

### Backend Note

The existing `PATCH /api/funnels/:id` only updates `name`, `goal`, `status`. We need a way to add/update/delete steps. Options:
- Add `POST /api/funnels/:id/steps` and `DELETE /api/funnels/:id/steps/:stepId` routes to backend
- OR: PATCH with full steps array (replace all steps)

**Decision: Add two new backend routes** for step CRUD:
- `POST /api/funnels/:id/steps` — add a step
- `DELETE /api/funnels/:id/steps/:stepId` — remove a step
- `PATCH /api/funnels/:id/steps/:stepId` — update a step

---

## Feature 2: Drop Zone Improvements

### Problem

Current canvas drop UX:
- No visual hint in empty layout containers
- Drop indicators (before/after line) are minimal
- Elements in the left panel can only be added by clicking — no drag-to-canvas

### Solution

Three improvements:
1. **Empty container hint** — `Drop Here` text + dashed border in empty layouts
2. **Visual drop indicators** — brighter blue line for before/after, navy fill overlay for inside
3. **Panel drag support** — Elements panel cards are now draggable; dropping on canvas calls `insertNode`

### Files to Modify

| File | Change |
|------|--------|
| `ElementsPanel.tsx` | Add `useDraggable` to each element card |
| `CanvasNode.tsx` | Add `drop-here-hint` for empty layouts; pass `isOver` to CSS |
| `CanvasPage.tsx` | Extend `handleDragEnd` to detect and handle panel drags |
| `globals.css` | Add/improve drop zone CSS classes |

### Drop Zone Visual Spec

**Empty container hint (no children):**
```css
.drop-here-hint {
  border: 2px dashed var(--border);     /* gray dashed */
  border-radius: 6px;
  min-height: 60px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary);
  font-size: 12px;
  pointer-events: none;
  margin: 8px;
}
/* When parent layout is active drop target: */
.canvas-node-layout.is-drop-inside .drop-here-hint {
  border-color: var(--brand-navy);
  background: rgba(45, 47, 143, 0.05);
  color: var(--brand-navy);
}
```

**Before/after line:**
```css
.drop-zone-line {
  height: 3px;
  background: var(--brand-navy);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(45, 47, 143, 0.4);
  margin: 2px 0;
  position: relative;
}
/* Dot cap at line start */
.drop-zone-line::before {
  content: '';
  position: absolute; left: -4px; top: -3px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--brand-navy);
}
```

**Inside container overlay (isOver layout):**
- `outline: 2px dashed var(--brand-navy)` (already exists, keep)
- `background: rgba(45, 47, 143, 0.04)` (subtle navy tint)

### Panel Drag Implementation

**`ElementsPanel.tsx`** — Each card uses `useDraggable`:
```tsx
const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
  id: `new-${def.id}`,
  data: { type: 'new-element', def },
});
```
Card still has `onClick` for click-to-add. When `isDragging`, reduce opacity to 0.5.

**`CanvasPage.tsx` `handleDragEnd`** — Detect panel drags:
```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

  // Panel element dropped onto canvas
  if (active.data.current?.type === 'new-element') {
    if (!over) return;
    const def = active.data.current.def;
    insertNode({
      pageId, tenantId,
      nodeType: def.nodeType,
      parentId: dropInfo?.position === 'inside' ? over.id as string : null,
      order: 'z' + Date.now().toString(36),
      props: JSON.stringify(def.defaultProps ?? {}),
      styles: JSON.stringify(def.defaultStyles ?? {}),
      settings: '{}',
    });
    setDropInfo(null);
    return;
  }

  // Existing node moved (current logic)
  ...
};
```

**`ElementsPanel.tsx` element definitions** — Each `ELEMENTS` entry needs `defaultProps` and `defaultStyles`:
```ts
{ id: 'heading', nodeType: 'element', icon: 'T', label: 'Heading',
  defaultProps: { tag: 'heading', level: 2, content: 'New Heading' },
  defaultStyles: { fontSize: '28px', fontWeight: '700', color: '#1a1a2e' } }
```

---

## Testing

**Funnel management:**
- Backend: New step CRUD routes need tests in `funnels.test.ts`
- Frontend: No unit tests needed (Server Components + simple client mutations)

**Drop zone:**
- Manual test: drag element from panel to empty canvas → node inserted
- Manual test: drag element from panel to before/after existing node → node inserted at position
- Manual test: existing node drag still works

---

## Out of Scope

- AI-generated funnels (the `aiGenerated` / `aiPrompt` fields on the Funnel model)
- Funnel publishing / status management UI
- Analytics on the funnel listing page
- Auto-scroll during canvas drag (v2 feature, can be added later)
