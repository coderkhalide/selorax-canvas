# Phase 11 Canvas UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-select + full context menu, Flex/Grid layout controls, and pixel-perfect PNG/JPG export to the canvas-dashboard.

**Architecture:** Multi-select uses `Set<string>` in CanvasPage replacing the single `selectedId`; rubber band geometry runs in Canvas.tsx using `getBoundingClientRect`; ContextMenu renders via React portal; LayoutPanel sits above StyleEditor in RightPanel; screenshots use `html-to-image` capturing `.canvas-frame`.

**Tech Stack:** Next.js 14, SpacetimeDB v2, `@dnd-kit/core` (existing), `html-to-image` (new), Vitest + React Testing Library.

---

## Context (read before any task)

- Working directory: `apps/canvas-dashboard`
- STDB reducers are **camelCase**: `conn.reducers.moveNode`, `conn.reducers.insertNode`, `conn.reducers.lockNode`, `conn.reducers.unlockNode`, `conn.reducers.updateNodeProps`, `conn.reducers.deleteNodeCascade`
- STDB row fields are **camelCase**: `node.parentId`, `node.nodeType`, `node.order`, `node.lockedBy`
- Optional STDB fields: `{ some: value }` shape
- `resolveDropOrder(before?, after?)` is already in `src/utils/drop-order.ts`
- No new STDB module changes — all operations use existing reducers
- Styling: vanilla CSS in `src/app/globals.css` only

---

## Task 1: Multi-select state + shift-click

**Files:**
- Modify: `src/app/canvas/[pageId]/components/CanvasPage.tsx`
- Modify: `src/app/canvas/[pageId]/components/Canvas.tsx`
- Modify: `src/app/canvas/[pageId]/components/CanvasNode.tsx`
- Modify: `src/app/canvas/[pageId]/components/panels/LeftPanel.tsx`
- Modify: `src/app/canvas/[pageId]/components/panels/LayersTree.tsx`
- Create: `src/__tests__/multi-select.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/multi-select.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applySelect } from '@/utils/selection';

describe('applySelect', () => {
  it('single click replaces selection', () => {
    const prev = new Set(['a', 'b']);
    expect(applySelect(prev, 'c', false)).toEqual(new Set(['c']));
  });

  it('shift-click adds to selection', () => {
    const prev = new Set(['a']);
    expect(applySelect(prev, 'b', true)).toEqual(new Set(['a', 'b']));
  });

  it('shift-click on already-selected item removes it', () => {
    const prev = new Set(['a', 'b']);
    expect(applySelect(prev, 'a', true)).toEqual(new Set(['b']));
  });

  it('click with empty prev creates single selection', () => {
    expect(applySelect(new Set(), 'x', false)).toEqual(new Set(['x']));
  });

  it('shift-click on empty prev adds single item', () => {
    expect(applySelect(new Set(), 'x', true)).toEqual(new Set(['x']));
  });
});
```

**Step 2: Run tests — expect failures**

```bash
cd apps/canvas-dashboard && npm test -- src/__tests__/multi-select.test.ts 2>&1 | tail -10
```
Expected: 5 failures with "Cannot find module '@/utils/selection'".

**Step 3: Create `src/utils/selection.ts`**

```typescript
/**
 * Pure function: compute next selectedIds set based on click + shift key.
 */
export function applySelect(
  prev: Set<string>,
  id: string,
  shiftKey: boolean,
): Set<string> {
  if (!shiftKey) return new Set([id]);
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
```

**Step 4: Run tests — expect all 5 to pass**

```bash
npm test -- src/__tests__/multi-select.test.ts 2>&1 | tail -5
```

**Step 5: Update CanvasPage.tsx**

Replace `selectedId: string | null` with `selectedIds: Set<string>`. Find the relevant lines and replace:

```typescript
// ADD import at top
import { applySelect } from '@/utils/selection';

// REPLACE (line 23):
// const [selectedId, setSelectedId] = useState<string | null>(null);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// REPLACE handleSelect (lines 96-101):
const handleSelect = useCallback((id: string | null, shiftKey = false) => {
  if (!conn) return;
  if (id === null) {
    // Deselect all — unlock all
    selectedIds.forEach(sid => conn.reducers.unlockNode({ nodeId: sid }));
    setSelectedIds(new Set());
    return;
  }
  const next = applySelect(selectedIds, id, shiftKey);
  // Unlock nodes that left the selection
  selectedIds.forEach(sid => {
    if (!next.has(sid)) conn.reducers.unlockNode({ nodeId: sid });
  });
  // Lock newly selected nodes
  next.forEach(sid => {
    if (!selectedIds.has(sid)) conn.reducers.lockNode({ nodeId: sid });
  });
  setSelectedIds(next);
}, [conn, selectedIds]);

// REPLACE selectedNode derivation (line 94):
// Only use the "primary" selected node for the right panel (last in set)
const selectedNode = flatNodes.find(n => n.id === [...selectedIds].at(-1)) ?? null;

// UPDATE handleMouseMove (line 87):
// selectedNodeId: selectedId ?? undefined,
// → selectedNodeId: [...selectedIds].at(-1) ?? undefined,

// UPDATE Canvas JSX (line 134-137):
// selectedId={selectedId} onSelect={handleSelect}
// → selectedIds={selectedIds} onSelect={handleSelect}

// UPDATE LeftPanel JSX (line 121):
// selectedId={selectedId}
// → selectedId={[...selectedIds].at(-1) ?? null}

// UPDATE AIBar JSX (line 140):
// selectedNodeId={selectedId}
// → selectedNodeId={[...selectedIds].at(-1) ?? null}
```

**Step 6: Update Canvas.tsx**

```typescript
// REPLACE interface:
interface CanvasProps {
  tree: any;
  cursors: any[];
  selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
}

// REPLACE function signature and CanvasNode call:
export default function Canvas({ tree, cursors, selectedIds, onSelect }: CanvasProps) {
  return (
    <div className="canvas-viewport" onClick={(e) => {
      if (e.target === e.currentTarget) onSelect(null);
    }}>
      <div className="canvas-frame">
        {tree ? (
          <CanvasNode node={tree} selectedIds={selectedIds} onSelect={onSelect} depth={0} />
        ) : (
          // ...empty state unchanged...
        )}
        // ...cursors unchanged...
      </div>
    </div>
  );
}
```

