# Canvas V3 Phase 4 — Real-Time Collaboration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Changes made by one user appear live on other users' canvases. Live cursors show where each connected user is working.

**Architecture:** `StdbSyncProvider` already syncs local → STDB (Phase 1). This phase adds the reverse: STDB → FunnelContext merge, plus cursor broadcast via `active_cursor` STDB table. Remote changes that don't conflict with local edits (not in `dirtySet`) are merged directly into FunnelContext.

**Tech Stack:** SpacetimeDB v2.0.1 `useTable`, `FunnelContext` reducer, `canvas_node` and `active_cursor` STDB tables

---

## Context

- `StdbSyncProvider.tsx` is at `apps/canvas-v2/src/providers/StdbSyncProvider.tsx`
- `FunnelContext.tsx` is at `apps/canvas-v2/src/context/FunnelContext.tsx`
- `Canvas.tsx` is at `apps/canvas-v2/src/components/Canvas.tsx`
- `useTable(tables.canvas_node)` fires `onInsert/onUpdate/onDelete` on ALL changes (local and remote)
- Phase 1 already has `dirtySet` tracking which node IDs were recently mutated locally
- The merge stub in `StdbSyncProvider` currently returns early without doing anything. We now implement it.
- `nodeConverter.ts` has `flatNodesToTree` and the `RawCanvasNode` type — reuse these
- `active_cursor` table fields (camelCase): `id`, `pageId`, `tenantId`, `userId`, `x`, `y`, `updatedAt`
- Cursor reducers: `conn.reducers.upsertCursor({ pageId, tenantId, x, y })` and `conn.reducers.removeCursor({ pageId, tenantId })`

**IMPORTANT - Read these files before implementing:**
- `apps/canvas-v2/src/providers/StdbSyncProvider.tsx` — understand current state
- `apps/canvas-v2/src/context/FunnelContext.tsx` — understand dispatch types and reducer
- `apps/canvas-v2/src/lib/nodeConverter.ts` — understand `canvasNodeToElement` conversion
- `apps/canvas-v2/src/components/Canvas.tsx` — first 30 lines to understand props/structure

---

## Task 1: Add STDB_MERGE action to FunnelContext

**Files:**
- Modify: `src/context/FunnelContext.tsx`

**Step 1: Read FunnelContext.tsx to understand the current action types and reducer**

Look for the `type FunnelAction` union and the `funnelReducer` switch statement.

**Step 2: Add STDB_MERGE to the action union**

Find the `type FunnelAction = ...` union and add:
```typescript
| { type: "STDB_MERGE"; payload: { nodeId: string; operation: "upsert" | "delete"; element?: FunnelElement } }
```

**Step 3: Add STDB_MERGE case to the reducer**

In the `funnelReducer` switch, add a new case. The merge must:
- For `delete`: remove the element by ID from the tree (including nested children search)
- For `upsert`: if element exists in tree → update it in place; if not → add to root (will be repositioned by order when more context is available)

```typescript
case "STDB_MERGE": {
  const { nodeId, operation, element } = action.payload;
  if (operation === "delete") {
    return {
      ...state,
      elements: removeElementById(state.elements, nodeId),
    };
  }
  if (operation === "upsert" && element) {
    const exists = findElementById(state.elements, nodeId);
    if (exists) {
      return {
        ...state,
        elements: updateElementById(state.elements, nodeId, element),
      };
    }
    // New element from remote — append to root (will be tree-sorted on next full sync)
    return {
      ...state,
      elements: [...state.elements, element],
    };
  }
  return state;
}
```

**Step 4: Add the helper functions if they don't exist**

Check if `removeElementById`, `findElementById`, `updateElementById` are already in FunnelContext. If not, add them as local functions above the reducer:

```typescript
function removeElementById(elements: FunnelElement[], id: string): FunnelElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) =>
      el.children
        ? { ...el, children: removeElementById(el.children, id) }
        : el
    );
}

function findElementById(elements: FunnelElement[], id: string): FunnelElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.children) {
      const found = findElementById(el.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateElementById(
  elements: FunnelElement[],
  id: string,
  updated: FunnelElement
): FunnelElement[] {
  return elements.map((el) => {
    if (el.id === id) return { ...el, ...updated };
    if (el.children) {
      return { ...el, children: updateElementById(el.children, id, updated) };
    }
    return el;
  });
}
```

