# Canvas UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the slow STDB-direct canvas editor with an optimistic local-context architecture, white branded theme, elements panel, inline editing, drop zones, floating toolbar, and per-element settings.

**Architecture:** A new `CanvasContext` holds all node state in a `Map<string, CanvasNode>` and serves as the single source of truth for the UI. User actions update context immediately (instant feedback) and flush to SpacetimeDB via a 100ms debounce queue. AI-generated STDB changes merge back into context automatically via `useTable` sync.

**Tech Stack:** Next.js 14, React 18, SpacetimeDB v2 (`spacetimedb/react`), `@dnd-kit/core`, TypeScript

**Design Doc:** `docs/plans/2026-02-28-canvas-ux-overhaul-design.md`

**Brand Colors:** Navy `#2D2F8F` (selection/active), Orange `#F47920` (CTAs/publish)

---

## Task 1: CanvasContext — Optimistic State + Sync Queue

**Files:**
- Create: `apps/canvas-dashboard/src/context/CanvasContext.tsx`

**Context:** Currently every user action (drag, style edit) calls a STDB reducer directly and waits for the network round-trip (~1300ms) before the UI updates. This task creates a local React context that updates instantly and syncs to STDB in the background.

**Step 1: Create the context file**

```tsx
// apps/canvas-dashboard/src/context/CanvasContext.tsx
'use client';
import React, {
  createContext, useContext, useReducer,
  useRef, useCallback, useEffect,
} from 'react';
import { resolveDropOrder } from '@/utils/drop-order';
import { applySelect }       from '@/utils/selection';
import { duplicateNodes }    from '@/utils/clipboard';

// ── Types ──────────────────────────────────────────────────────────
export interface CanvasNode {
  id: string; pageId: string; tenantId: string;
  parentId: string | null;
  nodeType: 'layout' | 'element' | 'component';
  order: string;
  styles: string; props: string; settings: string;
  lockedBy?: string;
  componentUrl?: string; componentVersion?: string; componentId?: string;
}

interface CanvasState {
  nodes: Map<string, CanvasNode>;
  selectedIds: Set<string>;
  editingId: string | null;
  draggingId: string | null;
}

type CanvasAction =
  | { type: 'STDB_SYNC'; nodes: readonly any[] }
  | { type: 'INSERT'; node: CanvasNode }
  | { type: 'UPDATE_STYLES'; nodeId: string; patch: Record<string, string> }
  | { type: 'UPDATE_PROPS';  nodeId: string; patch: Record<string, unknown> }
  | { type: 'UPDATE_SETTINGS'; nodeId: string; patch: Record<string, unknown> }
  | { type: 'MOVE'; nodeId: string; newParentId: string | null; newOrder: string }
  | { type: 'DELETE'; nodeId: string }
  | { type: 'SET_SELECTED'; ids: Set<string> }
  | { type: 'SET_EDITING';  id: string | null }
  | { type: 'SET_DRAGGING'; id: string | null };

export interface CanvasContextValue {
  // State
  nodes: Map<string, CanvasNode>;
  flatNodes: CanvasNode[];
  selectedIds: Set<string>;
  editingId: string | null;
  draggingId: string | null;
  selectedNode: CanvasNode | null;
  // Selection
  selectNode: (id: string | null, shiftKey?: boolean) => void;
  multiSelectNodes: (ids: string[]) => void;
  setEditingId: (id: string | null) => void;
  setDraggingId: (id: string | null) => void;
  // CRUD (all optimistic)
  insertNode: (args: Omit<CanvasNode, 'id'> & { id?: string }) => string;
  updateStyles: (nodeId: string, patch: Record<string, string>) => void;
  updateProps:  (nodeId: string, patch: Record<string, unknown>) => void;
  updateSettings: (nodeId: string, patch: Record<string, unknown>) => void;
  moveNode: (nodeId: string, newParentId: string | null, newOrder: string) => void;
  deleteNode: (nodeId: string) => void;
  duplicateSelected: () => void;
}

// ── Reducer ────────────────────────────────────────────────────────
function reducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'STDB_SYNC': {
      const next = new Map<string, CanvasNode>();
      action.nodes.forEach((n: any) => next.set(n.id, n as CanvasNode));
      return { ...state, nodes: next };
    }
    case 'INSERT': {
      const next = new Map(state.nodes);
      next.set(action.node.id, action.node);
      return { ...state, nodes: next };
    }
    case 'UPDATE_STYLES': {
      const node = state.nodes.get(action.nodeId);
      if (!node) return state;
      const merged = { ...JSON.parse(node.styles || '{}'), ...action.patch };
      const next = new Map(state.nodes);
      next.set(action.nodeId, { ...node, styles: JSON.stringify(merged) });
      return { ...state, nodes: next };
    }
    case 'UPDATE_PROPS': {
      const node = state.nodes.get(action.nodeId);
      if (!node) return state;
      const merged = { ...JSON.parse(node.props || '{}'), ...action.patch };
      const next = new Map(state.nodes);
      next.set(action.nodeId, { ...node, props: JSON.stringify(merged) });
      return { ...state, nodes: next };
    }
    case 'UPDATE_SETTINGS': {
      const node = state.nodes.get(action.nodeId);
      if (!node) return state;
      const merged = { ...JSON.parse(node.settings || '{}'), ...action.patch };
      const next = new Map(state.nodes);
      next.set(action.nodeId, { ...node, settings: JSON.stringify(merged) });
      return { ...state, nodes: next };
    }
    case 'MOVE': {
      const node = state.nodes.get(action.nodeId);
      if (!node) return state;
      const next = new Map(state.nodes);
      next.set(action.nodeId, { ...node, parentId: action.newParentId, order: action.newOrder });
      return { ...state, nodes: next };
    }
    case 'DELETE': {
      const toDelete = new Set<string>();
      const cascade = (id: string) => {
        toDelete.add(id);
        state.nodes.forEach(n => { if (n.parentId === id) cascade(n.id); });
      };
      cascade(action.nodeId);
      const next = new Map(state.nodes);
      toDelete.forEach(id => next.delete(id));
      const newSel = new Set([...state.selectedIds].filter(id => !toDelete.has(id)));
      return { ...state, nodes: next, selectedIds: newSel };
    }
    case 'SET_SELECTED': return { ...state, selectedIds: action.ids };
    case 'SET_EDITING':  return { ...state, editingId: action.id };
    case 'SET_DRAGGING': return { ...state, draggingId: action.id };
    default: return state;
  }
}

// ── Context ────────────────────────────────────────────────────────
const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error('useCanvas must be used inside CanvasContextProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────
interface ProviderProps {
  conn: any;            // DbConnection | null
  stdbNodes: readonly any[]; // from useTable(tables.canvas_node)
  pageId: string;
  tenantId: string;
  children: React.ReactNode;
}

export function CanvasContextProvider({
  conn, stdbNodes, pageId, tenantId, children,
}: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    nodes: new Map(), selectedIds: new Set(),
    editingId: null, draggingId: null,
  });

  // Sync STDB → context whenever SpacetimeDB pushes updates (AI ops, other users)
  useEffect(() => {
    dispatch({ type: 'STDB_SYNC', nodes: stdbNodes });
  }, [stdbNodes]);

  // 100ms debounced sync queue — user actions go here after updating context
  const queue   = useRef<Array<() => void>>([]);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSync = useCallback((op: () => void) => {
    queue.current.push(op);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!conn) { queue.current = []; return; }
      queue.current.splice(0).forEach(fn => fn());
    }, 100);
  }, [conn]);

  // ── Derived ──
  const flatNodes    = Array.from(state.nodes.values());
  const lastSelId    = [...state.selectedIds].at(-1) ?? null;
  const selectedNode = lastSelId ? (state.nodes.get(lastSelId) ?? null) : null;

  // ── Actions ──
  const selectNode = useCallback((id: string | null, shiftKey = false) => {
    const cur = state.selectedIds;
    if (id === null) {
      cur.forEach(sid => conn?.reducers.unlockNode({ nodeId: sid }));
      dispatch({ type: 'SET_SELECTED', ids: new Set() });
      return;
    }
    const next = applySelect(cur, id, shiftKey);
    cur.forEach(sid  => { if (!next.has(sid)) conn?.reducers.unlockNode({ nodeId: sid }); });
    next.forEach(sid => { if (!cur.has(sid))  conn?.reducers.lockNode({ nodeId: sid }); });
    dispatch({ type: 'SET_SELECTED', ids: next });
  }, [state.selectedIds, conn]);

  const multiSelectNodes = useCallback((ids: string[]) => {
    const cur = state.selectedIds;
    const next = new Set(ids);
    cur.forEach(sid  => { if (!next.has(sid)) conn?.reducers.unlockNode({ nodeId: sid }); });
    ids.forEach(id   => { if (!cur.has(id))   conn?.reducers.lockNode({ nodeId: id }); });
    dispatch({ type: 'SET_SELECTED', ids: next });
  }, [state.selectedIds, conn]);

  const setEditingId  = useCallback((id: string | null) => dispatch({ type: 'SET_EDITING', id }), []);
  const setDraggingId = useCallback((id: string | null) => dispatch({ type: 'SET_DRAGGING', id }), []);

  const insertNode = useCallback((args: Omit<CanvasNode, 'id'> & { id?: string }) => {
    const id = args.id ?? crypto.randomUUID();
    const node: CanvasNode = { ...args, id, pageId, tenantId };
    dispatch({ type: 'INSERT', node });
    queueSync(() => conn?.reducers.insertNode({
      id, pageId, tenantId,
      parentId: node.parentId ?? undefined,
      nodeType: node.nodeType, order: node.order,
      styles: node.styles ?? '{}', props: node.props ?? '{}',
      settings: node.settings ?? '{}', childrenIds: '[]',
      componentUrl: node.componentUrl,
      componentVersion: node.componentVersion,
      componentId: node.componentId,
    }));
    return id;
  }, [conn, pageId, tenantId, queueSync]);

  const updateStyles = useCallback((nodeId: string, patch: Record<string, string>) => {
    dispatch({ type: 'UPDATE_STYLES', nodeId, patch });
    queueSync(() => conn?.reducers.updateNodeStyles({ nodeId, styles: JSON.stringify(patch) }));
  }, [conn, queueSync]);

  const updateProps = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_PROPS', nodeId, patch });
    queueSync(() => conn?.reducers.updateNodeProps({ nodeId, props: JSON.stringify(patch) }));
  }, [conn, queueSync]);

  const updateSettings = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_SETTINGS', nodeId, patch });
    queueSync(() => conn?.reducers.updateNodeSettings({ nodeId, settings: JSON.stringify(patch) }));
  }, [conn, queueSync]);

  const moveNode = useCallback((nodeId: string, newParentId: string | null, newOrder: string) => {
    dispatch({ type: 'MOVE', nodeId, newParentId, newOrder });
    queueSync(() => conn?.reducers.moveNode({ nodeId, newParentId: newParentId ?? 'root', newOrder }));
  }, [conn, queueSync]);

  const deleteNode = useCallback((nodeId: string) => {
    conn?.reducers.unlockNode({ nodeId });
    dispatch({ type: 'DELETE', nodeId });
    queueSync(() => conn?.reducers.deleteNodeCascade({ nodeId }));
  }, [conn, queueSync]);

  const duplicateSelected = useCallback(() => {
    const selArray = [...state.selectedIds];
    if (!selArray.length) return;
    const nodesArr = Array.from(state.nodes.values());
    const first = state.nodes.get(selArray[0]);
    if (!first) return;
    const siblings = nodesArr
      .filter(n => n.parentId === first.parentId)
      .sort((a, b) => a.order.localeCompare(b.order));
    const origIdx   = siblings.findIndex(n => n.id === first.id);
    const nextSib   = siblings[origIdx + 1];
    const baseOrder = resolveDropOrder(first.order, nextSib?.order);
    const newNodes  = duplicateNodes(selArray, nodesArr, baseOrder);
    newNodes.forEach(n => {
      dispatch({ type: 'INSERT', node: { ...n, pageId, tenantId } as CanvasNode });
      queueSync(() => conn?.reducers.insertNode({
        id: n.id, pageId, tenantId,
        parentId: n.parentId ?? undefined,
        nodeType: n.nodeType, order: n.order,
        styles: n.styles ?? '{}', props: n.props ?? '{}',
        settings: n.settings ?? '{}', childrenIds: '[]',
        componentUrl: n.componentUrl, componentVersion: n.componentVersion,
        componentId: n.componentId ?? undefined,
      }));
    });
    const newIds = new Set(newNodes.map(n => n.id));
    const topLevel = newNodes.filter(n => !newIds.has(n.parentId ?? ''));
    selArray.forEach(id => conn?.reducers.unlockNode({ nodeId: id }));
    dispatch({ type: 'SET_SELECTED', ids: new Set(topLevel.map(n => n.id)) });
    topLevel.forEach(n => conn?.reducers.lockNode({ nodeId: n.id }));
  }, [state.selectedIds, state.nodes, conn, pageId, tenantId, queueSync]);

  const value: CanvasContextValue = {
    nodes: state.nodes, flatNodes, selectedIds: state.selectedIds,
    editingId: state.editingId, draggingId: state.draggingId,
    selectedNode,
    selectNode, multiSelectNodes, setEditingId, setDraggingId,
    insertNode, updateStyles, updateProps, updateSettings,
    moveNode, deleteNode, duplicateSelected,
  };

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}
```