**Step 7: Update CanvasNode.tsx**

```typescript
// REPLACE interface:
interface CanvasNodeProps {
  node: any;
  selectedIds: Set<string>;
  onSelect: (id: string, shiftKey?: boolean) => void;
  depth: number;
}

// REPLACE isSelected check:
// const isSelected = node.id === selectedId;
const isSelected = selectedIds.has(node.id);

// REPLACE handleClick:
const handleClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  onSelect(node.id, e.shiftKey);
};

// UPDATE recursive CanvasNode calls inside layout case:
// selectedId={selectedId} → selectedIds={selectedIds}
```

**Step 8: Update LayersTree.tsx** — change `selectedId: string | null` prop to `selectedId: string | null` (keep as-is — LeftPanel already passes `.at(-1) ?? null`). No change needed to LayersTree.

**Step 9: Run all tests**

```bash
npm test 2>&1 | tail -10
```
Expected: 23+ tests pass.

**Step 10: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Fix any new errors from the prop changes.

---

## Task 2: Rubber band selection

**Files:**
- Modify: `src/app/canvas/[pageId]/components/Canvas.tsx`
- Modify: `src/app/globals.css`
- Create: `src/utils/rubber-band.ts`
- Create: `src/__tests__/rubber-band.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/rubber-band.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rectsIntersect, buildSelectionRect } from '@/utils/rubber-band';

describe('rectsIntersect', () => {
  it('fully contained returns true', () => {
    expect(rectsIntersect(
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 5, y: 5, width: 100, height: 100 },
    )).toBe(true);
  });

  it('no overlap returns false', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    )).toBe(false);
  });

  it('touching edges returns false (strict overlap needed)', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
    )).toBe(false);
  });

  it('partial overlap returns true', () => {
    expect(rectsIntersect(
      { x: 5, y: 5, width: 20, height: 20 },
      { x: 15, y: 15, width: 20, height: 20 },
    )).toBe(true);
  });
});

describe('buildSelectionRect', () => {
  it('normalizes reversed start/end', () => {
    const r = buildSelectionRect({ x: 50, y: 50 }, { x: 10, y: 20 });
    expect(r).toEqual({ x: 10, y: 20, width: 40, height: 30 });
  });

  it('normal direction passes through', () => {
    const r = buildSelectionRect({ x: 10, y: 20 }, { x: 50, y: 80 });
    expect(r).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test -- src/__tests__/rubber-band.test.ts 2>&1 | tail -10
```

**Step 3: Create `src/utils/rubber-band.ts`**

```typescript
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Returns true if two rectangles have strict overlap (touching edges excluded). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Normalize two points into a well-formed Rect (positive width/height). */
export function buildSelectionRect(start: Point, end: Point): Rect {
  return {
    x:      Math.min(start.x, end.x),
    y:      Math.min(start.y, end.y),
    width:  Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
```

**Step 4: Run tests — expect 6 to pass**

```bash
npm test -- src/__tests__/rubber-band.test.ts 2>&1 | tail -5
```

**Step 5: Update Canvas.tsx with rubber band logic**

```typescript
'use client';
import { useState, useCallback, useRef } from 'react';
import CanvasNode from './CanvasNode';
import ContextMenu from './ContextMenu';
import { buildSelectionRect, rectsIntersect, type Point } from '@/utils/rubber-band';

interface CanvasProps {
  tree: any;
  cursors: any[];
  selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onMultiSelect: (ids: string[]) => void;
  onContextMenu: (x: number, y: number, targetId: string | null) => void;
}

export default function Canvas({
  tree, cursors, selectedIds, onSelect, onMultiSelect, onContextMenu,
}: CanvasProps) {
  const [rubberStart, setRubberStart] = useState<Point | null>(null);
  const [rubberEnd,   setRubberEnd]   = useState<Point | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start rubber band on empty canvas background (not on a node)
    if ((e.target as HTMLElement).closest('[data-node-id]')) return;
    if (e.button !== 0) return; // left button only
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setRubberStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setRubberEnd(  { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rubberStart) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setRubberEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [rubberStart]);

  const handleMouseUp = useCallback(() => {
    if (!rubberStart || !rubberEnd) return;
    const selRect = buildSelectionRect(rubberStart, rubberEnd);
    // Only act if meaningful drag (> 4px in any direction)
    if (selRect.width > 4 || selRect.height > 4) {
      const frameRect = frameRef.current?.getBoundingClientRect();
      if (frameRect) {
        const ids: string[] = [];
        document.querySelectorAll<HTMLElement>('[data-node-id]').forEach(el => {
          const r = el.getBoundingClientRect();
          const localRect = {
            x: r.left - frameRect.left,
            y: r.top - frameRect.top,
            width: r.width,
            height: r.height,
          };
          if (rectsIntersect(selRect, localRect)) {
            const id = el.dataset.nodeId!;
            ids.push(id);
          }
        });
        if (ids.length > 0) onMultiSelect(ids);
      }
    }
    setRubberStart(null);
    setRubberEnd(null);
  }, [rubberStart, rubberEnd, onMultiSelect]);

  const rubberRect = rubberStart && rubberEnd
    ? buildSelectionRect(rubberStart, rubberEnd)
    : null;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null;
    onContextMenu(e.clientX, e.clientY, target?.dataset.nodeId ?? null);
  }, [onContextMenu]);

  return (
    <div
      className="canvas-viewport"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div className="canvas-frame" ref={frameRef}>
        {tree ? (
          <CanvasNode node={tree} selectedIds={selectedIds} onSelect={onSelect} depth={0} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 400, color: '#9CA3AF', flexDirection: 'column', gap: 12,
          }}>
            <span style={{ fontSize: 40 }}>🎨</span>
            <p>Canvas is empty. Use the AI bar to start building.</p>
          </div>
        )}

        {/* Rubber band selection rectangle */}
        {rubberRect && (rubberRect.width > 4 || rubberRect.height > 4) && (
          <div
            className="rubber-band"
            style={{
              left: rubberRect.x,
              top: rubberRect.y,
              width: rubberRect.width,
              height: rubberRect.height,
            }}
          />
        )}

        {/* Live cursors */}
        {cursors.map(cursor => (
          <div key={cursor.userId} style={{
            position: 'absolute',
            left: cursor.x, top: cursor.y,
            pointerEvents: 'none',
            transform: 'translate(-2px, -2px)',
          }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path d="M0 0L16 12L8 12L5 20L0 0Z" fill={cursor.userColor} />
            </svg>
            <span style={{
              background: cursor.userColor, color: '#fff',
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              marginLeft: 16, whiteSpace: 'nowrap',
            }}>
              {cursor.userName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 6: Update CanvasPage.tsx** — add `onMultiSelect` and `onContextMenu` handlers + pass them to Canvas:

```typescript
// ADD state for context menu
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);