**Step 5: Commit**
```bash
git add apps/canvas-v2/src/context/FunnelContext.tsx
git commit -m "feat(canvas-v2): add STDB_MERGE action to FunnelContext"
```

---

## Task 2: Implement remote merge in StdbSyncProvider

**Files:**
- Modify: `src/providers/StdbSyncProvider.tsx`

**Step 1: Read the current StdbSyncProvider.tsx to understand the stub**

The merge stub was added in Phase 1 as a placeholder. Find the comment `// Phase 2 placeholder` or similar.

**Step 2: Replace the stub with real merge logic**

The key section to find and replace is the part after `initialized.current` is true where remote node changes come in.

In `StdbSyncInner`, the `useEffect` that watches `flatNodes` currently does nothing for remote changes after initialization. Update it to call `dispatch({ type: "STDB_MERGE", ... })`.

The pattern to implement:

```typescript
// After initial load is complete, watch for remote changes
const prevNodesRef = useRef<Map<string, RawCanvasNode>>(new Map());

useEffect(() => {
  if (!initialized.current) return;

  const filtered = flatNodes.filter(
    (n) => n.pageId === pageId && n.tenantId === tenantId
  );

  const currentMap = new Map(filtered.map((n) => [n.id, n]));
  const prevMap = prevNodesRef.current;

  // Detect upserts (new or changed)
  for (const [id, node] of currentMap) {
    if (dirtyIds.current.has(id)) continue; // local edit, skip

    const prev = prevMap.get(id);
    // New node or changed node
    if (!prev || JSON.stringify(prev) !== JSON.stringify(node)) {
      const element = canvasNodeToElement(node);
      if (element) {
        dispatch({ type: "STDB_MERGE", payload: { nodeId: id, operation: "upsert", element } });
      }
    }
  }

  // Detect deletes
  for (const [id] of prevMap) {
    if (!currentMap.has(id) && !dirtyIds.current.has(id)) {
      dispatch({ type: "STDB_MERGE", payload: { nodeId: id, operation: "delete" } });
    }
  }

  prevNodesRef.current = currentMap;
}, [flatNodes, pageId, tenantId]);
```

**Step 3: Import canvasNodeToElement from nodeConverter**

In the imports at the top of `StdbSyncProvider.tsx`, add:
```typescript
import { canvasNodeToElement } from "../lib/nodeConverter";
```

Check if `canvasNodeToElement` is exported from `nodeConverter.ts`. If it's named differently (e.g., it's part of `flatNodesToTree`), extract a single-node conversion function:

In `nodeConverter.ts`, add (if not already exported):
```typescript
export function canvasNodeToElement(node: RawCanvasNode): FunnelElement | null {
  // Extract a single flat node → FunnelElement (no children, just the node itself)
  const type = toElementType(node.nodeType, node.props);
  if (!type) return null;
  let style: CSSProperties = {};
  let tabletStyle: CSSProperties | undefined;
  let mobileStyle: CSSProperties | undefined;
  try {
    style = JSON.parse(node.styles || "{}");
  } catch {}
  let customType: string | undefined;
  let data: Record<string, any> | undefined;
  let className: string | undefined;
  let content: string | undefined;
  let src: string | undefined;
  try {
    const props = JSON.parse(node.props || "{}");
    content = props.content;
    src = props.src;
  } catch {}
  try {
    const settings = JSON.parse(node.settings || "{}");
    tabletStyle = settings.breakpoints?.md;
    mobileStyle = settings.breakpoints?.sm;
    customType = settings.customType;
    data = settings.data;
    className = settings.className;
  } catch {}
  return {
    id: node.id,
    type,
    name: (() => { try { return JSON.parse(node.props || "{}").label ?? ""; } catch { return ""; } })(),
    style,
    tabletStyle,
    mobileStyle,
    content,
    src,
    customType,
    data,
    className,
  };
}
```

**Step 4: Verify — open two browser tabs to the same editor page**

- Tab 1: `http://localhost:3005/editor/[pageId]`
- Tab 2: `http://localhost:3005/editor/[pageId]`
- In Tab 1: drag an element onto the canvas
- In Tab 2: should see the new element appear within ~2 seconds
- In Tab 1: change a style (e.g., background color)
- In Tab 2: should see the style change appear