**Step 2: Write unit test for the reducer**

```typescript
// apps/canvas-dashboard/src/context/CanvasContext.test.ts
// Note: test the reducer in isolation — it's a pure function
import { describe, it, expect } from 'vitest';

// We need to extract the reducer for testing.
// Add this export to CanvasContext.tsx: export { reducer as canvasReducer };

import { canvasReducer } from './CanvasContext';

const makeNode = (id: string, parentId: string | null = null) => ({
  id, pageId: 'p1', tenantId: 't1', parentId,
  nodeType: 'element' as const, order: 'a0',
  styles: '{}', props: '{}', settings: '{}',
});

const empty = { nodes: new Map(), selectedIds: new Set(), editingId: null, draggingId: null };

describe('canvasReducer', () => {
  it('STDB_SYNC replaces nodes from STDB', () => {
    const node = makeNode('n1');
    const state = canvasReducer(empty, { type: 'STDB_SYNC', nodes: [node] });
    expect(state.nodes.get('n1')).toEqual(node);
    expect(state.nodes.size).toBe(1);
  });

  it('INSERT adds a node', () => {
    const node = makeNode('n1');
    const state = canvasReducer(empty, { type: 'INSERT', node });
    expect(state.nodes.has('n1')).toBe(true);
  });

  it('UPDATE_STYLES merges patch into existing styles', () => {
    const node = { ...makeNode('n1'), styles: '{"color":"red"}' };
    const s1 = canvasReducer(empty, { type: 'INSERT', node });
    const s2 = canvasReducer(s1, { type: 'UPDATE_STYLES', nodeId: 'n1', patch: { background: 'blue' } });
    const styles = JSON.parse(s2.nodes.get('n1')!.styles);
    expect(styles).toEqual({ color: 'red', background: 'blue' });
  });

  it('DELETE cascades to children', () => {
    const parent = makeNode('parent');
    const child  = { ...makeNode('child', 'parent'), order: 'a1' };
    let s = canvasReducer(empty, { type: 'INSERT', node: parent });
    s = canvasReducer(s, { type: 'INSERT', node: child });
    s = canvasReducer(s, { type: 'DELETE', nodeId: 'parent' });
    expect(s.nodes.has('parent')).toBe(false);
    expect(s.nodes.has('child')).toBe(false);
  });

  it('MOVE updates parentId and order', () => {
    const node = makeNode('n1');
    let s = canvasReducer(empty, { type: 'INSERT', node });
    s = canvasReducer(s, { type: 'MOVE', nodeId: 'n1', newParentId: 'p2', newOrder: 'b0' });
    expect(s.nodes.get('n1')!.parentId).toBe('p2');
    expect(s.nodes.get('n1')!.order).toBe('b0');
  });
});
```

**Step 3: Add the export for testing** — in `CanvasContext.tsx` add after the `reducer` function definition:
```typescript
export { reducer as canvasReducer }; // for unit tests only
```

**Step 4: Run tests**

```bash
cd apps/canvas-dashboard && npx vitest run src/context/CanvasContext.test.ts
```
Expected: 5 tests pass.

**Step 5: Commit**

```bash
git add apps/canvas-dashboard/src/context/CanvasContext.tsx \
        apps/canvas-dashboard/src/context/CanvasContext.test.ts
git commit -m "feat(canvas): add CanvasContext optimistic state + sync queue"
```

---