// ADD onMultiSelect handler
const handleMultiSelect = useCallback((ids: string[]) => {
  ids.forEach(id => conn?.reducers.lockNode({ nodeId: id }));
  setSelectedIds(new Set(ids));
}, [conn]);

// ADD onContextMenu handler
const handleContextMenu = useCallback((x: number, y: number, targetId: string | null) => {
  if (targetId && !selectedIds.has(targetId)) {
    // Right-click on unselected node → select it first
    setSelectedIds(new Set([targetId]));
  }
  setContextMenu({ x, y, targetId });
}, [selectedIds]);

// UPDATE Canvas JSX:
<Canvas
  tree={tree} cursors={[...cursors]}
  selectedIds={selectedIds} onSelect={handleSelect}
  onMultiSelect={handleMultiSelect}
  onContextMenu={handleContextMenu}
/>
```

**Step 7: Add rubber band CSS to globals.css**

```css
/* ============================================================
   Rubber band selection
   ============================================================ */
.rubber-band {
  position: absolute;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid #7C3AED;
  border-radius: 2px;
  pointer-events: none;
  z-index: 100;
}
```

**Step 8: TypeScript check + run all tests**

```bash
npx tsc --noEmit 2>&1 | head -20
npm test 2>&1 | tail -10
```

---

## Task 3: ContextMenu component

**Files:**
- Create: `src/app/canvas/[pageId]/components/ContextMenu.tsx`
- Modify: `src/app/globals.css`

**Step 1: Create `ContextMenu.tsx`**

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuAction {
  label:     string;
  icon?:     string;
  shortcut?: string;
  danger?:   boolean;
  disabled?: boolean;
  divider?:  boolean;  // render a divider line before this item
  onClick:   () => void;
}

interface ContextMenuProps {
  x:        number;
  y:        number;
  actions:  ContextMenuAction[];
  onClose:  () => void;
}

export default function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [onClose]);

  // Adjust position so menu stays inside viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    top:  Math.min(y, window.innerHeight - 400),
    zIndex: 9999,
  };

  const menu = (
    <div ref={menuRef} className="ctx-menu" style={menuStyle}>
      {actions.map((action, i) => (
        <div key={i}>
          {action.divider && <div className="ctx-divider" />}
          <button
            className={`ctx-item ${action.danger ? 'danger' : ''}`}
            disabled={action.disabled}
            onClick={() => { action.onClick(); onClose(); }}
          >
            {action.icon && <span className="ctx-icon">{action.icon}</span>}
            <span className="ctx-label">{action.label}</span>
            {action.shortcut && (
              <span className="ctx-shortcut">{action.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
```

**Step 2: Add context menu CSS to globals.css**

```css
/* ============================================================
   Context Menu
   ============================================================ */
.ctx-menu {
  background: #1a1d27;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  padding: 4px;
  min-width: 200px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  user-select: none;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: 5px;
  color: #D1D5DB;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-item:hover:not(:disabled) { background: rgba(124,58,237,0.12); color: #fff; }
.ctx-item:disabled { opacity: 0.35; cursor: default; }
.ctx-item.danger { color: #EF4444; }
.ctx-item.danger:hover:not(:disabled) { background: rgba(239,68,68,0.1); }

.ctx-icon    { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }
.ctx-label   { flex: 1; }
.ctx-shortcut { font-size: 10px; color: #4B5563; font-family: monospace; }

.ctx-divider {
  height: 1px;
  background: #2a2d3a;
  margin: 3px 4px;
}
```

**Step 3: Wire ContextMenu in CanvasPage.tsx**

Add the import and render at the bottom of CanvasInner return:

```typescript
import ContextMenu, { type ContextMenuAction } from './ContextMenu';

// Inside CanvasInner return, before </DndContext>:
{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    actions={buildContextMenuActions(contextMenu.targetId)}
    onClose={() => setContextMenu(null)}
  />
)}
```

Add a placeholder `buildContextMenuActions` function (will be filled in Task 4-6):

```typescript
const buildContextMenuActions = useCallback((targetId: string | null): ContextMenuAction[] => {
  const count = selectedIds.size;
  return [
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      disabled: count === 0,
      onClick: () => {
        selectedIds.forEach(id => conn?.reducers.deleteNodeCascade({ nodeId: id }));
        setSelectedIds(new Set());
      },
    },
  ];
}, [conn, selectedIds]);
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

---

## Task 4: Group + Ungroup

**Files:**
- Modify: `src/app/canvas/[pageId]/components/CanvasPage.tsx`
- Create: `src/__tests__/group-operations.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/group-operations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeGroupParent } from '@/utils/selection';