**Step 5: Commit**
```bash
git add apps/canvas-v2/src/providers/StdbSyncProvider.tsx apps/canvas-v2/src/lib/nodeConverter.ts
git commit -m "feat(canvas-v2): implement remote merge from STDB into FunnelContext"
```

---

## Task 3: Create LiveCursors component

**Files:**
- Create: `src/components/LiveCursors.tsx`

**Step 1: Create `src/components/LiveCursors.tsx`**

```tsx
"use client";
import { useTable } from "spacetimedb/react";
import { DbConnection } from "../module_bindings";
import { tables } from "../module_bindings";
import { useSpacetimeDB } from "spacetimedb/react";
import { useMemo } from "react";

// Derive a consistent color from a string (userId or cursor id)
function colorFromId(id: string): string {
  const colors = [
    "#EF4444", "#F97316", "#EAB308", "#22C55E",
    "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  pageId: string;
  tenantId: string;
  currentUserId?: string; // to exclude own cursor
}

export function LiveCursors({ pageId, tenantId, currentUserId }: Props) {
  const [allCursors] = useTable(tables.active_cursor);

  const cursors = useMemo(
    () => allCursors.filter(
      (c) => c.pageId === pageId && c.tenantId === tenantId && c.id !== currentUserId
    ),
    [allCursors, pageId, tenantId, currentUserId]
  );

  return (
    <>
      {cursors.map((cursor) => {
        const color = colorFromId(cursor.id);
        return (
          <div
            key={cursor.id}
            className="absolute pointer-events-none z-50 transition-all duration-100"
            style={{ left: cursor.x, top: cursor.y }}
          >
            {/* Cursor dot */}
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: color }}
            />
            {/* Name label */}
            <div
              className="absolute top-4 left-0 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color }}
            >
              User
            </div>
          </div>
        );
      })}
    </>
  );
}
```

**Step 2: Commit**
```bash
git add apps/canvas-v2/src/components/LiveCursors.tsx
git commit -m "feat(canvas-v2): add LiveCursors component"
```

---

## Task 4: Add cursor broadcast and LiveCursors overlay to Canvas

**Files:**
- Modify: `src/providers/StdbSyncProvider.tsx`
- Modify: `src/components/Canvas.tsx`

**Step 1: Add cursor broadcast in StdbSyncProvider**

In `StdbSyncInner`, add cursor tracking:

```typescript
// Broadcast cursor position on mousemove (throttled to 50ms)
const lastCursorSend = useRef(0);

const handleMouseMove = useCallback((e: MouseEvent) => {
  const now = Date.now();
  if (now - lastCursorSend.current < 50) return;
  lastCursorSend.current = now;
  const conn = connRef.current;
  if (!conn) return;
  // Get position relative to the document
  try {
    conn.reducers.upsertCursor({ pageId, tenantId, x: e.clientX, y: e.clientY });
  } catch {}
}, [pageId, tenantId]);

useEffect(() => {
  window.addEventListener("mousemove", handleMouseMove);
  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    // Remove cursor on unmount
    const conn = connRef.current;
    if (conn) {
      try { conn.reducers.removeCursor({ pageId, tenantId }); } catch {}
    }
  };
}, [handleMouseMove, pageId, tenantId]);
```

**Step 2: Add LiveCursors to Canvas.tsx**

Read `Canvas.tsx` to find where the canvas root div is. Add `LiveCursors` as an absolute-positioned overlay:

```tsx
// Add import at top:
import { LiveCursors } from "./LiveCursors";

// Inside the canvas root div (the one with position: relative):
// Add LiveCursors as the last child:
<LiveCursors pageId={pageId} tenantId={tenantId} />
```

`Canvas.tsx` needs `pageId` and `tenantId` as props. Check if they're already there. If not:
- Add them to the `CanvasProps` interface
- Pass them from `EditorLayout.tsx` (which gets them from `FunnelBuilder.tsx`)

**Step 3: Verify**
- Open two browser windows to the same page
- Move the mouse in window 1
- Should see a colored dot following in window 2

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/providers/StdbSyncProvider.tsx apps/canvas-v2/src/components/Canvas.tsx
git commit -m "feat(canvas-v2): add live cursor broadcast and overlay"
```