## Task 2: Wire CanvasContext into CanvasPage

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx`

**Context:** Replace all the inline state (`useState`, direct `conn.reducers.*` calls) in `CanvasInner` with `CanvasContextProvider` + `useCanvas()`. The outer shape stays the same — `CanvasPage` is still the STDB provider wrapper, `CanvasInner` still calls `useTable`. We insert `CanvasContextProvider` between `CanvasInner` and its children.

**Step 1: Rewrite `CanvasInner` to use CanvasContextProvider**

Replace the entire `CanvasInner` function (lines 22–557 in `CanvasPage.tsx`) with:

```tsx
function CanvasInner({ pageId, tenantId, tenantName }: { pageId: string; tenantId: string; tenantName: string }) {
  const stdb = useSpacetimeDB() as any;
  const conn = (stdb?.getConnection?.() ?? null) as DbConnection | null;

  const [flatNodes] = useTable(tables.canvas_node);
  const [cursors]   = useTable(tables.active_cursor);
  const [aiOps]     = useTable(tables.ai_operation);

  if (!conn) return (
    <div className="canvas-loading">
      <div className="spinner" />
      <p>Connecting...</p>
    </div>
  );

  return (
    <CanvasContextProvider conn={conn} stdbNodes={flatNodes} pageId={pageId} tenantId={tenantId}>
      <CanvasUI
        pageId={pageId} tenantId={tenantId} tenantName={tenantName}
        cursors={[...cursors]} aiOps={[...aiOps]} conn={conn}
      />
    </CanvasContextProvider>
  );
}
```

**Step 2: Create `CanvasUI` component** (replaces the old JSX in CanvasInner — put it in the same file below `CanvasInner`):

```tsx
function CanvasUI({ pageId, tenantId, tenantName, cursors, aiOps, conn }: {
  pageId: string; tenantId: string; tenantName: string;
  cursors: any[]; aiOps: any[]; conn: any;
}) {
  const { flatNodes, selectedIds, selectedNode, selectNode, multiSelectNodes, duplicateSelected } = useCanvas();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    fetch(`${backend}/api/pages/${pageId}`, { headers: { 'x-tenant-id': tenantId } })
      .then(r => r.json())
      .then((d: { publishedVersionId?: string | null }) => setIsPublished(!!d.publishedVersionId))
      .catch(() => {});
  }, [pageId, tenantId]);

  const tree       = flatNodes.length > 0 ? buildTree([...flatNodes]) : null;
  const activeAiOp = aiOps.find(op => op.status !== 'done' && op.status !== 'error');

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const lastSelId = [...selectedIds].at(-1) ?? null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    conn.reducers.moveCursor({
      x: e.clientX - rect.left, y: e.clientY - rect.top,
      selectedNodeId: lastSelId ?? undefined, hoveredNodeId: undefined,
    });
  }, [conn, selectedIds]);

  const handleContextMenu = useCallback((x: number, y: number, targetId: string | null) => {
    if (targetId && !selectedIds.has(targetId)) {
      selectedIds.forEach(sid => conn?.reducers.unlockNode({ nodeId: sid }));
      conn?.reducers.lockNode({ nodeId: targetId });
      selectNode(targetId);
    }
    setContextMenu({ x, y, targetId });
  }, [conn, selectedIds, selectNode]);

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={() => {}} onDragEnd={() => {}}>
      <div className="canvas-layout">
        <Toolbar conn={conn} pageId={pageId} tenantId={tenantId} tenantName={tenantName} connected={true} />
        <div className="canvas-body">
          <LeftPanel pageId={pageId} tenantId={tenantId} conn={conn} />
          <div className="canvas-area" onMouseMove={handleMouseMove}>
            {activeAiOp && <AIStatusBar operation={activeAiOp} />}
            <Canvas
              tree={tree} cursors={cursors}
              onContextMenu={handleContextMenu}
            />
            <AIBar conn={conn} pageId={pageId} tenantId={tenantId}
              selectedNodeId={[...selectedIds].at(-1) ?? null} />
          </div>
          <RightPanel node={selectedNode} conn={conn} tenantId={tenantId}
            pageId={pageId} isPublished={isPublished} />
        </div>
      </div>
      <DragOverlay>
        {/* populated in Task 5 */}
      </DragOverlay>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          actions={[]} // context menu actions migrated to useCanvas in Task 7
          onClose={() => setContextMenu(null)}
        />
      )}
    </DndContext>
  );
}
```

**Step 3: Update imports** at the top of `CanvasPage.tsx`:

```tsx
import { CanvasContextProvider, useCanvas } from '@/context/CanvasContext';
```

Remove the imports that are no longer needed in `CanvasInner`: `applySelect`, `computeGroupParent`, `copyNodes`, `pasteNodes`, `duplicateNodes`, `resolveDropOrder` (these are now used inside CanvasContext).

**Step 4: Update child components to accept no flatNodes/selectedIds props**

`LeftPanel` and `Canvas` and `RightPanel` will now call `useCanvas()` internally. For now, keep passing props — we'll clean up panel by panel in later tasks. The key change is `CanvasContextProvider` wrapping everything.

**Step 5: Verify build compiles**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```
Expected: No errors.

**Step 6: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/CanvasPage.tsx
git commit -m "feat(canvas): wire CanvasContextProvider into CanvasInner"
```

---

## Task 3: White Theme CSS Rewrite

**Files:**
- Modify: `apps/canvas-dashboard/src/app/globals.css` (full rewrite of all color/background values — keep structural layout rules, replace all dark colors)

**Context:** The current globals.css uses dark colors (`#0f1117`, `#161921`, etc.). We replace every color token with the SeloraX white/branded theme. The layout structure (flex, widths, heights) stays the same.

**Step 1: Replace the entire globals.css content**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-app: #F3F4F6;
  --bg-panel: #FFFFFF;
  --bg-hover: #F9FAFB;
  --bg-selected: #EEEEF8;
  --border: #E5E7EB;
  --border-subtle: #F3F4F6;
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  --brand-navy: #2D2F8F;
  --brand-navy-light: #EEEEF8;
  --brand-orange: #F47920;
  --canvas-bg: #F3F4F6;
  --canvas-frame: #FFFFFF;
  --selection: #2D2F8F;
  --drop-zone: #2D2F8F;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
  height: 100vh;
}

/* ── Canvas Layout ── */
.canvas-layout {
  display: flex; flex-direction: column;
  height: 100vh; background: var(--bg-app);
}
.canvas-body { display: flex; flex: 1; overflow: hidden; }
.canvas-area {
  flex: 1; display: flex; flex-direction: column;
  position: relative; background: var(--canvas-bg); overflow: hidden;
}
.canvas-viewport {
  flex: 1; overflow: auto; padding: 40px;
  display: flex; align-items: flex-start; justify-content: center;
}
.canvas-frame {
  background: var(--canvas-frame);
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  min-height: 600px; width: 100%; max-width: 1200px; position: relative;
}
.canvas-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 400px; gap: 12px;
  color: var(--text-tertiary);
}
.canvas-loading {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  height: 100vh; gap: 16px;
  color: var(--brand-navy); background: var(--bg-app);
}

/* ── Panels ── */
.panel-left, .panel-right {
  width: 260px; background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto; flex-shrink: 0;
}
.panel-right { border-right: none; border-left: 1px solid var(--border); width: 280px; }

.panel-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.panel-section h3 {
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-secondary);
  margin-bottom: 8px; font-weight: 600;
}

/* ── Toolbar ── */
.toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 0 16px; height: 48px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.toolbar-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary); margin-right: auto;
}
.connection-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #22C55E;
}
.connection-dot.disconnected { background: #EF4444; }

/* ── Tabs ── */
.panel-tabs {
  display: flex; border-bottom: 1px solid var(--border);
  background: var(--bg-panel); padding: 0 4px;
}
.panel-tab {
  flex: 1; padding: 8px 4px; font-size: 11px; font-weight: 500;
  color: var(--text-secondary); background: none; border: none;
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: color 0.15s; text-transform: capitalize;
}
.panel-tab:hover { color: var(--text-primary); }
.panel-tab.active { color: var(--brand-navy); border-bottom-color: var(--brand-navy); }
.panel-tab-body { padding: 8px 0; }

/* ── Layers ── */
.layers-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; cursor: pointer;
  font-size: 12px; color: var(--text-secondary);
  border-radius: 4px; margin: 1px 4px;
  user-select: none;
}
.layers-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.layers-item.selected {
  background: var(--bg-selected); color: var(--brand-navy); font-weight: 500;
}
.layers-item.dragging { opacity: 0.4; }
.layers-item.drop-over {
  outline: 1px dashed var(--brand-navy);
  background: var(--brand-navy-light);
}
.drag-handle {
  opacity: 0; cursor: grab; color: var(--text-tertiary); font-size: 13px;
}
.layers-item:hover .drag-handle { opacity: 1; }

/* ── Canvas Nodes ── */
.canvas-node-layout { position: relative; }
.canvas-drag-handle {
  position: absolute; top: 4px; left: -20px;
  opacity: 0; cursor: grab;
  font-size: 14px; color: var(--text-tertiary);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 4px; padding: 2px 4px; z-index: 10;
}
[data-node-id]:hover > .canvas-drag-handle,
[data-node-id]:hover .canvas-drag-handle { opacity: 1; }

/* Drop zone indicators */
.drop-zone-line {
  position: absolute; left: 0; right: 0; height: 2px;
  background: var(--brand-navy); border-radius: 1px; z-index: 20; pointer-events: none;
}
.drop-zone-line.before { top: -1px; }
.drop-zone-line.after  { bottom: -1px; }
.drop-zone-inside {
  outline: 2px dashed var(--brand-navy) !important;
  background: var(--brand-navy-light) !important;
}

/* ── Rubber-band ── */
.rubber-band {
  position: absolute; pointer-events: none;
  border: 1.5px solid var(--brand-navy);
  background: rgba(45, 47, 143, 0.06);
  border-radius: 2px; z-index: 100;
}

/* ── Style Inputs ── */
.style-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 6px;
}
.style-label {
  font-size: 11px; color: var(--text-secondary);
  width: 80px; flex-shrink: 0;
}
.style-input {
  flex: 1; background: var(--bg-app);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 6px; font-size: 12px; color: var(--text-primary);
  outline: none;
}
.style-input:focus { border-color: var(--brand-navy); }

/* ── Layout Panel ── */
.layout-panel { padding: 12px 0; }
.layout-section-title {
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-secondary);
  margin-bottom: 8px; font-weight: 600;
}
.layout-section {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px;
}
.layout-label {
  font-size: 11px; color: var(--text-secondary);
  width: 56px; flex-shrink: 0;
}
.layout-input-sm {
  width: 60px; background: var(--bg-app);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 6px; font-size: 12px; color: var(--text-primary);
  outline: none;
}
.layout-input-sm:focus { border-color: var(--brand-navy); }