describe('computeGroupParent', () => {
  const nodes = [
    { id: 'root', parentId: null, order: 'a0' },
    { id: 'n1',   parentId: 'root', order: 'a1' },
    { id: 'n2',   parentId: 'root', order: 'a2' },
    { id: 'n3',   parentId: 'n1',   order: 'a0' }, // child of n1
  ];

  it('returns shared parent when all nodes share a parent', () => {
    expect(computeGroupParent(['n1', 'n2'], nodes)).toBe('root');
  });

  it('returns root id when nodes have different parents', () => {
    expect(computeGroupParent(['n1', 'n3'], nodes)).toBe('root');
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test -- src/__tests__/group-operations.test.ts 2>&1 | tail -10
```

**Step 3: Add `computeGroupParent` to `src/utils/selection.ts`**

```typescript
interface FlatNode { id: string; parentId: string | null; order: string; }

/**
 * Returns the common parent for grouping: shared parent of all selected nodes,
 * or the root-level parent (null-parent node's parent) as fallback.
 */
export function computeGroupParent(
  selectedIds: string[],
  allNodes: FlatNode[],
): string | null {
  const parents = new Set(
    selectedIds.map(id => allNodes.find(n => n.id === id)?.parentId ?? null)
  );
  if (parents.size === 1) return [...parents][0];
  // Mixed parents — find the common ancestor (use first node's root chain)
  const first = allNodes.find(n => n.id === selectedIds[0]);
  return first?.parentId ?? null;
}
```

**Step 4: Run tests — expect 2 to pass**

```bash
npm test -- src/__tests__/group-operations.test.ts 2>&1 | tail -5
```

**Step 5: Add group/ungroup to `buildContextMenuActions` in CanvasPage.tsx**

The `buildContextMenuActions` function needs access to `flatNodes`. Add the group/ungroup items:

```typescript
const buildContextMenuActions = useCallback((targetId: string | null): ContextMenuAction[] => {
  const count     = selectedIds.size;
  const selArray  = [...selectedIds];
  const selNodes  = flatNodes.filter(n => selectedIds.has(n.id));
  const firstNode = flatNodes.find(n => n.id === selArray[0]);
  const isLayout  = selNodes.length === 1 && selNodes[0]?.nodeType === 'layout';

  const groupAction: ContextMenuAction = {
    label: 'Group Selection',
    icon: '⬜',
    disabled: count < 2,
    onClick: () => {
      if (!conn) return;
      // 1. Determine parent
      const parentId = computeGroupParent(selArray, [...flatNodes]);
      // 2. Find order: use order of first selected sibling
      const parentChildren = flatNodes
        .filter(n => n.parentId === parentId)
        .sort((a, b) => a.order.localeCompare(b.order));
      const firstSelectedInParent = parentChildren.find(n => selectedIds.has(n.id));
      const groupOrder = firstSelectedInParent?.order ?? resolveDropOrder(
        parentChildren[parentChildren.length - 1]?.order
      );
      // 3. Create layout node
      const groupId = crypto.randomUUID();
      conn.reducers.insertNode({
        id: groupId,
        pageId,
        tenantId,
        parentId,
        nodeType: 'layout',
        order: groupOrder,
        styles: JSON.stringify({ display: 'flex', flexDirection: 'column', gap: '8px' }),
        props: null, settings: null, componentUrl: null, componentVersion: null, componentId: null,
      });
      // 4. Move selected nodes into the group
      selArray.forEach((id, i) => {
        conn.reducers.moveNode({
          nodeId: id,
          newParentId: groupId,
          newOrder: resolveDropOrder(i > 0 ? `a${i-1}` : undefined, undefined),
        });
      });
      setSelectedIds(new Set([groupId]));
    },
  };

  const ungroupAction: ContextMenuAction = {
    label: 'Ungroup',
    icon: '↗️',
    disabled: !isLayout,
    onClick: () => {
      if (!conn || !isLayout) return;
      const layout   = selNodes[0];
      const children = flatNodes
        .filter(n => n.parentId === layout.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      // Move all children to layout's parent
      children.forEach((child, i) => {
        conn.reducers.moveNode({
          nodeId: child.id,
          newParentId: layout.parentId ?? 'root',
          newOrder: resolveDropOrder(layout.order + String(i), undefined),
        });
      });
      // Delete the now-empty layout
      conn.reducers.deleteNodeCascade({ nodeId: layout.id });
      setSelectedIds(new Set(children.map(c => c.id)));
    },
  };

  return [
    groupAction,
    ungroupAction,
    // ...more items added in Task 5-6
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      divider: true,
      disabled: count === 0,
      onClick: () => {
        selArray.forEach(id => conn?.reducers.deleteNodeCascade({ nodeId: id }));
        setSelectedIds(new Set());
      },
    },
  ];
}, [conn, selectedIds, flatNodes, pageId, tenantId]);
```

Also add this import at the top of CanvasPage.tsx:
```typescript
import { applySelect, computeGroupParent } from '@/utils/selection';
```

**Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

---

## Task 5: Duplicate + Copy/Paste

**Files:**
- Create: `src/utils/clipboard.ts`
- Create: `src/__tests__/canvas-clipboard.test.ts`
- Modify: `src/app/canvas/[pageId]/components/CanvasPage.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/canvas-clipboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyNodes, pasteNodes, duplicateNodes } from '@/utils/clipboard';

const mockNodes = [
  { id: 'a', parentId: null, order: 'a0', nodeType: 'layout', styles: '{}', props: null, settings: null, componentUrl: null, componentVersion: null, componentId: null },
  { id: 'b', parentId: 'a',  order: 'a1', nodeType: 'element', styles: '{}', props: '{}', settings: null, componentUrl: null, componentVersion: null, componentId: null },
];

beforeEach(() => {
  // Mock sessionStorage
  vi.stubGlobal('sessionStorage', {
    _store: {} as Record<string, string>,
    getItem(k: string) { return this._store[k] ?? null; },
    setItem(k: string, v: string) { this._store[k] = v; },
  });
});

describe('copyNodes + pasteNodes', () => {
  it('round-trips node data through sessionStorage', () => {
    copyNodes(['a', 'b'], mockNodes as any);
    const pasted = pasteNodes();
    expect(pasted).toHaveLength(2);
    expect(pasted[0].oldId).toBe('a');
    expect(pasted[1].oldId).toBe('b');
  });

  it('pasteNodes returns empty array when clipboard is empty', () => {
    expect(pasteNodes()).toEqual([]);
  });
});

describe('duplicateNodes', () => {
  it('returns nodes with new IDs for all selected', () => {
    const result = duplicateNodes(['a', 'b'], mockNodes as any, 'a0z');
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe('a');
    expect(result[1].id).not.toBe('b');
    expect(result[1].parentId).toBe(result[0].id); // parent remapped
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test -- src/__tests__/canvas-clipboard.test.ts 2>&1 | tail -10
```

**Step 3: Create `src/utils/clipboard.ts`**

```typescript
const CLIPBOARD_KEY = 'canvas-clipboard';

interface SerializedNode {
  oldId:            string;
  parentId:         string | null;
  nodeType:         string;
  order:            string;
  styles:           string | null;
  props:            string | null;
  settings:         string | null;
  componentUrl:     any;
  componentVersion: any;
  componentId:      string | null;
}

/** Serialize selected nodes (and their descendants) to sessionStorage. */
export function copyNodes(selectedIds: string[], allNodes: any[]): void {
  // Collect selected nodes AND all their descendants
  const collect = (ids: string[]): any[] => {
    const result: any[] = [];
    ids.forEach(id => {
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      result.push(node);
      const children = allNodes.filter(n => n.parentId === id);
      result.push(...collect(children.map(c => c.id)));
    });
    return result;
  };
  const nodes = collect(selectedIds);
  const data: SerializedNode[] = nodes.map(n => ({
    oldId:            n.id,
    parentId:         n.parentId,
    nodeType:         n.nodeType,
    order:            n.order,
    styles:           n.styles,
    props:            n.props,
    settings:         n.settings,
    componentUrl:     n.componentUrl,
    componentVersion: n.componentVersion,
    componentId:      n.componentId,
  }));
  sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
}

/** Read serialized nodes from sessionStorage. */
export function pasteNodes(): SerializedNode[] {
  const raw = sessionStorage.getItem(CLIPBOARD_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

/** Deep-copy selected nodes with new IDs. Returns array ready for insertNode calls. */
export function duplicateNodes(
  selectedIds: string[],
  allNodes: any[],
  baseOrder: string,
): Array<{ id: string; parentId: string | null; nodeType: string; order: string;
           styles: any; props: any; settings: any;
           componentUrl: any; componentVersion: any; componentId: string | null }> {
  const idMap = new Map<string, string>(); // oldId → newId
  const result: ReturnType<typeof duplicateNodes> = [];

  const process = (node: any, newParentId: string | null, orderSuffix: string) => {
    const newId = crypto.randomUUID();
    idMap.set(node.id, newId);
    result.push({
      id:               newId,
      parentId:         newParentId,
      nodeType:         node.nodeType,
      order:            orderSuffix,
      styles:           node.styles,
      props:            node.props,
      settings:         node.settings,
      componentUrl:     node.componentUrl,
      componentVersion: node.componentVersion,
      componentId:      node.componentId,
    });
    const children = allNodes.filter(n => n.parentId === node.id);
    children.forEach((child, i) => process(child, newId, `a${i}`));
  };

  selectedIds.forEach((id, i) => {
    const node = allNodes.find(n => n.id === id);
    if (node) process(node, node.parentId, baseOrder + String(i));
  });

  return result;
}
```

**Step 4: Run tests — expect 4 to pass**

```bash
npm test -- src/__tests__/canvas-clipboard.test.ts 2>&1 | tail -5
```

**Step 5: Add Duplicate + Copy/Paste to `buildContextMenuActions` in CanvasPage.tsx**

```typescript
import { copyNodes, pasteNodes, duplicateNodes } from '@/utils/clipboard';

// Inside buildContextMenuActions, add before the Delete item:
{
  label: 'Duplicate',
  icon: '⿸',
  shortcut: '⌘D',
  disabled: count === 0,
  onClick: () => {
    if (!conn) return;
    const lastSibling = flatNodes
      .filter(n => n.parentId === (firstNode?.parentId ?? null))
      .sort((a, b) => a.order.localeCompare(b.order))
      .at(-1);
    const baseOrder = resolveDropOrder(lastSibling?.order, undefined);
    const newNodes = duplicateNodes(selArray, [...flatNodes], baseOrder);
    newNodes.forEach(n => conn.reducers.insertNode({
      id: n.id, pageId, tenantId,
      parentId: n.parentId, nodeType: n.nodeType, order: n.order,
      styles: n.styles, props: n.props, settings: n.settings,
      componentUrl: n.componentUrl, componentVersion: n.componentVersion,
      componentId: n.componentId,
    }));
    setSelectedIds(new Set(newNodes.filter(n => selArray.includes(n.id) || !newNodes.some(m => m.parentId === n.id && selArray.includes(m.id))).slice(0, count).map(n => n.id)));
  },
},
{
  label: 'Copy',
  icon: '📋',
  shortcut: '⌘C',
  disabled: count === 0,
  onClick: () => copyNodes(selArray, [...flatNodes]),
},
{
  label: 'Paste',
  icon: '📌',
  shortcut: '⌘V',
  onClick: () => {
    if (!conn) return;
    const clipboard = pasteNodes();
    if (!clipboard.length) return;
    const lastSibling = flatNodes.at(-1);
    const baseOrder = resolveDropOrder(lastSibling?.order, undefined);
    clipboard.forEach((n, i) => conn.reducers.insertNode({
      id: crypto.randomUUID(), pageId, tenantId,
      parentId: null, nodeType: n.nodeType,
      order: baseOrder + String(i),
      styles: n.styles, props: n.props, settings: n.settings,
      componentUrl: n.componentUrl, componentVersion: n.componentVersion,
      componentId: n.componentId,
    }));
  },
},
```

**Step 6: TypeScript check + run all tests**

```bash
npx tsc --noEmit 2>&1 | head -20
npm test 2>&1 | tail -10
```

---

## Task 6: Lock/Unlock + Rename + Bring to Front/Back in context menu

**Files:**
- Modify: `src/app/canvas/[pageId]/components/CanvasPage.tsx`

**Step 1: Add remaining items to `buildContextMenuActions`**

Insert these items between the Group/Ungroup block and Duplicate in `buildContextMenuActions`:

```typescript
// Bring to Front / Send to Back
{
  label: 'Bring to Front',
  icon: '⬆️',
  disabled: count === 0,
  onClick: () => {
    if (!conn) return;
    selArray.forEach(id => {
      const node = flatNodes.find(n => n.id === id);
      if (!node) return;
      const siblings = flatNodes
        .filter(n => n.parentId === node.parentId && n.id !== id)
        .sort((a, b) => a.order.localeCompare(b.order));
      const newOrder = resolveDropOrder(siblings.at(-1)?.order, undefined);
      conn.reducers.moveNode({ nodeId: id, newParentId: node.parentId ?? 'root', newOrder });
    });
  },
},
{
  label: 'Send to Back',
  icon: '⬇️',
  disabled: count === 0,
  onClick: () => {
    if (!conn) return;
    selArray.forEach(id => {
      const node = flatNodes.find(n => n.id === id);
      if (!node) return;
      const siblings = flatNodes
        .filter(n => n.parentId === node.parentId && n.id !== id)
        .sort((a, b) => a.order.localeCompare(b.order));
      const newOrder = resolveDropOrder(undefined, siblings[0]?.order);
      conn.reducers.moveNode({ nodeId: id, newParentId: node.parentId ?? 'root', newOrder });
    });
  },
},
// Lock / Unlock
{
  label: selNodes.every(n => n.lockedBy) ? 'Unlock' : 'Lock',
  icon: selNodes.every(n => n.lockedBy) ? '🔓' : '🔒',
  disabled: count === 0,
  onClick: () => {
    if (!conn) return;
    const allLocked = selNodes.every(n => n.lockedBy);
    if (allLocked) selArray.forEach(id => conn.reducers.unlockNode({ nodeId: id }));
    else           selArray.forEach(id => conn.reducers.lockNode({ nodeId: id }));
  },
},
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

---

## Task 7: LayoutPanel — display toggle + Flex controls

**Files:**
- Create: `src/app/canvas/[pageId]/components/panels/LayoutPanel.tsx`
- Modify: `src/app/canvas/[pageId]/components/panels/RightPanel.tsx`
- Modify: `src/app/globals.css`
- Create: `src/__tests__/LayoutPanel.test.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/LayoutPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LayoutPanel from '@/app/canvas/[pageId]/components/panels/LayoutPanel';

const makeNode = (styles: Record<string, string>) => ({
  id: 'n1', nodeType: 'layout', styles: JSON.stringify(styles),
});

const mockConn = { reducers: { updateNodeStyles: vi.fn() } };

beforeEach(() => vi.clearAllMocks());

describe('LayoutPanel', () => {
  it('shows display toggle buttons', () => {
    render(<LayoutPanel node={makeNode({})} conn={mockConn} tenantId="t1" />);
    expect(screen.getByText('Flex')).toBeInTheDocument();
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('Block')).toBeInTheDocument();
  });

  it('clicking Flex calls updateNodeStyles with display: flex', () => {
    render(<LayoutPanel node={makeNode({})} conn={mockConn} tenantId="t1" />);
    fireEvent.click(screen.getByText('Flex'));
    expect(mockConn.reducers.updateNodeStyles).toHaveBeenCalledWith(
      expect.objectContaining({ styles: expect.stringContaining('"display":"flex"') })
    );
  });

  it('shows flex controls when display is flex', () => {
    render(<LayoutPanel node={makeNode({ display: 'flex' })} conn={mockConn} tenantId="t1" />);
    expect(screen.getByTitle('Row')).toBeInTheDocument();
    expect(screen.getByTitle('Column')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Gap')).toBeInTheDocument();
  });

  it('shows grid controls when display is grid', () => {
    render(<LayoutPanel node={makeNode({ display: 'grid' })} conn={mockConn} tenantId="t1" />);
    expect(screen.getByPlaceholderText('Columns')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rows')).toBeInTheDocument();
  });

  it('clicking direction Row calls updateNodeStyles with flexDirection: row', () => {
    render(<LayoutPanel node={makeNode({ display: 'flex' })} conn={mockConn} tenantId="t1" />);
    fireEvent.click(screen.getByTitle('Row'));
    expect(mockConn.reducers.updateNodeStyles).toHaveBeenCalledWith(
      expect.objectContaining({ styles: expect.stringContaining('"flexDirection":"row"') })
    );
  });

  it('grid columns input calls updateNodeStyles with gridTemplateColumns', () => {
    render(<LayoutPanel node={makeNode({ display: 'grid' })} conn={mockConn} tenantId="t1" />);
    fireEvent.change(screen.getByPlaceholderText('Columns'), { target: { value: '3' } });
    fireEvent.blur(screen.getByPlaceholderText('Columns'));
    expect(mockConn.reducers.updateNodeStyles).toHaveBeenCalledWith(
      expect.objectContaining({ styles: expect.stringContaining('repeat(3, 1fr)') })
    );
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm test -- src/__tests__/LayoutPanel.test.tsx 2>&1 | tail -10
```

**Step 3: Create `LayoutPanel.tsx`**

```typescript
'use client';
import { useState } from 'react';

interface LayoutPanelProps {
  node:     any;
  conn:     any;
  tenantId: string;
}

type Display = 'block' | 'flex' | 'grid' | 'none' | '';

const ALIGN_OPTIONS = [
  { value: 'flex-start', title: 'Start',   icon: '⊤' },
  { value: 'center',     title: 'Center',  icon: '⊙' },
  { value: 'flex-end',   title: 'End',     icon: '⊥' },
  { value: 'stretch',    title: 'Stretch', icon: '↕' },
];

const JUSTIFY_OPTIONS = [
  { value: 'flex-start',     title: 'Start',         icon: '⊣' },
  { value: 'center',         title: 'Center',        icon: '⊙' },
  { value: 'flex-end',       title: 'End',           icon: '⊢' },
  { value: 'space-between',  title: 'Space Between', icon: '↔' },
  { value: 'space-around',   title: 'Space Around',  icon: '↕↕' },
];

export default function LayoutPanel({ node, conn, tenantId }: LayoutPanelProps) {
  const styles: Record<string, string> = (() => {
    try { return JSON.parse(node.styles ?? '{}'); } catch { return {}; }
  })();

  const display: Display = (styles.display as Display) || '';

  const update = (patch: Record<string, string>) => {
    if (!conn) return;
    conn.reducers.updateNodeStyles({
      nodeId: node.id,
      styles: JSON.stringify(patch),
    });
  };

  return (
    <div className="layout-panel">
      <h3 className="layout-panel-title">Layout</h3>

      {/* Display toggle */}
      <div className="layout-row">
        <span className="layout-label">Display</span>
        <div className="layout-btn-group">
          {(['block', 'flex', 'grid', 'none'] as Display[]).map(d => (
            <button
              key={d}
              className={`layout-btn ${display === d ? 'active' : ''}`}
              onClick={() => update({ display: d })}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Flex controls */}
      {display === 'flex' && (
        <>
          <div className="layout-row">
            <span className="layout-label">Direction</span>
            <div className="layout-btn-group">
              <button
                title="Row"
                className={`layout-btn icon ${styles.flexDirection === 'row' ? 'active' : ''}`}
                onClick={() => update({ flexDirection: 'row' })}
              >→</button>
              <button
                title="Column"
                className={`layout-btn icon ${styles.flexDirection === 'column' ? 'active' : ''}`}
                onClick={() => update({ flexDirection: 'column' })}
              >↓</button>
            </div>
          </div>

          <div className="layout-row">
            <span className="layout-label">Wrap</span>
            <div className="layout-btn-group">
              {[{ v: 'nowrap', l: 'No Wrap' }, { v: 'wrap', l: 'Wrap' }].map(({ v, l }) => (
                <button
                  key={v}
                  className={`layout-btn ${(styles.flexWrap ?? 'nowrap') === v ? 'active' : ''}`}
                  onClick={() => update({ flexWrap: v })}
                >{l}</button>
              ))}
            </div>
          </div>

          <div className="layout-row">
            <span className="layout-label">Align</span>
            <div className="layout-btn-group">
              {ALIGN_OPTIONS.map(o => (
                <button
                  key={o.value}
                  title={o.title}
                  className={`layout-btn icon ${styles.alignItems === o.value ? 'active' : ''}`}
                  onClick={() => update({ alignItems: o.value })}
                >{o.icon}</button>
              ))}
            </div>
          </div>

          <div className="layout-row">
            <span className="layout-label">Justify</span>
            <div className="layout-btn-group">
              {JUSTIFY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  title={o.title}
                  className={`layout-btn icon ${styles.justifyContent === o.value ? 'active' : ''}`}
                  onClick={() => update({ justifyContent: o.value })}
                >{o.icon}</button>
              ))}
            </div>
          </div>

          <div className="layout-row">
            <span className="layout-label">Gap</span>
            <input
              className="layout-input"
              defaultValue={styles.gap ?? ''}
              placeholder="Gap"
              onBlur={e => update({ gap: e.target.value })}
            />
          </div>
        </>
      )}

      {/* Grid controls */}
      {display === 'grid' && (
        <>
          <div className="layout-row">
            <span className="layout-label">Columns</span>
            <input
              className="layout-input"
              defaultValue={styles.gridTemplateColumns?.match(/repeat\((\d+)/)?.[1] ?? ''}
              placeholder="Columns"
              onBlur={e => {
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n > 0)
                  update({ gridTemplateColumns: `repeat(${n}, 1fr)` });
              }}
            />
          </div>

          <div className="layout-row">
            <span className="layout-label">Rows</span>
            <input
              className="layout-input"
              defaultValue={styles.gridTemplateRows ?? ''}
              placeholder="Rows"
              onBlur={e => update({ gridTemplateRows: e.target.value })}
            />
          </div>

          <div className="layout-row">
            <span className="layout-label">Col Gap</span>
            <input
              className="layout-input"
              defaultValue={styles.columnGap ?? ''}
              placeholder="Col gap"
              onBlur={e => update({ columnGap: e.target.value })}
            />
          </div>

          <div className="layout-row">
            <span className="layout-label">Row Gap</span>
            <input
              className="layout-input"
              defaultValue={styles.rowGap ?? ''}
              placeholder="Row gap"
              onBlur={e => update({ rowGap: e.target.value })}
            />
          </div>

          <div className="layout-row">
            <span className="layout-label">Align</span>
            <div className="layout-btn-group">
              {ALIGN_OPTIONS.map(o => (
                <button
                  key={o.value}
                  title={o.title}
                  className={`layout-btn icon ${styles.alignItems === o.value ? 'active' : ''}`}
                  onClick={() => update({ alignItems: o.value })}
                >{o.icon}</button>
              ))}
            </div>
          </div>

          <div className="layout-row">
            <span className="layout-label">Justify</span>
            <div className="layout-btn-group">
              {JUSTIFY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  title={o.title}
                  className={`layout-btn icon ${styles.justifyContent === o.value ? 'active' : ''}`}
                  onClick={() => update({ justifyContent: o.value })}
                >{o.icon}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 4: Run tests — expect 6 to pass**

```bash
npm test -- src/__tests__/LayoutPanel.test.tsx 2>&1 | tail -5
```

**Step 5: Update RightPanel.tsx to include LayoutPanel**

```typescript
import LayoutPanel from './LayoutPanel';

// Inside RightPanel, replace the StyleEditor section:
{node ? (
  <>
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Node ID</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>
        {node.id.slice(0, 12)}...
      </p>
    </div>
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Type</p>
      <p style={{ fontSize: 12, color: '#a78bfa' }}>{node.nodeType}</p>
    </div>
    <LayoutPanel node={node} conn={conn} tenantId={tenantId} />
    <StyleEditor node={node} conn={conn} tenantId={tenantId} />
  </>
```

**Step 6: Add LayoutPanel CSS to globals.css**

```css
/* ============================================================
   Layout Panel (Flex / Grid controls)
   ============================================================ */
.layout-panel {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #2a2d3a;
}

.layout-panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6B7280;
  font-weight: 600;
  margin-bottom: 10px;
}

.layout-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.layout-label {
  font-size: 11px;
  color: #6B7280;
  width: 56px;
  flex-shrink: 0;
}

.layout-btn-group {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.layout-btn {
  padding: 4px 8px;
  font-size: 11px;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 5px;
  color: #6B7280;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
  line-height: 1.4;
}

.layout-btn.icon { padding: 4px 7px; font-size: 13px; }

.layout-btn:hover:not(.active) {
  border-color: #4B5563;
  color: #D1D5DB;
}

.layout-btn.active {
  background: rgba(124,58,237,0.15);
  border-color: #7C3AED;
  color: #a78bfa;
}

.layout-input {
  flex: 1;
  padding: 4px 8px;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 5px;
  color: #fff;
  font-size: 11px;
  outline: none;
  transition: border-color 0.15s;
  min-width: 0;
}

.layout-input:focus  { border-color: #7C3AED; }
.layout-input::placeholder { color: #374151; }
```

**Step 7: Run all tests**

```bash
npm test 2>&1 | tail -10
```
Expected: 29+ tests pass.

---

## Task 8: Export button + pixel-perfect screenshots

**Files:**
- Modify: `package.json` (add html-to-image)
- Create: `src/app/canvas/[pageId]/components/toolbar/ExportButton.tsx`
- Modify: `src/app/canvas/[pageId]/components/toolbar/Toolbar.tsx`
- Modify: `src/app/globals.css`
- Create: `src/__tests__/ExportButton.test.tsx`

**Step 1: Install html-to-image**

```bash
cd apps/canvas-dashboard && npm install html-to-image
```

**Step 2: Write the failing tests**

Create `src/__tests__/ExportButton.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportButton from '@/app/canvas/[pageId]/components/toolbar/ExportButton';

// Mock html-to-image
vi.mock('html-to-image', () => ({
  toPng:  vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  toJpeg: vi.fn().mockResolvedValue('data:image/jpeg;base64,abc'),
}));

// Mock querySelector for .canvas-frame
beforeEach(() => {
  vi.spyOn(document, 'querySelector').mockReturnValue({
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
  } as any);
});

describe('ExportButton', () => {
  it('renders export button', () => {
    render(<ExportButton />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<ExportButton />);
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('JPG')).toBeInTheDocument();
  });

  it('calls toPng and triggers download on PNG click', async () => {
    const { toPng } = await import('html-to-image');
    render(<ExportButton />);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PNG'));
    await waitFor(() => expect(toPng).toHaveBeenCalled());
  });

  it('calls toJpeg on JPG click', async () => {
    const { toJpeg } = await import('html-to-image');
    render(<ExportButton />);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('JPG'));
    await waitFor(() => expect(toJpeg).toHaveBeenCalled());
  });
});
```

**Step 3: Run tests — expect failures**

```bash
npm test -- src/__tests__/ExportButton.test.tsx 2>&1 | tail -10
```

**Step 4: Create `ExportButton.tsx`**

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';
import { toPng, toJpeg } from 'html-to-image';

type Scale = 1 | 2;

export default function ExportButton() {
  const [open,  setOpen]  = useState(false);
  const [scale, setScale] = useState<Scale>(1);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const download = (dataUrl: string, ext: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `canvas-export.${ext}`;
    a.click();
  };

  const exportAs = async (format: 'png' | 'jpeg') => {
    const frame = document.querySelector('.canvas-frame') as HTMLElement | null;
    if (!frame) return;
    setOpen(false);
    try {
      const opts = { pixelRatio: scale, cacheBust: true };
      const dataUrl = format === 'png'
        ? await toPng(frame, opts)
        : await toJpeg(frame, { ...opts, quality: 0.92 });
      download(dataUrl, format === 'jpeg' ? 'jpg' : 'png');
    } catch (err) {
      console.error('[Export] failed:', err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        className="toolbar-btn"
        onClick={() => setOpen(o => !o)}
        title="Export canvas as image"
      >
        Export ↓
      </button>

      {open && (
        <div className="export-dropdown">
          <div className="export-scale-row">
            <span className="export-scale-label">Scale</span>
            {([1, 2] as Scale[]).map(s => (
              <button
                key={s}
                className={`layout-btn ${scale === s ? 'active' : ''}`}
                onClick={() => setScale(s)}
              >{s}×</button>
            ))}
          </div>
          <button className="export-item" onClick={() => exportAs('png')}>
            PNG — lossless
          </button>
          <button className="export-item" onClick={() => exportAs('jpeg')}>
            JPG — compressed
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Update Toolbar.tsx**

```typescript
import ExportButton from './ExportButton';

// Add ExportButton before PublishButton in the toolbar JSX:
<ExportButton />
<PublishButton pageId={pageId} tenantId={tenantId} />
```

**Step 6: Add export CSS to globals.css**

```css
/* Export dropdown */
.export-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1a1d27;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  padding: 8px;
  min-width: 180px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 200;
}

.export-scale-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2d3a;
}

.export-scale-label {
  font-size: 11px;
  color: #6B7280;
  flex: 1;
}

.export-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: 5px;
  color: #D1D5DB;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.export-item:hover { background: rgba(124,58,237,0.12); color: #fff; }

.toolbar-btn {
  padding: 5px 12px;
  background: #1a1d27;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #D1D5DB;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.toolbar-btn:hover { border-color: #7C3AED; color: #a78bfa; }
```

**Step 7: Run all tests**

```bash
npm test 2>&1 | tail -10
```
Expected: 33+ tests pass.

**Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

---

## Final Verification Checklist

1. `npm test` → all tests pass (33+ total)
2. `npx tsc --noEmit` → zero errors
3. Start dev: `npm run dev --workspace=apps/canvas-dashboard`
4. Open `localhost:3002/canvas/[pageId]`:
   - Shift+click selects multiple nodes (purple outline on each)
   - Drag on empty canvas shows rubber band rectangle
   - Right-click shows context menu with all items
   - Group wraps selected nodes in a new layout container
   - Ungroup lifts children to parent
   - Right panel shows Layout section with Flex/Grid controls
   - Clicking "Flex" + direction → node styles update live
   - Export button shows dropdown → PNG download works