/* ── Icon Buttons ── */
.icon-btn-group { display: flex; gap: 2px; flex-wrap: wrap; }
.icon-btn {
  padding: 3px 8px; font-size: 11px;
  background: var(--bg-app); border: 1px solid var(--border);
  border-radius: 4px; cursor: pointer; color: var(--text-secondary);
  transition: all 0.1s;
}
.icon-btn:hover { border-color: var(--brand-navy); color: var(--brand-navy); }
.icon-btn.active {
  background: var(--brand-navy-light);
  border-color: var(--brand-navy); color: var(--brand-navy);
}

/* ── Buttons ── */
.btn {
  padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: none; transition: opacity 0.15s;
}
.btn:hover { opacity: 0.9; }
.btn-primary { background: var(--brand-navy); color: #fff; }
.btn-orange  { background: var(--brand-orange); color: #fff; }
.btn-secondary {
  background: var(--bg-app); color: var(--text-primary);
  border: 1px solid var(--border);
}

/* ── Publish Button ── */
.publish-btn {
  background: var(--brand-orange); color: #fff;
  border: none; border-radius: 6px;
  padding: 6px 16px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
}
.publish-btn:hover { opacity: 0.9; }
.publish-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── AI Bar ── */
.ai-bar {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 16px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.ai-bar-input-wrap { display: flex; gap: 8px; align-items: center; }
.ai-bar-input {
  flex: 1; padding: 8px 12px;
  background: var(--bg-app); border: 1px solid var(--border);
  border-radius: 8px; font-size: 13px; color: var(--text-primary); outline: none;
}
.ai-bar-input:focus { border-color: var(--brand-navy); }
.ai-bar-submit {
  background: var(--brand-orange); color: #fff;
  border: none; border-radius: 8px;
  width: 36px; height: 36px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.ai-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.ai-chip {
  padding: 3px 10px; font-size: 11px;
  background: var(--bg-hover); border: 1px solid var(--border);
  border-radius: 20px; cursor: pointer; color: var(--text-secondary);
}
.ai-chip:hover { border-color: var(--brand-navy); color: var(--brand-navy); }

/* ── AI Status Bar ── */
.ai-status-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 16px; font-size: 12px;
  background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
.ai-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}
.ai-progress-track {
  flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;
}
.ai-progress-fill {
  height: 100%; background: var(--brand-orange);
  border-radius: 2px; transition: width 0.3s;
}

/* ── Context Menu ── */
.context-menu {
  position: fixed; z-index: 1000; min-width: 180px;
  background: var(--bg-panel); border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px 0; font-size: 13px; color: var(--text-primary);
}
.context-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; cursor: pointer;
}
.context-menu-item:hover { background: var(--bg-hover); }
.context-menu-item.danger { color: #EF4444; }
.context-menu-item.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.context-menu-shortcut { margin-left: auto; font-size: 11px; color: var(--text-tertiary); }
.context-menu-divider { height: 1px; background: var(--border); margin: 4px 0; }

/* ── Component Browser ── */
.component-search {
  width: 100%; padding: 6px 10px; margin: 8px 0;
  background: var(--bg-app); border: 1px solid var(--border);
  border-radius: 6px; font-size: 12px; color: var(--text-primary); outline: none;
}
.component-search:focus { border-color: var(--brand-navy); }
.component-section-title {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-tertiary);
  padding: 6px 12px 4px; font-weight: 600;
}
.component-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 8px; }
.component-card {
  padding: 8px; border-radius: 6px;
  background: var(--bg-app); border: 1px solid var(--border);
  cursor: pointer; font-size: 11px; color: var(--text-secondary); text-align: center;
}
.component-card:hover {
  border-color: var(--brand-navy); color: var(--brand-navy);
  background: var(--brand-navy-light);
}

/* ── Elements Panel ── */
.elements-category { padding: 8px 12px 4px; }
.elements-category-title {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-tertiary);
  margin-bottom: 6px; font-weight: 600;
}
.elements-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.element-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 8px 4px; border-radius: 6px;
  background: var(--bg-app); border: 1px solid var(--border);
  cursor: pointer; font-size: 11px; color: var(--text-secondary);
  user-select: none;
}
.element-card:hover {
  border-color: var(--brand-navy); color: var(--brand-navy);
  background: var(--brand-navy-light);
}
.element-card-icon { font-size: 18px; }

/* ── Floating Toolbar ── */
.floating-toolbar {
  position: absolute; z-index: 50;
  display: flex; align-items: center; gap: 2px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 3px 6px;
  pointer-events: all;
  transform: translateY(-100%) translateY(-6px);
}
.floating-toolbar-name {
  font-size: 11px; font-weight: 500;
  color: #fff; background: var(--brand-navy);
  padding: 2px 7px; border-radius: 4px; margin-right: 4px;
}
.floating-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px;
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary); font-size: 14px;
}
.floating-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.floating-btn.danger:hover { background: #FEE2E2; color: #EF4444; }

/* ── Right Panel Tabs ── */
.right-panel-tabs {
  display: flex; border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
}
.right-panel-tab {
  flex: 1; padding: 9px 8px; font-size: 12px; font-weight: 500;
  color: var(--text-secondary); background: none; border: none;
  cursor: pointer; border-bottom: 2px solid transparent;
}
.right-panel-tab.active { color: var(--brand-navy); border-bottom-color: var(--brand-navy); }

/* ── Accordion ── */
.accordion-section { border-bottom: 1px solid var(--border-subtle); }
.accordion-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; cursor: pointer; font-size: 11px;
  font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary);
  user-select: none;
}
.accordion-header:hover { color: var(--text-primary); }
.accordion-chevron { font-size: 10px; transition: transform 0.15s; }
.accordion-chevron.open { transform: rotate(90deg); }
.accordion-body { padding: 4px 16px 12px; }

/* ── Inline Editing ── */
[contenteditable="true"] {
  outline: 2px solid var(--brand-navy) !important;
  outline-offset: 2px;
  border-radius: 2px;
  cursor: text !important;
}

/* ── Drag Overlay ── */
.drag-overlay-preview {
  background: var(--bg-panel); border: 1px solid var(--brand-navy);
  border-radius: 6px; padding: 6px 12px; font-size: 12px;
  color: var(--brand-navy); box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  opacity: 0.9;
}

/* ── Spinner ── */
.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--brand-navy);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

**Step 2: Update `IconButton` component** to use new CSS classes

```tsx
// apps/canvas-dashboard/src/app/canvas/[pageId]/components/ui/IconButton.tsx
'use client';
interface IconButtonProps {
  label: string; active?: boolean;
  onClick?: () => void; children: React.ReactNode;
}
export default function IconButton({ label, active, onClick, children }: IconButtonProps) {
  return (
    <button
      title={label}
      className={`icon-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

**Step 3: Build check**

```bash
cd apps/canvas-dashboard && npm run build 2>&1 | tail -20
```
Expected: No CSS errors, build succeeds.

**Step 4: Visual check** — open `http://localhost:3002/canvas/[any-pageId]` and verify white/light theme.

**Step 5: Commit**

```bash
git add apps/canvas-dashboard/src/app/globals.css \
        apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/ui/IconButton.tsx
git commit -m "feat(canvas): white branded theme (navy + orange)"
```

---

## Task 4: Update Toolbar + PublishButton Brand Colors

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/toolbar/Toolbar.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/toolbar/PublishButton.tsx`

**Step 1: Rewrite Toolbar.tsx**

```tsx
'use client';
import PublishButton from './PublishButton';

interface ToolbarProps {
  conn: any; pageId: string; tenantId: string;
  tenantName: string; connected: boolean;
}

export default function Toolbar({ conn, pageId, tenantId, tenantName, connected }: ToolbarProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  return (
    <div className="toolbar">
      <a
        href="/dashboard"
        style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}
      >
        ← Back
      </a>
      <span className="toolbar-title">{tenantName} — Canvas</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: 'var(--text-secondary)', marginRight: 8 }}>
        <div className={`connection-dot${connected ? '' : ' disconnected'}`} />
        <span>{connected ? 'Live' : 'Disconnected'}</span>
      </div>
      <button
        onClick={() => window.open(`${backendUrl.replace('3001','3004')}/${pageId}`, '_blank')}
        className="btn btn-secondary"
        style={{ fontSize: 12 }}
      >
        ▶ Preview
      </button>
      <PublishButton pageId={pageId} tenantId={tenantId} />
    </div>
  );
}
```

**Step 2: Rewrite PublishButton.tsx** — change button class to `publish-btn`

Open `apps/canvas-dashboard/src/app/canvas/[pageId]/components/toolbar/PublishButton.tsx` and replace the button element's className/style with `className="publish-btn"`. Keep all existing publish logic unchanged.

**Step 3: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/toolbar/
git commit -m "feat(canvas): toolbar white theme + preview button"
```

---

## Task 5: Elements Panel (4th Tab — Add Elements)

**Files:**
- Create: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/ElementsPanel.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/LeftPanel.tsx`

**Context:** A new "Elements" tab lets users click or drag to add nodes. Click-to-add inserts as the last child of the selected node (or as a root node if nothing is selected). All inserts go through `useCanvas().insertNode()` which is optimistic.

**Step 1: Create ElementsPanel.tsx**

```tsx
'use client';
import { useCanvas } from '@/context/CanvasContext';
import { resolveDropOrder } from '@/utils/drop-order';

const ELEMENT_DEFS = {
  layout: [
    { key: 'section', icon: '▬', label: 'Section',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'column', padding: '40px 20px', width: '100%', minHeight: '80px' },
      defaultProps: { label: 'Section' } },
    { key: 'row', icon: '⇔', label: 'Row',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'row', gap: '16px' },
      defaultProps: { label: 'Row' } },
    { key: 'columns', icon: '⊞', label: 'Columns',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
      defaultProps: { label: 'Columns' } },
    { key: 'wrapper', icon: '▢', label: 'Wrapper',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'column', gap: '8px' },
      defaultProps: { label: 'Wrapper' } },
  ],
  content: [
    { key: 'heading', icon: 'H', label: 'Heading',
      nodeType: 'element' as const,
      defaultStyles: { fontSize: '32px', fontWeight: '700', color: '#111827' },
      defaultProps: { tag: 'heading', level: 2, content: 'Heading' } },
    { key: 'paragraph', icon: 'P', label: 'Paragraph',
      nodeType: 'element' as const,
      defaultStyles: { fontSize: '16px', color: '#374151', lineHeight: '1.6' },
      defaultProps: { tag: 'text', content: 'Paragraph text goes here.' } },
    { key: 'button', icon: '⬭', label: 'Button',
      nodeType: 'element' as const,
      defaultStyles: { display: 'inline-block', padding: '12px 24px', borderRadius: '6px',
        background: '#F47920', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
      defaultProps: { tag: 'button', content: 'Click me' } },
    { key: 'image', icon: '🖼', label: 'Image',
      nodeType: 'element' as const,
      defaultStyles: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', background: '#E5E7EB' },
      defaultProps: { tag: 'image', src: '', alt: '' } },
    { key: 'divider', icon: '—', label: 'Divider',
      nodeType: 'element' as const,
      defaultStyles: { borderTop: '1px solid #E5E7EB', width: '100%', margin: '8px 0' },
      defaultProps: { tag: 'divider' } },
  ],
};

export default function ElementsPanel({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const { insertNode, selectedIds, nodes } = useCanvas();

  function addElement(def: typeof ELEMENT_DEFS.layout[0]) {
    // Find the parent: selected node if it's a layout, otherwise root
    const lastSelId = [...selectedIds].at(-1) ?? null;
    const selNode   = lastSelId ? nodes.get(lastSelId) : null;
    const parentId  = (selNode?.nodeType === 'layout') ? selNode.id : null;

    // Compute order: after last child of parent (or last root node)
    const siblings = Array.from(nodes.values())
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.order.localeCompare(b.order));
    const newOrder = resolveDropOrder(siblings.at(-1)?.order, undefined);

    insertNode({
      pageId, tenantId,
      parentId,
      nodeType: def.nodeType,
      order: newOrder,
      styles: JSON.stringify(def.defaultStyles),
      props:  JSON.stringify(def.defaultProps),
      settings: '{}',
    });
  }

  return (
    <div>
      <div className="elements-category">
        <p className="elements-category-title">Layout</p>
        <div className="elements-grid">
          {ELEMENT_DEFS.layout.map(def => (
            <button key={def.key} className="element-card" onClick={() => addElement(def)}>
              <span className="element-card-icon">{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="elements-category">
        <p className="elements-category-title">Content</p>
        <div className="elements-grid">
          {ELEMENT_DEFS.content.map(def => (
            <button key={def.key} className="element-card" onClick={() => addElement(def)}>
              <span className="element-card-icon">{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update LeftPanel.tsx** — add Elements tab, switch to `useCanvas()` for data

```tsx
'use client';
import { useState } from 'react';
import { useCanvas } from '@/context/CanvasContext';
import LayersTree       from './LayersTree';
import ComponentBrowser from './ComponentBrowser';
import FunnelBuilder    from './FunnelBuilder';
import ElementsPanel    from './ElementsPanel';

type Tab = 'elements' | 'layers' | 'components' | 'funnels';

export default function LeftPanel({ pageId, tenantId, conn }: {
  pageId: string; tenantId: string; conn: any;
}) {
  const [tab, setTab] = useState<Tab>('elements');
  const { flatNodes, selectedIds, selectNode } = useCanvas();

  return (
    <div className="panel-left">
      <div className="panel-tabs">
        {(['elements', 'layers', 'components', 'funnels'] as Tab[]).map(t => (
          <button key={t} className={`panel-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="panel-tab-body">
        {tab === 'elements'    && <ElementsPanel pageId={pageId} tenantId={tenantId} />}
        {tab === 'layers'      && <LayersTree flatNodes={flatNodes} selectedIds={selectedIds} onSelect={selectNode} />}
        {tab === 'components'  && <ComponentBrowser tenantId={tenantId} pageId={pageId} conn={conn} />}
        {tab === 'funnels'     && (
          <FunnelBuilder tenantId={tenantId}
            backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'} />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update CanvasUI in CanvasPage.tsx** to no longer pass `flatNodes`/`selectedIds` to LeftPanel (it now uses `useCanvas()` internally). Change the `<LeftPanel>` call to:
```tsx
<LeftPanel pageId={pageId} tenantId={tenantId} conn={conn} />
```

**Step 4: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 5: Visual test** — open canvas, click Elements tab, click "Section" — a new section should appear on canvas and in layers panel immediately.

**Step 6: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/panels/
git commit -m "feat(canvas): add Elements panel (4th tab) with click-to-add"
```

---

## Task 6: DnD Drop Zones + Duplicate Fix

**Files:**
- Create: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/DropZoneIndicator.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasNode.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx` (CanvasUI DnD handlers)

**Context:** Drop zones show where a node will land (before/after as a line, inside as a highlight). This mirrors v2's drop position detection. We also fix duplicate to insert adjacent to original.

**Step 1: Create DropZoneIndicator.tsx**

```tsx
// A simple absolute-positioned line or highlight
export type DropPosition = 'before' | 'after' | 'inside' | null;

export function DropZoneLine({ position }: { position: 'before' | 'after' }) {
  return <div className={`drop-zone-line ${position}`} />;
}
```

**Step 2: Add drop position state to CanvasUI** in `CanvasPage.tsx`

In `CanvasUI`, add:
```tsx
const [dropInfo, setDropInfo] = useState<{ overId: string; position: 'before' | 'after' | 'inside' } | null>(null);
```

Update `DndContext` handlers:
```tsx
<DndContext
  collisionDetection={closestCenter}
  onDragStart={(e) => setDraggingId(e.active.id as string)}
  onDragOver={(e) => {
    if (!e.over) { setDropInfo(null); return; }
    const overId    = e.over.id as string;
    const overNode  = nodes.get(overId);
    if (!overNode) { setDropInfo(null); return; }
    // Use e.delta.y as proxy for relative position — positive = lower half
    // For layout nodes, middle = inside; for elements, only before/after
    const y     = (e.activatorEvent as MouseEvent).clientY;
    const el    = document.querySelector(`[data-node-id="${overId}"]`);
    const rect  = el?.getBoundingClientRect();
    if (!rect) { setDropInfo(null); return; }
    const relY = (y - rect.top) / rect.height;
    let position: 'before' | 'after' | 'inside';
    if (overNode.nodeType === 'layout') {
      position = relY < 0.25 ? 'before' : relY > 0.75 ? 'after' : 'inside';
    } else {
      position = relY < 0.5 ? 'before' : 'after';
    }
    setDropInfo({ overId, position });
  }}
  onDragEnd={(e) => {
    setDraggingId(null);
    setDropInfo(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeNode = nodes.get(active.id as string);
    const overNode   = nodes.get(over.id as string);
    if (!activeNode || !overNode) return;
    // Guard: prevent drop into own subtree
    const isDesc = (id: string, anc: string): boolean => {
      let cur = nodes.get(id);
      while (cur?.parentId) { if (cur.parentId === anc) return true; cur = nodes.get(cur.parentId); }
      return false;
    };
    if (isDesc(over.id as string, active.id as string)) return;
    const position = dropInfo?.position ?? 'after';
    if (position === 'inside' && overNode.nodeType === 'layout') {
      const children = Array.from(nodes.values())
        .filter(n => n.parentId === over.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      moveNode(active.id as string, over.id as string,
        resolveDropOrder(children.at(-1)?.order, undefined));
      return;
    }
    // before/after — reorder within parent
    const newParentId = overNode.parentId ?? null;
    const siblings = Array.from(nodes.values())
      .filter(n => n.parentId === newParentId && n.id !== active.id)
      .sort((a, b) => a.order.localeCompare(b.order));
    const overIdx = siblings.findIndex(n => n.id === over.id);
    const newOrder = position === 'before'
      ? resolveDropOrder(siblings[overIdx - 1]?.order, overNode.order)
      : resolveDropOrder(overNode.order, siblings[overIdx + 1]?.order);
    moveNode(active.id as string, newParentId, newOrder);
  }}
>
```

Also destructure `nodes`, `moveNode`, `setDraggingId` from `useCanvas()` in `CanvasUI`.

**Step 3: Pass `dropInfo` down to `CanvasNode`** via Canvas → CanvasNode props:

In `Canvas.tsx`, add `dropInfo` prop and pass it through to `CanvasNode`. In `CanvasNode.tsx`, render drop zone indicators:

```tsx
// In CanvasNode — add these props:
interface CanvasNodeProps {
  node: any; selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  depth: number;
  dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;
}

// In the wrapper div — add conditional rendering:
const isDropTarget = dropInfo?.overId === node.id;
const dropClass    = isDropTarget && dropInfo?.position === 'inside' ? 'drop-zone-inside' : '';

// In the outline/className:
outline: isSelected
  ? `2px solid var(--selection)`
  : (isDropTarget && dropInfo?.position === 'inside') ? undefined : undefined,

// At top of node return, before the main content:
{isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
// At bottom:
{isDropTarget && dropInfo?.position === 'after'  && <DropZoneLine position="after"  />}
```

**Step 4: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 5: Visual test** — drag a node and observe the blue line appearing before/after and the dashed border when hovering layout. Duplicate a node with ⌘D and verify it appears adjacent to original.

**Step 6: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/
git commit -m "feat(canvas): drop zone indicators + duplicate adjacent fix"
```

---

## Task 7: Inline Text Editing (Double-Click)

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasNode.tsx`

**Context:** Double-click on text/heading/paragraph/button elements activates contentEditable. Single-click selects. On blur, save content via `useCanvas().updateProps()`.

**Step 1: Rewrite CanvasNode.tsx with inline editing**

```tsx
'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useCanvas } from '@/context/CanvasContext';
import { DropZoneLine } from './DropZoneIndicator';

interface CanvasNodeProps {
  node: any; depth: number;
  dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;
}

// Tags that support inline editing
const EDITABLE_TAGS = ['heading', 'text', 'button'];

export default function CanvasNode({ node, depth, dropInfo }: CanvasNodeProps) {
  if (!node) return null;
  const { selectedIds, editingId, selectNode, setEditingId, updateProps } = useCanvas();
  const isSelected = selectedIds.has(node.id);
  const isEditing  = editingId === node.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy || isEditing,
    data: { type: node.nodeType },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id, data: { type: node.nodeType },
  });
  const setRef = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el); };

  const isDropTarget  = dropInfo?.overId === node.id;
  const isDropInside  = isDropTarget && dropInfo?.position === 'inside';

  const wrapperStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    outline: isSelected
      ? '2px solid var(--selection)'
      : (isDropInside || isOver) && node.nodeType === 'layout'
        ? '2px dashed var(--brand-navy)'
        : undefined,
    outlineOffset: '2px',
    position: 'relative',
    cursor: isEditing ? 'text' : 'pointer',
    background: isDropInside ? 'var(--brand-navy-light)' : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) selectNode(node.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const props = node.props ? (typeof node.props === 'string' ? JSON.parse(node.props) : node.props) : {};
    if (EDITABLE_TAGS.includes(props.tag)) {
      setEditingId(node.id);
    }
  };

  const DragHandle = (
    <span className="canvas-drag-handle" {...attributes} {...listeners}
      onClick={e => e.stopPropagation()} title="Drag">⠿</span>
  );

  const nodeType = node.nodeType ?? node.type;

  if (nodeType === 'layout') {
    return (
      <div ref={setRef} style={{ ...parseStyles(node.styles), ...wrapperStyle }}
        className="canvas-node-layout" data-node-id={node.id}
        onClick={handleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        {node.children?.map((child: any) => (
          <CanvasNode key={child.id} node={child} depth={depth + 1} dropInfo={dropInfo} />
        ))}
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  if (nodeType === 'element') {
    return (
      <div ref={setRef} style={wrapperStyle} data-node-id={node.id} onClick={handleClick}
        onDoubleClick={handleDoubleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        <RenderElement node={node} isEditing={isEditing}
          onBlur={(content) => { updateProps(node.id, { content }); setEditingId(null); }} />
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  if (nodeType === 'component') {
    return (
      <div ref={setRef} style={{ ...wrapperStyle, minHeight: 40, background: '#f3f4f6',
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
        data-node-id={node.id} onClick={handleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        <span style={{ fontSize: 11, color: '#6B7280' }}>📦 {node.componentId ?? 'Component'}</span>
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  return null;
}

function parseStyles(s: any): React.CSSProperties {
  if (!s) return {};
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return {}; }
}

function RenderElement({ node, isEditing, onBlur }: {
  node: any; isEditing: boolean; onBlur: (content: string) => void;
}) {
  const props = node.props ? (typeof node.props === 'string' ? JSON.parse(node.props) : node.props) : {};
  const styles = parseStyles(node.styles);

  if (props.tag === 'heading') {
    const Tag = `h${props.level ?? 2}` as 'h1' | 'h2' | 'h3';
    return (
      <Tag
        style={styles}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}
      >
        {props.content ?? 'Heading'}
      </Tag>
    );
  }
  if (props.tag === 'text') {
    return (
      <p style={styles} contentEditable={isEditing} suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}>
        {props.content ?? 'Text'}
      </p>
    );
  }
  if (props.tag === 'button') {
    return (
      <button style={styles} contentEditable={isEditing} suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}>
        {props.content ?? 'Button'}
      </button>
    );
  }
  if (props.tag === 'image') {
    return props.src
      ? <img src={props.src} alt={props.alt ?? ''} style={styles} data-node-id={node.id} />
      : <div style={{ ...styles, background: '#E5E7EB', minHeight: 100, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9CA3AF', fontSize: 12 }} data-node-id={node.id}>🖼 Image</div>;
  }
  if (props.tag === 'divider') {
    return <hr style={styles} data-node-id={node.id} />;
  }
  return <div style={styles} data-node-id={node.id}>{props.content ?? ''}</div>;
}
```

**Step 2: Update Canvas.tsx** to accept and pass `dropInfo`:

```tsx
// Add to CanvasProps:
dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;

// In CanvasNode render:
<CanvasNode node={tree} selectedIds={selectedIds} onSelect={onSelect} depth={0} dropInfo={dropInfo} />
```

Wait — `Canvas.tsx` no longer needs `selectedIds`/`onSelect` as props since `CanvasNode` gets them from `useCanvas()`. Update `Canvas.tsx`:

```tsx
// CanvasProps becomes:
interface CanvasProps {
  tree: any;
  cursors: any[];
  onContextMenu: (x: number, y: number, targetId: string | null) => void;
  dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;
}
// Remove selectedIds + onSelect + onMultiSelect from props.
// Get them from useCanvas() inside Canvas:
const { selectedIds, selectNode, multiSelectNodes } = useCanvas();
```

**Step 3: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 4: Visual test** — double-click a heading on canvas, type new text, click outside — text should update immediately (optimistic) and sync to STDB in background.

**Step 5: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/CanvasNode.tsx \
        apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/Canvas.tsx
git commit -m "feat(canvas): inline text editing on double-click"
```

---

## Task 8: Right Panel Redesign (Properties Accordion + Settings Tab)

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/RightPanel.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/StyleEditor.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/LayoutPanel.tsx`
- Create: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/SettingsPanel.tsx`

**Context:** Two tabs: Properties (collapsible Layout/Size/Style/Typography sections) and Settings (per-component schema-driven form). All updates go through `useCanvas()` — no more direct `conn.reducers` calls from panel components.

**Step 1: Rewrite RightPanel.tsx**

```tsx
'use client';
import { useState } from 'react';
import { useCanvas } from '@/context/CanvasContext';
import LayoutPanel   from './LayoutPanel';
import StyleEditor   from './StyleEditor';
import SettingsPanel from './SettingsPanel';
import AnalyticsStrip from './AnalyticsStrip';

type RightTab = 'properties' | 'settings';

export default function RightPanel({ pageId, tenantId, isPublished }: {
  pageId?: string; tenantId: string; isPublished?: boolean;
}) {
  const [tab, setTab] = useState<RightTab>('properties');
  const { selectedNode } = useCanvas();

  return (
    <div className="panel-right">
      {pageId && <AnalyticsStrip pageId={pageId} tenantId={tenantId} isPublished={isPublished ?? false} />}
      <div className="right-panel-tabs">
        {(['properties', 'settings'] as RightTab[]).map(t => (
          <button key={t} className={`right-panel-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {!selectedNode ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Select a node to edit properties
        </div>
      ) : tab === 'properties' ? (
        <PropertiesTab node={selectedNode} />
      ) : (
        <SettingsPanel node={selectedNode} tenantId={tenantId} />
      )}
    </div>
  );
}

function AccordionSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen(!open)}>
        {title}
        <span className={`accordion-chevron${open ? ' open' : ''}`}>▶</span>
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}

function PropertiesTab({ node }: { node: any }) {
  const nodeStyles: Record<string, string> = (() => {
    try { return JSON.parse(node?.styles ?? '{}'); } catch { return {}; }
  })();
  const nodeProps: Record<string, unknown> = (() => {
    try { return JSON.parse(node?.props ?? '{}'); } catch { return {}; }
  })();
  const isText = node.nodeType === 'element' && ['heading','text','button'].includes(nodeProps.tag as string);
  const isLayout = node.nodeType === 'layout';

  return (
    <div>
      {isLayout && (
        <AccordionSection title="Layout">
          <LayoutPanel nodeId={node.id} styles={nodeStyles} />
        </AccordionSection>
      )}
      <AccordionSection title="Size">
        <SizeSection nodeId={node.id} styles={nodeStyles} />
      </AccordionSection>
      <AccordionSection title="Style">
        <StyleEditor node={node} />
      </AccordionSection>
      {isText && (
        <AccordionSection title="Typography">
          <TypographySection nodeId={node.id} styles={nodeStyles} />
        </AccordionSection>
      )}
    </div>
  );
}

function SizeSection({ nodeId, styles }: { nodeId: string; styles: Record<string, string> }) {
  const { updateStyles } = useCanvas();
  const [w, setW] = useState(styles.width  ?? '');
  const [h, setH] = useState(styles.height ?? '');
  return (
    <div>
      <div className="style-row">
        <span className="style-label">Width</span>
        <input className="style-input" value={w} placeholder="auto"
          onChange={e => setW(e.target.value)}
          onBlur={() => updateStyles(nodeId, { width: w })} />
      </div>
      <div className="style-row">
        <span className="style-label">Height</span>
        <input className="style-input" value={h} placeholder="auto"
          onChange={e => setH(e.target.value)}
          onBlur={() => updateStyles(nodeId, { height: h })} />
      </div>
    </div>
  );
}

function TypographySection({ nodeId, styles }: { nodeId: string; styles: Record<string, string> }) {
  const { updateStyles } = useCanvas();
  const fields = [
    { label: 'Font Size', key: 'fontSize', placeholder: '16px' },
    { label: 'Font Weight', key: 'fontWeight', placeholder: '400' },
    { label: 'Line Height', key: 'lineHeight', placeholder: '1.5' },
    { label: 'Color', key: 'color', placeholder: '#111827' },
  ];
  return (
    <div>
      {fields.map(f => {
        const [val, setVal] = useState(styles[f.key] ?? '');
        return (
          <div key={f.key} className="style-row">
            <span className="style-label">{f.label}</span>
            <input className="style-input" value={val} placeholder={f.placeholder}
              onChange={e => setVal(e.target.value)}
              onBlur={() => updateStyles(nodeId, { [f.key]: val })} />
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Update StyleEditor.tsx** — remove `conn` prop, use `useCanvas().updateStyles()` instead:

```tsx
'use client';
import { useState } from 'react';
import { useCanvas } from '@/context/CanvasContext';

const STYLE_FIELDS = [
  { label: 'Background', key: 'background' },
  { label: 'Padding',    key: 'padding' },
  { label: 'Margin',     key: 'margin' },
  { label: 'Radius',     key: 'borderRadius' },
  { label: 'Border',     key: 'border' },
  { label: 'Shadow',     key: 'boxShadow' },
  { label: 'Opacity',    key: 'opacity' },
];

export default function StyleEditor({ node }: { node: any }) {
  const { updateStyles } = useCanvas();
  const currentStyles = (() => {
    try { return JSON.parse(node.styles ?? '{}'); } catch { return {}; }
  })();
  return (
    <div>
      {STYLE_FIELDS.map(({ label, key }) => {
        const [val, setVal] = useState(currentStyles[key] ?? '');
        return (
          <div key={key} className="style-row">
            <span className="style-label">{label}</span>
            <input className="style-input" value={val} placeholder="—"
              onChange={e => setVal(e.target.value)}
              onBlur={() => updateStyles(node.id, { [key]: val })} />
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Update LayoutPanel.tsx** — remove `conn` ref (`useSpacetimeDB`), use `useCanvas().updateStyles()`:

Replace the `update` function (line 70-76) with:
```tsx
const { updateStyles } = useCanvas();
const update = (patch: Record<string, string>) => updateStyles(nodeId, patch);
```
Remove the `import { useSpacetimeDB } from 'spacetimedb/react'` and `import { DbConnection } from '@/module_bindings'` lines. Add `import { useCanvas } from '@/context/CanvasContext'`.

**Step 4: Create SettingsPanel.tsx**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useCanvas } from '@/context/CanvasContext';

export default function SettingsPanel({ node, tenantId }: { node: any; tenantId: string }) {
  const { updateSettings } = useCanvas();
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const nodeSettings = (() => {
    try { return JSON.parse(node.settings ?? '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    if (node.nodeType !== 'component' || !node.componentId) {
      setSchema(null);
      return;
    }
    // 1. Try DB first
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    fetch(`${backend}/api/components/${node.componentId}/schema`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.schema) setSchema(data.schema);
      })
      .catch(() => {});
    // 2. Try ESM export override
    if (node.componentUrl) {
      import(/* webpackIgnore: true */ node.componentUrl)
        .then((mod: any) => {
          if (mod?.settings) setSchema(mod.settings);
        })
        .catch(() => {});
    }
  }, [node.componentId, node.componentUrl, tenantId]);

  if (node.nodeType !== 'component') {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Settings are available for custom components only.
      </div>
    );
  }
  if (!schema) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        {node.componentId ? 'Loading settings...' : 'No settings defined.'}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      {Object.entries(schema).map(([key, def]: [string, any]) => (
        <SettingField key={key} fieldKey={key} def={def}
          value={nodeSettings[key] ?? def.default ?? ''}
          onChange={val => updateSettings(node.id, { [key]: val })} />
      ))}
    </div>
  );
}

function SettingField({ fieldKey, def, value, onChange }: {
  fieldKey: string; def: any; value: any; onChange: (v: any) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        {def.label ?? fieldKey}
      </label>
      {def.type === 'boolean' ? (
        <input type="checkbox" checked={!!local}
          onChange={e => { setLocal(e.target.checked); onChange(e.target.checked); }} />
      ) : def.type === 'select' ? (
        <select className="style-input" value={local}
          onChange={e => { setLocal(e.target.value); onChange(e.target.value); }}>
          {def.options?.map((o: string) => <option key={o}>{o}</option>)}
        </select>
      ) : def.type === 'number_slider' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min={def.min ?? 0} max={def.max ?? 100} value={local}
            onChange={e => { setLocal(Number(e.target.value)); onChange(Number(e.target.value)); }}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 12, width: 28 }}>{local}</span>
        </div>
      ) : (
        <input className="style-input" value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => onChange(local)}
          placeholder={def.placeholder ?? '—'} />
      )}
    </div>
  );
}
```

**Step 5: Update RightPanel call in CanvasUI** — remove `node` and `conn` props since it now uses `useCanvas()`:

```tsx
<RightPanel pageId={pageId} tenantId={tenantId} isPublished={isPublished} />
```

**Step 6: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 7: Visual test** — select a layout node → Properties tab shows Layout accordion; select a text element → shows Typography accordion; select a component → Settings tab renders schema form.

**Step 8: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/panels/
git commit -m "feat(canvas): right panel redesign — Properties accordion + Settings tab"
```

---

## Task 9: Floating Toolbar Above Selected Node

**Files:**
- Create: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/FloatingToolbar.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasNode.tsx`

**Context:** When a node is selected, a small toolbar floats above it showing the node name, duplicate, delete, and lock actions. This replaces having to open the context menu for common actions.

**Step 1: Create FloatingToolbar.tsx**

```tsx
'use client';
import { useCanvas } from '@/context/CanvasContext';

interface FloatingToolbarProps {
  nodeId: string;
  nodeName: string;
}

export default function FloatingToolbar({ nodeId, nodeName }: FloatingToolbarProps) {
  const { deleteNode, duplicateSelected, nodes } = useCanvas();
  const node = nodes.get(nodeId);
  const isLocked = !!node?.lockedBy;

  // Note: position is handled by the parent (absolute in canvas-node wrapper)
  return (
    <div className="floating-toolbar" onMouseDown={e => e.stopPropagation()}>
      <span className="floating-toolbar-name">{nodeName}</span>
      <button className="floating-btn" title="Duplicate (⌘D)" onClick={() => duplicateSelected()}>
        ⧉
      </button>
      <button className="floating-btn danger" title="Delete" onClick={() => deleteNode(nodeId)}>
        ✕
      </button>
      <button className="floating-btn" title={isLocked ? 'Unlock' : 'Lock'} style={{ opacity: isLocked ? 1 : 0.5 }}>
        {isLocked ? '🔒' : '🔓'}
      </button>
    </div>
  );
}
```

**Step 2: Render FloatingToolbar inside CanvasNode** for selected nodes

In `CanvasNode.tsx`, in each node type's wrapper div, add:

```tsx
import FloatingToolbar from './FloatingToolbar';

// Helper — get a human readable name from node
function getNodeLabel(node: any): string {
  try {
    const p = typeof node.props === 'string' ? JSON.parse(node.props) : (node.props ?? {});
    return p.label ?? p.tag ?? node.nodeType;
  } catch { return node.nodeType; }
}

// In each node render (layout/element/component), inside the wrapper, after DragHandle:
{isSelected && !isDragging && (
  <FloatingToolbar nodeId={node.id} nodeName={getNodeLabel(node)} />
)}
```

**Step 3: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 4: Visual test** — click a node and verify floating toolbar appears above it with correct name badge, duplicate and delete work.

**Step 5: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/FloatingToolbar.tsx \
        apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/CanvasNode.tsx
git commit -m "feat(canvas): floating toolbar above selected node"
```

---

## Task 10: Layers Panel Improvements

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/LayersTree.tsx`

**Context:** Add: collapse/expand for layout nodes, inline rename on double-click, delete button on hover. Use `useCanvas()` instead of props for selection and mutations.

**Step 1: Rewrite LayersTree.tsx**

```tsx
'use client';
import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useCanvas } from '@/context/CanvasContext';

const NODE_ICONS: Record<string, string> = {
  layout: '▢', element: '◻', component: '⬡',
};

export default function LayersTree() {
  const { flatNodes } = useCanvas();
  if (!flatNodes.length) {
    return <p style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>Canvas is empty</p>;
  }
  const roots      = flatNodes.filter(n => !n.parentId).sort((a, b) => a.order.localeCompare(b.order));
  const childrenOf = (id: string) => flatNodes
    .filter(n => n.parentId === id).sort((a, b) => a.order.localeCompare(b.order));

  function renderNode(node: any, depth: number): React.ReactNode {
    return (
      <LayersItem key={node.id} node={node} depth={depth}
        childrenOf={childrenOf} />
    );
  }
  return <div style={{ padding: '4px 0' }}>{roots.map(n => renderNode(n, 0))}</div>;
}

function LayersItem({ node, depth, childrenOf }: {
  node: any; depth: number;
  childrenOf: (id: string) => any[];
}) {
  const { selectedIds, selectNode, deleteNode, updateProps } = useCanvas();
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming]   = useState(false);
  const [nameVal, setNameVal]     = useState('');

  const isSelected  = selectedIds.has(node.id);
  const isLayout    = node.nodeType === 'layout';
  const children    = childrenOf(node.id);
  const hasChildren = isLayout && children.length > 0;

  const props = (() => { try { return JSON.parse(node.props ?? '{}'); } catch { return {}; } })();
  const label = props.label ?? props.content?.slice(0, 20) ?? props.tag ?? node.nodeType;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.id });
  const setRef = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el); };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameVal(label);
    setRenaming(true);
  };

  const commitRename = () => {
    if (nameVal.trim()) updateProps(node.id, { label: nameVal.trim() });
    setRenaming(false);
  };

  return (
    <div>
      <div ref={setRef} style={{ paddingLeft: depth * 12 }}
        className={[
          'layers-item',
          isSelected ? 'selected' : '',
          isDragging ? 'dragging' : '',
          (isOver && isLayout) ? 'drop-over' : '',
        ].filter(Boolean).join(' ')}
        onClick={(e) => { if (!renaming) selectNode(node.id, e.shiftKey); }}
        onDoubleClick={startRename}
      >
        <span className="drag-handle" {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}>⠿</span>
        {hasChildren && (
          <span style={{ fontSize: 10, cursor: 'pointer', userSelect: 'none', marginRight: 2 }}
            onClick={e => { e.stopPropagation(); setCollapsed(!collapsed); }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <span style={{ marginRight: 4 }}>{NODE_ICONS[node.nodeType] ?? '•'}</span>
        {renaming ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 12, border: '1px solid var(--brand-navy)',
              borderRadius: 3, padding: '1px 4px', background: 'var(--bg-app)', outline: 'none' }}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )}
        {node.lockedBy && <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 2 }}>🔒</span>}
        <button
          className="floating-btn danger"
          style={{ width: 20, height: 20, fontSize: 11, opacity: 0, marginLeft: 2 }}
          onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
          title="Delete"
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >✕</button>
      </div>
      {hasChildren && !collapsed && children.map(child => (
        <LayersItem key={child.id} node={child} depth={depth + 1} childrenOf={childrenOf} />
      ))}
    </div>
  );
}
```

**Step 2: Update LeftPanel.tsx** — `LayersTree` no longer needs props:

```tsx
{tab === 'layers' && <LayersTree />}
```

**Step 3: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

**Step 4: Visual tests:**
- Click a layout node in layers → collapses/expands children
- Double-click any node → inline rename input appears, Enter to save
- Hover any row → delete X appears, click X → node removed from canvas immediately

**Step 5: Run all backend tests** (make sure we haven't broken anything):

```bash
npm run test:backend
```
Expected: All 54 tests still pass.

**Step 6: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/panels/LayersTree.tsx \
        apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/panels/LeftPanel.tsx
git commit -m "feat(canvas): layers panel — collapse/expand, inline rename, delete on hover"
```

---

## Task 11: Context Menu Migration to CanvasContext

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx`

**Context:** The old `buildContextMenuActions` function in `CanvasInner` used direct `conn.reducers.*` calls. Now it should use `useCanvas()` actions. Move the logic into `CanvasUI` and wire to context.

**Step 1: In `CanvasUI`, rebuild context menu actions using useCanvas:**

```tsx
const { nodes, flatNodes, selectedIds, selectNode, moveNode, deleteNode, duplicateSelected, insertNode } = useCanvas();

const buildContextMenuActions = useCallback((_targetId: string | null) => {
  const selArray = [...selectedIds];
  const selNodes = selArray.map(id => nodes.get(id)).filter(Boolean) as any[];
  const count    = selArray.length;
  return [
    {
      label: 'Duplicate', icon: '⧉', shortcut: '⌘D',
      disabled: count === 0,
      onClick: duplicateSelected,
    },
    {
      label: 'Delete', icon: '✕', danger: true, divider: true,
      disabled: count === 0,
      onClick: () => selArray.forEach(id => deleteNode(id)),
    },
    // Keep Group/Ungroup/BringToFront/SendToBack with resolveDropOrder logic using context moveNode
    // (port the same logic from old CanvasInner, replacing conn.reducers.moveNode with context.moveNode)
  ];
}, [selectedIds, nodes, duplicateSelected, deleteNode]);
```

**Step 2: Remove the old `buildContextMenuActions` from the file** entirely (it was 250 lines).

**Step 3: Add keyboard shortcuts** in `CanvasUI`:

```tsx
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      duplicateSelected();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if ((e.target as HTMLElement).isContentEditable) return;
      [...selectedIds].forEach(id => deleteNode(id));
    }
    if (e.key === 'Escape') {
      selectNode(null);
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [duplicateSelected, deleteNode, selectedIds, selectNode]);
```

**Step 4: Build check**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit && npm run build 2>&1 | tail -10
```

**Step 5: Full integration test** — start the dev server and verify:
- Canvas loads with white theme
- Elements panel → click Section → appears on canvas and layers instantly
- Click a heading → selected (navy outline), floating toolbar appears
- Double-click text → inline edit works
- Drag node → drop zones appear
- Duplicate (⌘D) → new node appears adjacent to original
- Right panel Properties tab → style updates apply instantly
- Right panel Settings tab → shows for component nodes
- Layers panel → collapse, rename, delete all work
- AI prompt → generates nodes via STDB, context auto-syncs

```bash
npm run dev:local
# Open http://localhost:3002/canvas/[any-pageId]
```

**Step 6: Commit**

```bash
git add apps/canvas-dashboard/src/app/canvas/\[pageId\]/components/CanvasPage.tsx
git commit -m "feat(canvas): migrate context menu + keyboard shortcuts to CanvasContext"
```

---

## Task 12: Final Cleanup + Memory Update

**Files:**
- Modify: `/Users/khalid/.claude/projects/-Users-khalid-Desktop-app-selorax-canvas/memory/MEMORY.md`

**Step 1: Run full test suite**

```bash
npm run test:backend && npm run test:renderer
```
Expected: All 73 tests still pass (backend + renderer).

**Step 2: TypeScript build check across all workspaces**

```bash
npm run build --workspace=apps/canvas-dashboard 2>&1 | tail -20
```

**Step 3: Update MEMORY.md** — add the new architecture note:

```markdown
## Canvas UX Overhaul (Phase 11+) ✅
- `CanvasContext` at `apps/canvas-dashboard/src/context/CanvasContext.tsx`
  - Optimistic local state, 100ms debounced STDB sync queue
  - User actions → context (instant) → queue → STDB
  - AI changes → STDB → useTable → context (auto-merge)
- White branded theme: navy `#2D2F8F` + orange `#F47920`
- 4 left tabs: Elements, Layers, Components, Funnels
- Inline editing: double-click on text/heading/button nodes
- Drop zones: before/after/inside with `dropInfo` state in CanvasUI
- Right panel: Properties (accordion) + Settings (schema-driven DynamicInputs)
- ESM settings schema: DB first, then ESM export override
- Floating toolbar: appears above selected node
- Layers: collapse/expand, inline rename, delete on hover
```

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(canvas): complete UX overhaul — white theme, elements panel, inline editing, drop zones, settings tab"
```
