# Phase 10 UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Figma/Framer-quality DnD node reordering, component library browser, and visual funnel builder to the canvas-dashboard.

**Architecture:** A single `DndContext` wraps `CanvasInner` and handles drags from both the layers tree and canvas nodes. The left panel gains three tabs (Layers / Components / Funnels). Funnel data lives in MySQL (REST API); canvas node order uses the existing STDB `move_node` reducer with fractional string indexing.

**Tech Stack:** Next.js 14, SpacetimeDB v2, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Vitest + React Testing Library (new — not yet in dashboard), vanilla CSS (dark theme).

---

## Context (read before starting any task)

- Working directory: `apps/canvas-dashboard`
- Styling: vanilla CSS only in `src/app/globals.css` — no Tailwind
- STDB reducer calls use **camelCase**: `conn.reducers.moveNode({ nodeId, tenantId, newParentId, newOrder })`
- STDB row fields are **camelCase**: `node.parentId`, `node.nodeType`, `node.order`
- Optional STDB fields use `{ some: value }` shape (opt wrapper): e.g. `componentUrl: { some: url }`
- `CanvasInner` function lives inside `CanvasPage.tsx` (not a separate file)
- DndContext goes **inside CanvasInner** (needs access to `conn`, `flatNodes`, `tenantId`)
- `NEXT_PUBLIC_BACKEND_URL` env var is the backend base URL (e.g. `http://localhost:3001`)

---

## Task 1: Install packages + Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`

**Step 1: Install dnd-kit and testing packages**

```bash
cd apps/canvas-dashboard
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Step 2: Create `vitest.config.ts`**

```typescript
// apps/canvas-dashboard/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 3: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

**Step 4: Add test script to `package.json`**

Add to the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Verify install works**

```bash
npm run test
```
Expected: "No test files found" (not an error — just no tests yet).

---

## Task 2: `resolveDropOrder()` utility + unit tests

**Files:**
- Create: `src/utils/drop-order.ts`
- Create: `src/__tests__/drop-order.test.ts`

**Step 1: Write the failing tests first**

Create `src/__tests__/drop-order.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveDropOrder } from '@/utils/drop-order';

describe('resolveDropOrder', () => {
  it('returns "a0" when list is empty (no before, no after)', () => {
    expect(resolveDropOrder()).toBe('a0');
    expect(resolveDropOrder(undefined, undefined)).toBe('a0');
  });

  it('returns a string BEFORE after when inserting at start (multi-char after)', () => {
    const result = resolveDropOrder(undefined, 'a0');
    expect(result < 'a0').toBe(true);   // must sort before 'a0'
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a string BEFORE after when inserting at start (single-char after)', () => {
    const result = resolveDropOrder(undefined, 'b');
    expect(result < 'b').toBe(true);
  });

  it('returns a string AFTER before when inserting at end', () => {
    const result = resolveDropOrder('z1gqm8xq');
    expect(result > 'z1gqm8xq').toBe(true);
  });

  it('returns a string BETWEEN before and after', () => {
    const result = resolveDropOrder('a0', 'a0z');
    expect(result > 'a0').toBe(true);
    expect(result < 'a0z').toBe(true);
  });

  it('works for a widely-spaced range', () => {
    const result = resolveDropOrder('a0', 'z1gqm8xq');
    expect(result > 'a0').toBe(true);
    expect(result < 'z1gqm8xq').toBe(true);
  });
});
```

**Step 2: Run tests — expect 6 failures**

```bash
npm run test
```
Expected: 6 failures with "Cannot find module '@/utils/drop-order'".

**Step 3: Implement `src/utils/drop-order.ts`**

```typescript
/**
 * Calculate a sort-order string that places an item between `before` and `after`.
 * The canvas uses lexicographic ordering for the `order` column.
 *
 *   resolveDropOrder()               → 'a0'      (empty list)
 *   resolveDropOrder(undefined, 'a0') → 'a'       (before first)
 *   resolveDropOrder('z1abc')         → 'z1abcz'  (after last)
 *   resolveDropOrder('a0', 'a0z')     → 'a05'     (between two)
 */
export function resolveDropOrder(before?: string, after?: string): string {
  if (!before && !after) return 'a0';
  if (!before)           return after!.length > 1 ? after!.slice(0, -1) : 'a';
  if (!after)            return before + 'z';
  return before + '5';
}
```

**Step 4: Run tests — expect all 6 to pass**

```bash
npm run test
```
Expected: 6 passed.

---

## Task 3: 3-Tab LeftPanel + CSS

**Files:**
- Modify: `src/app/canvas/[pageId]/components/panels/LeftPanel.tsx`
- Modify: `src/app/globals.css`

**Step 1: Replace `LeftPanel.tsx` with tabbed version**

```typescript
// src/app/canvas/[pageId]/components/panels/LeftPanel.tsx
'use client';
import { useState } from 'react';
import LayersTree       from './LayersTree';
import ComponentBrowser from './ComponentBrowser';
import FunnelBuilder    from './FunnelBuilder';

interface LeftPanelProps {
  flatNodes:  any[];
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
  conn:       any;
  pageId:     string;
  tenantId:   string;
}

type Tab = 'layers' | 'components' | 'funnels';

export default function LeftPanel({
  flatNodes, selectedId, onSelect, conn, pageId, tenantId,
}: LeftPanelProps) {
  const [tab, setTab] = useState<Tab>('layers');

  return (
    <div className="panel-left">
      {/* Tab strip */}
      <div className="panel-tabs">
        {(['layers', 'components', 'funnels'] as Tab[]).map(t => (
          <button
            key={t}
            className={`panel-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="panel-tab-body">
        {tab === 'layers'     && (
          <LayersTree flatNodes={flatNodes} selectedId={selectedId} onSelect={onSelect} />
        )}
        {tab === 'components' && (
          <ComponentBrowser tenantId={tenantId} pageId={pageId} conn={conn} />
        )}
        {tab === 'funnels'    && (
          <FunnelBuilder
            tenantId={tenantId}
            backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update `CanvasInner` in `CanvasPage.tsx` to pass new props to LeftPanel**

Find this line in `CanvasPage.tsx`:
```tsx
<LeftPanel flatNodes={[...flatNodes]} selectedId={selectedId} onSelect={handleSelect} />
```

Replace with:
```tsx
<LeftPanel
  flatNodes={[...flatNodes]}
  selectedId={selectedId}
  onSelect={handleSelect}
  conn={conn}
  pageId={pageId}
  tenantId={tenantId}
/>
```

**Step 3: Add tab CSS to `globals.css`** (append after existing styles)

```css
/* ============================================================
   Panel tabs (Layers / Components / Funnels)
   ============================================================ */
.panel-tabs {
  display: flex;
  border-bottom: 1px solid #2a2d3a;
  background: #161921;
  flex-shrink: 0;
}

.panel-tab {
  flex: 1;
  padding: 10px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4B5563;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  border-bottom: 2px solid transparent;
}

.panel-tab:hover { color: #9CA3AF; }

.panel-tab.active {
  color: #a78bfa;
  border-bottom-color: #7C3AED;
}

.panel-tab-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}
```

**Step 4: Verify the dashboard compiles (no type errors)**

```bash
npm run build 2>&1 | head -30
```
Expected: build may warn about missing ComponentBrowser / FunnelBuilder — that's OK for now (they're created in next tasks). If TypeScript errors about LeftPanel props, fix them.

---

## Task 4: DndContext + LayersTree drag-and-drop

**Files:**
- Modify: `src/app/canvas/[pageId]/components/CanvasPage.tsx`
- Modify: `src/app/canvas/[pageId]/components/panels/LayersTree.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add DndContext to `CanvasInner` in `CanvasPage.tsx`**

Add imports at the top of `CanvasPage.tsx`:
```typescript
import {
  DndContext, DragOverlay, closestCenter,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { resolveDropOrder } from '@/utils/drop-order';
```

Inside `CanvasInner`, add state and handlers **after** the existing `useState` calls:
```typescript
const [draggingId, setDraggingId] = useState<string | null>(null);

const handleDragStart = useCallback((event: DragStartEvent) => {
  setDraggingId(event.active.id as string);
}, []);

const handleDragEnd = useCallback((event: DragEndEvent) => {
  setDraggingId(null);
  const { active, over } = event;
  if (!over || active.id === over.id || !conn) return;

  const activeNode = flatNodes.find(n => n.id === active.id);
  const overNode   = flatNodes.find(n => n.id === over.id);
  if (!activeNode || !overNode) return;

  // Drop ONTO a layout node → reparent as last child
  if (overNode.nodeType === 'layout' && over.id !== activeNode.parentId) {
    const children = flatNodes
      .filter(n => n.parentId === over.id)
      .sort((a, b) => a.order.localeCompare(b.order));
    const newOrder = resolveDropOrder(children[children.length - 1]?.order, undefined);
    conn.reducers.moveNode({ nodeId: active.id as string, tenantId, newParentId: over.id as string, newOrder });
    return;
  }

  // Drop ADJACENT to a sibling → reorder (same parent)
  const newParentId = overNode.parentId ?? null;
  const siblings = flatNodes
    .filter(n => n.parentId === newParentId && n.id !== active.id)
    .sort((a, b) => a.order.localeCompare(b.order));
  const overIndex  = siblings.findIndex(n => n.id === over.id);
  const newOrder   = resolveDropOrder(siblings[overIndex - 1]?.order, siblings[overIndex]?.order);

  conn.reducers.moveNode({
    nodeId:      active.id as string,
    tenantId,
    newParentId: newParentId ?? 'root',
    newOrder,
  });
}, [conn, flatNodes, tenantId]);
```

Wrap the `return (...)` JSX in `CanvasInner` with DndContext. The outer `<div className="canvas-layout">` stays, but wrap its children or the whole return:

```tsx
return (
  <DndContext
    collisionDetection={closestCenter}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
  >
    <div className="canvas-layout">
      <Toolbar ... />
      <div className="canvas-body">
        <LeftPanel ... />
        <div className="canvas-area" onMouseMove={handleMouseMove}>
          ...
          <Canvas ... draggingId={draggingId} />
          ...
        </div>
        <RightPanel ... />
      </div>
    </div>
    {/* Drag preview overlay */}
    <DragOverlay>
      {draggingId ? (
        <div className="drag-overlay-preview">
          {flatNodes.find(n => n.id === draggingId)?.nodeType ?? 'node'}
        </div>
      ) : null}
    </DragOverlay>
  </DndContext>
);
```

**Step 2: Replace `LayersTree.tsx` with draggable version**

```typescript
// src/app/canvas/[pageId]/components/panels/LayersTree.tsx
'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface LayersTreeProps {
  flatNodes:  any[];
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
}

const NODE_ICONS: Record<string, string> = {
  layout: '⬜', element: '◻️', component: '🧩', slot: '⬡',
};

export default function LayersTree({ flatNodes, selectedId, onSelect }: LayersTreeProps) {
  if (!flatNodes.length) {
    return <p style={{ fontSize: 11, color: '#4B5563' }}>No nodes</p>;
  }

  const roots      = flatNodes.filter(n => !n.parentId);
  const childrenOf = (id: string) => flatNodes
    .filter(n => n.parentId === id)
    .sort((a, b) => a.order.localeCompare(b.order));

  function renderNode(node: any, depth: number): React.ReactNode {
    const props    = node.props ? JSON.parse(node.props) : {};
    const label    = props.content?.slice(0, 20) ?? props.tag ?? node.nodeType;
    const icon     = NODE_ICONS[node.nodeType] ?? '•';
    const children = childrenOf(node.id);

    return (
      <div key={node.id}>
        <LayersItem
          node={node}
          depth={depth}
          label={label}
          icon={icon}
          isSelected={node.id === selectedId}
          onSelect={onSelect}
        />
        {children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {roots.map(node => renderNode(node, 0))}
    </div>
  );
}

function LayersItem({ node, depth, label, icon, isSelected, onSelect }: {
  node: any; depth: number; label: string; icon: string;
  isSelected: boolean; onSelect: (id: string | null) => void;
}) {
  // Draggable — the entire item can be dragged (locked nodes excluded)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy,
    data: { type: node.nodeType },
  });

  // Droppable — other items can be dropped onto this one
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: { type: node.nodeType },
  });

  // Merge refs
  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      style={{ marginLeft: depth * 12 }}
      className={[
        'layers-item',
        isSelected ? 'selected' : '',
        isDragging ? 'dragging' : '',
        isOver     ? 'drop-over' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(isSelected ? null : node.id)}
    >
      {/* Drag handle */}
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        title="Drag to reorder"
      >
        ⠿
      </span>
      <span>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {node.lockedBy && <span style={{ fontSize: 10, color: '#F59E0B' }}>🔒</span>}
    </div>
  );
}
```

**Step 3: Add DnD CSS to `globals.css`**

```css
/* ============================================================
   Drag and Drop
   ============================================================ */
.drag-handle {
  font-size: 12px;
  color: #374151;
  cursor: grab;
  padding: 0 4px 0 0;
  opacity: 0;
  transition: opacity 0.1s;
  flex-shrink: 0;
  user-select: none;
}

.layers-item:hover .drag-handle { opacity: 1; }
.drag-handle:active { cursor: grabbing; }

.layers-item.dragging {
  opacity: 0.4;
  background: #1a1d27;
}

.layers-item.drop-over {
  background: rgba(124, 58, 237, 0.15);
  outline: 1px dashed #7C3AED;
  outline-offset: -1px;
}

.drag-overlay-preview {
  background: #2a2d3a;
  border: 1px solid #7C3AED;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #a78bfa;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
```

**Step 4: Verify no TypeScript errors**

```bash
npm run build 2>&1 | grep -E 'error|Error' | head -20
```

---

## Task 5: CanvasNode drag handle + drop zones

**Files:**
- Modify: `src/app/canvas/[pageId]/components/CanvasNode.tsx`
- Modify: `src/app/canvas/[pageId]/components/Canvas.tsx`
- Modify: `src/app/globals.css`

**Step 1: Add drag handle to `CanvasNode.tsx`**

Replace the entire file:

```typescript
// src/app/canvas/[pageId]/components/CanvasNode.tsx
'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface CanvasNodeProps {
  node: any;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

export default function CanvasNode({ node, selectedId, onSelect, depth }: CanvasNodeProps) {
  if (!node) return null;

  const isSelected = node.id === selectedId;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy,
    data: { type: node.nodeType },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: { type: node.nodeType },
  });

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const wrapperStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    outline: isSelected ? '2px solid #7C3AED' : isOver ? '2px dashed #7C3AED' : undefined,
    outlineOffset: '2px',
    position: 'relative',
    cursor: 'pointer',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  // Drag handle — shown on hover via CSS
  const DragHandle = (
    <span
      className="canvas-drag-handle"
      {...attributes}
      {...listeners}
      onClick={e => e.stopPropagation()}
      title="Drag to reorder"
    >
      ⠿
    </span>
  );

  switch (node.type) {
    case 'layout':
      return (
        <div
          ref={setRef as any}
          style={{ ...node.styles, ...wrapperStyle }}
          className="canvas-node-layout"
          data-node-id={node.id}
          onClick={handleClick}
        >
          {DragHandle}
          {node.children?.map((child: any) => (
            <CanvasNode
              key={child.id} node={child}
              selectedId={selectedId} onSelect={onSelect} depth={depth + 1}
            />
          ))}
        </div>
      );

    case 'element':
      return (
        <div ref={setRef as any} style={wrapperStyle} data-node-id={node.id}>
          {DragHandle}
          <RenderElement node={node} styles={node.styles} onClick={handleClick} />
        </div>
      );

    case 'component':
      return (
        <div
          ref={setRef as any}
          style={{ ...wrapperStyle, minHeight: 40, background: '#f3f4f6', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
          data-node-id={node.id}
          onClick={handleClick}
        >
          {DragHandle}
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            📦 {node.componentId ?? 'Component'}
          </span>
        </div>
      );

    default:
      return null;
  }
}

function RenderElement({ node, styles, onClick }: any) {
  const props    = node.props ?? {};
  const baseProps = { style: styles, 'data-node-id': node.id, onClick };

  switch (props.tag) {
    case 'text':    return <p {...baseProps}>{props.content ?? 'Text'}</p>;
    case 'heading': {
      const Tag = `h${props.level ?? 2}` as 'h1' | 'h2' | 'h3';
      return <Tag {...baseProps}>{props.content ?? 'Heading'}</Tag>;
    }
    case 'image':
      return props.src
        ? <img src={props.src} alt={props.alt ?? ''} style={styles} data-node-id={node.id} onClick={onClick} />
        : <div {...baseProps} style={{ ...styles, background: '#e5e7eb', minHeight: 100, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
            🖼 Image
          </div>;
    case 'button':  return <button {...baseProps}>{props.label ?? 'Button'}</button>;
    case 'divider': return <hr style={styles} data-node-id={node.id} onClick={onClick} />;
    default:        return <div {...baseProps}>{props.content ?? ''}</div>;
  }
}
```

**Step 2: Add canvas drag-handle CSS to `globals.css`**

```css
/* Canvas node drag handle */
.canvas-node-layout {
  position: relative;
}

.canvas-drag-handle {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 11px;
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.1);
  border-radius: 3px;
  padding: 1px 3px;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
  user-select: none;
  line-height: 1;
}

[data-node-id]:hover > .canvas-drag-handle,
.canvas-node-layout:hover > .canvas-drag-handle { opacity: 1; }

.canvas-drag-handle:active { cursor: grabbing; }
```

---

## Task 6: ComponentBrowser component + tests

**Files:**
- Create: `src/app/canvas/[pageId]/components/panels/ComponentBrowser.tsx`
- Create: `src/__tests__/ComponentBrowser.test.tsx`

**Step 1: Write failing tests first**

Create `src/__tests__/ComponentBrowser.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ComponentBrowser from '@/app/canvas/[pageId]/components/panels/ComponentBrowser';

// Mock DndContext provider (dnd-kit requires it)
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core') as any;
  return {
    ...actual,
    useDraggable: () => ({
      attributes: {}, listeners: {}, setNodeRef: vi.fn(), isDragging: false,
    }),
  };
});

const mockComponents = [
  { id: 'c1', name: 'Hero Banner',  currentVersion: '1.0.0', currentUrl: 'https://cdn.r2.dev/c1/1.0.0.js', isPublic: false, tenantId: 'tenant-a' },
  { id: 'c2', name: 'Hero Card',    currentVersion: '2.0.0', currentUrl: 'https://cdn.r2.dev/c2/2.0.0.js', isPublic: false, tenantId: 'tenant-a' },
  { id: 'c3', name: 'Global Footer', currentVersion: '1.1.0', currentUrl: 'https://cdn.r2.dev/c3/1.1.0.js', isPublic: true,  tenantId: null },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockComponents),
  }));
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:3001');
});

describe('ComponentBrowser', () => {
  const defaultProps = { tenantId: 'tenant-a', pageId: 'page-1', conn: null };

  it('fetches components on mount with correct tenant header', async () => {
    render(<ComponentBrowser {...defaultProps} />);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'http://localhost:3001/api/components',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-tenant-id': 'tenant-a' }),
        }),
      );
    });
  });

  it('shows tenant components under "My Components" group', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    expect(screen.getByText('My Components')).toBeInTheDocument();
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.getByText('Hero Card')).toBeInTheDocument();
  });

  it('shows public components under "Public Library" group', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Global Footer'));

    expect(screen.getByText('Public Library')).toBeInTheDocument();
    expect(screen.getByText('Global Footer')).toBeInTheDocument();
  });

  it('filters components by search query (client-side)', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.change(screen.getByPlaceholderText('Search components...'), {
      target: { value: 'Hero' },
    });

    // Hero Banner and Hero Card should be visible
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.getByText('Hero Card')).toBeInTheDocument();
    // Global Footer should be hidden
    expect(screen.queryByText('Global Footer')).not.toBeInTheDocument();
  });

  it('calls conn.reducers.insertNode on click with component data', async () => {
    const mockConn = { reducers: { insertNode: vi.fn() } };
    render(<ComponentBrowser tenantId="tenant-a" pageId="page-1" conn={mockConn} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.click(screen.getByText('Hero Banner').closest('.component-card')!);

    expect(mockConn.reducers.insertNode).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId:     'tenant-a',
        pageId:       'page-1',
        nodeType:     'component',
        componentUrl: { some: 'https://cdn.r2.dev/c1/1.0.0.js' },
      }),
    );
  });

  it('shows empty state when no components match search', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.change(screen.getByPlaceholderText('Search components...'), {
      target: { value: 'xyznotfound' },
    });

    expect(screen.getByText('No components found')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm run test src/__tests__/ComponentBrowser.test.tsx
```
Expected: Failures because `ComponentBrowser.tsx` doesn't exist yet.

**Step 3: Create `ComponentBrowser.tsx`**

```typescript
// src/app/canvas/[pageId]/components/panels/ComponentBrowser.tsx
'use client';
import { useState, useEffect } from 'react';
import { useDraggable }        from '@dnd-kit/core';

interface Component {
  id:             string;
  name:           string;
  currentVersion: string;
  currentUrl:     string;
  isPublic:       boolean;
  tenantId:       string | null;
}

interface ComponentBrowserProps {
  tenantId:   string;
  pageId:     string;
  conn:       any;
}

export default function ComponentBrowser({ tenantId, pageId, conn }: ComponentBrowserProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  useEffect(() => {
    setLoading(true);
    fetch(`${backendUrl}/api/components`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then(data => setComponents(Array.isArray(data) ? data : []))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [tenantId, backendUrl]);

  const filtered = components.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const mine    = filtered.filter(c => c.tenantId === tenantId);
  const library = filtered.filter(c => c.isPublic && c.tenantId === null);

  const inject = (comp: Component) => {
    if (!conn) return;
    conn.reducers.insertNode({
      id:               crypto.randomUUID(),
      pageId,
      tenantId,
      parentId:         null,
      nodeType:         'component',
      order:            'z' + Date.now().toString(36),
      styles:           null,
      props:            null,
      settings:         null,
      componentUrl:     { some: comp.currentUrl },
      componentVersion: { some: comp.currentVersion },
      componentId:      comp.id,
    });
  };

  return (
    <div className="component-browser">
      <div className="component-search">
        <input
          type="text"
          placeholder="Search components..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="component-search-input"
        />
      </div>

      {loading && <p className="browser-loading">Loading...</p>}

      {mine.length > 0 && (
        <div className="component-group">
          <div className="component-group-label">My Components</div>
          <div className="component-grid">
            {mine.map(comp => (
              <ComponentCard key={comp.id} comp={comp} onInject={inject} />
            ))}
          </div>
        </div>
      )}

      {library.length > 0 && (
        <div className="component-group">
          <div className="component-group-label">Public Library</div>
          <div className="component-grid">
            {library.map(comp => (
              <ComponentCard key={comp.id} comp={comp} onInject={inject} />
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="browser-empty">No components found</p>
      )}
    </div>
  );
}

function ComponentCard({
  comp, onInject,
}: { comp: Component; onInject: (c: Component) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `component-${comp.id}`,
    data: { type: 'component', component: comp },
  });

  return (
    <div
      ref={setNodeRef}
      className={`component-card ${isDragging ? 'dragging' : ''}`}
      onClick={() => onInject(comp)}
      {...listeners}
      {...attributes}
      title={`${comp.name} v${comp.currentVersion}`}
    >
      <span className="component-card-icon">🧩</span>
      <span className="component-card-name">{comp.name}</span>
      <span className="component-card-version">v{comp.currentVersion}</span>
    </div>
  );
}
```

**Step 4: Run tests — expect all 5 to pass**

```bash
npm run test src/__tests__/ComponentBrowser.test.tsx
```
Expected: 5 passed.

**Step 5: Add ComponentBrowser CSS to `globals.css`**

```css
/* ============================================================
   Component Browser
   ============================================================ */
.component-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.component-search-input {
  width: 100%;
  padding: 7px 10px;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.component-search-input:focus { border-color: #7C3AED; }
.component-search-input::placeholder { color: #4B5563; }

.component-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #4B5563;
  margin-bottom: 6px;
}

.component-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.component-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
  user-select: none;
}

.component-card:hover {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.07);
}

.component-card.dragging { opacity: 0.5; }

.component-card-icon   { font-size: 20px; }
.component-card-name   { font-size: 11px; color: #D1D5DB; font-weight: 500; line-height: 1.3; }
.component-card-version { font-size: 9px; color: #4B5563; }

.browser-loading { font-size: 11px; color: #4B5563; text-align: center; padding: 12px 0; }
.browser-empty   { font-size: 12px; color: #4B5563; text-align: center; padding: 20px 0; }
```

---

## Task 7: FunnelBuilder — list + create + tests

**Files:**
- Create: `src/app/canvas/[pageId]/components/panels/FunnelStepConfig.tsx`
- Create: `src/app/canvas/[pageId]/components/panels/FunnelBuilder.tsx`
- Create: `src/__tests__/FunnelBuilder.test.tsx`

**Step 1: Write failing tests first**

Create `src/__tests__/FunnelBuilder.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FunnelBuilder from '@/app/canvas/[pageId]/components/panels/FunnelBuilder';

const mockFunnels = [
  {
    id: 'f1', name: 'Checkout Funnel', goal: 'conversion', status: 'running',
    steps: [
      { id: 's1', pageId: 'p1', stepOrder: 0, stepType: 'landing',  name: 'Home',    onSuccess: '{"action":"next"}' },
      { id: 's2', pageId: 'p2', stepOrder: 1, stepType: 'checkout', name: 'Product', onSuccess: '{"action":"next"}' },
    ],
  },
  {
    id: 'f2', name: 'Lead Gen', goal: 'lead', status: 'paused', steps: [],
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockFunnels),
  }));
});

const defaultProps = {
  tenantId:   'tenant-a',
  backendUrl: 'http://localhost:3001',
};

describe('FunnelBuilder', () => {
  it('fetches funnels on mount', async () => {
    render(<FunnelBuilder {...defaultProps} />);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'http://localhost:3001/api/funnels',
        expect.objectContaining({ headers: expect.objectContaining({ 'x-tenant-id': 'tenant-a' }) }),
      );
    });
  });

  it('renders all funnels with name and status', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    expect(screen.getByText('Checkout Funnel')).toBeInTheDocument();
    expect(screen.getByText('Lead Gen')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('expands funnel to show steps on click', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    // Steps not visible before click
    expect(screen.queryByText('Home')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Checkout Funnel'));

    // Steps visible after expand
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('creates a new funnel via POST and adds to list', async () => {
    const newFunnel = { id: 'f3', name: 'New Funnel', goal: 'conversion', status: 'draft', steps: [] };
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFunnels) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(newFunnel) } as any);

    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    fireEvent.click(screen.getByText('+ New Funnel'));
    fireEvent.change(screen.getByPlaceholderText('Funnel name...'), {
      target: { value: 'New Funnel' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(screen.getByText('New Funnel')).toBeInTheDocument());

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:3001/api/funnels',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New Funnel'),
      }),
    );
  });

  it('shows "+ Add step" button when funnel is expanded', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    fireEvent.click(screen.getByText('Checkout Funnel'));

    expect(screen.getByText('+ Add step')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests — expect failures**

```bash
npm run test src/__tests__/FunnelBuilder.test.tsx
```
Expected: failures because `FunnelBuilder.tsx` doesn't exist.

**Step 3: Create `FunnelStepConfig.tsx`**

```typescript
// src/app/canvas/[pageId]/components/panels/FunnelStepConfig.tsx
'use client';
import { useState } from 'react';

interface FunnelStep {
  id?:        string;
  pageId:     string;
  stepOrder:  number;
  stepType:   string;
  name:       string;
  onSuccess:  string;
}

interface FunnelStepConfigProps {
  funnelId:   string;
  step:       FunnelStep | null;
  tenantId:   string;
  backendUrl: string;
  onClose:    () => void;
  onSave:     (step: FunnelStep) => void;
}

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'];

export default function FunnelStepConfig({
  step, onClose, onSave,
}: FunnelStepConfigProps) {
  const [name,      setName]      = useState(step?.name ?? '');
  const [pageId,    setPageId]    = useState(step?.pageId ?? '');
  const [stepType,  setStepType]  = useState(step?.stepType ?? 'landing');
  const [onSuccess, setOnSuccess] = useState(
    step?.onSuccess ? JSON.parse(step.onSuccess).action ?? 'next' : 'next'
  );

  if (!step) return null;

  const save = () => {
    onSave({
      ...step,
      name,
      pageId,
      stepType,
      onSuccess: JSON.stringify({ action: onSuccess }),
    });
  };

  return (
    <div className="funnel-step-config-overlay">
      <div className="funnel-step-config">
        <div className="step-config-header">
          <h4>Configure Step</h4>
          <button className="step-config-close" onClick={onClose}>✕</button>
        </div>

        <div className="step-config-field">
          <label>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="step-config-input"
          />
        </div>

        <div className="step-config-field">
          <label>Page ID</label>
          <input
            value={pageId}
            onChange={e => setPageId(e.target.value)}
            placeholder="Enter page ID..."
            className="step-config-input"
          />
        </div>

        <div className="step-config-field">
          <label>Step Type</label>
          <select
            value={stepType}
            onChange={e => setStepType(e.target.value)}
            className="step-config-select"
          >
            {STEP_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="step-config-field">
          <label>On Success</label>
          <select
            value={onSuccess}
            onChange={e => setOnSuccess(e.target.value)}
            className="step-config-select"
          >
            <option value="next">Next step</option>
            <option value="skip">Skip to end</option>
            <option value="external">External URL</option>
          </select>
        </div>

        <div className="step-config-actions">
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create `FunnelBuilder.tsx`**

```typescript
// src/app/canvas/[pageId]/components/panels/FunnelBuilder.tsx
'use client';
import { useState, useEffect } from 'react';
import FunnelStepConfig from './FunnelStepConfig';

interface FunnelStep {
  id?:        string;
  pageId:     string;
  stepOrder:  number;
  stepType:   string;
  name:       string;
  onSuccess:  string;
}

interface Funnel {
  id:     string;
  name:   string;
  goal:   string;
  status: string;
  steps:  FunnelStep[];
}

interface FunnelBuilderProps {
  tenantId:   string;
  backendUrl: string;
}

const STEP_ICONS: Record<string, string> = {
  landing: '🏠', checkout: '💳', upsell: '⬆️', downsell: '⬇️', thankyou: '✅',
};

export default function FunnelBuilder({ tenantId, backendUrl }: FunnelBuilderProps) {
  const [funnels,      setFunnels]     = useState<Funnel[]>([]);
  const [expanded,     setExpanded]    = useState<string | null>(null);
  const [creating,     setCreating]    = useState(false);
  const [newName,      setNewName]     = useState('');
  const [editingStep,  setEditingStep] = useState<{ funnelId: string; step: FunnelStep } | null>(null);

  const jsonHeaders = { 'Content-Type': 'application/json', 'x-tenant-id': tenantId };

  useEffect(() => {
    fetch(`${backendUrl}/api/funnels`, { headers: { 'x-tenant-id': tenantId } })
      .then(r => r.json())
      .then(data => setFunnels(Array.isArray(data) ? data : []))
      .catch(() => setFunnels([]));
  }, [tenantId, backendUrl]);

  const createFunnel = async () => {
    if (!newName.trim()) return;
    const res = await fetch(`${backendUrl}/api/funnels`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: newName.trim(), goal: 'conversion' }),
    });
    if (res.ok) {
      const f = await res.json();
      setFunnels(prev => [...prev, f]);
      setExpanded(f.id);
      setCreating(false);
      setNewName('');
    }
  };

  const addStep = async (funnelId: string) => {
    const funnel = funnels.find(f => f.id === funnelId);
    if (!funnel) return;
    const steps = [...funnel.steps, {
      pageId: '', stepType: 'landing',
      name: `Step ${funnel.steps.length + 1}`,
      stepOrder: funnel.steps.length,
      onSuccess: JSON.stringify({ action: 'next' }),
    }];
    const res = await fetch(`${backendUrl}/api/funnels/${funnelId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ steps }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFunnels(prev => prev.map(f => f.id === funnelId ? updated : f));
    }
  };

  const saveStep = async (funnelId: string, updatedStep: FunnelStep) => {
    const funnel = funnels.find(f => f.id === funnelId);
    if (!funnel) return;
    const steps = funnel.steps.map(s =>
      s.id === updatedStep.id ? updatedStep : s
    );
    const res = await fetch(`${backendUrl}/api/funnels/${funnelId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ steps }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFunnels(prev => prev.map(f => f.id === funnelId ? updated : f));
    }
    setEditingStep(null);
  };

  return (
    <div className="funnel-builder">
      {funnels.map(funnel => (
        <div key={funnel.id} className="funnel-item">
          {/* Funnel header — click to expand */}
          <div
            className="funnel-header"
            onClick={() => setExpanded(expanded === funnel.id ? null : funnel.id)}
          >
            <span className="funnel-chevron">
              {expanded === funnel.id ? '▼' : '▶'}
            </span>
            <span className="funnel-name">{funnel.name}</span>
            <span className={`funnel-status status-${funnel.status}`}>
              {funnel.status}
            </span>
          </div>

          {/* Expanded: visual step flow */}
          {expanded === funnel.id && (
            <div className="funnel-flow">
              {funnel.steps
                .slice()
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step, i) => (
                  <div key={step.id ?? i} className="funnel-step-wrapper">
                    <div
                      className="funnel-step-card"
                      onClick={() => setEditingStep({ funnelId: funnel.id, step })}
                    >
                      <span className="step-icon">
                        {STEP_ICONS[step.stepType] ?? '📄'}
                      </span>
                      <div className="step-info">
                        <span className="step-name">{step.name}</span>
                        <span className="step-type">{step.stepType}</span>
                      </div>
                    </div>
                    {i < funnel.steps.length - 1 && (
                      <div className="funnel-step-connector">
                        <div className="funnel-step-line" />
                        <span className="funnel-step-arrow">↓</span>
                      </div>
                    )}
                  </div>
                ))}

              <button
                className="funnel-add-step"
                onClick={() => addStep(funnel.id)}
              >
                + Add step
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Create new funnel */}
      {creating ? (
        <div className="funnel-create">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFunnel()}
            placeholder="Funnel name..."
            className="funnel-name-input"
          />
          <div className="funnel-create-actions">
            <button onClick={createFunnel} className="btn btn-primary">Create</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <button className="funnel-new-btn" onClick={() => setCreating(true)}>
          + New Funnel
        </button>
      )}

      {/* Step config flyout */}
      {editingStep && (
        <FunnelStepConfig
          funnelId={editingStep.funnelId}
          step={editingStep.step}
          tenantId={tenantId}
          backendUrl={backendUrl}
          onClose={() => setEditingStep(null)}
          onSave={step => saveStep(editingStep.funnelId, step)}
        />
      )}
    </div>
  );
}
```

**Step 5: Run tests — expect all 5 to pass**

```bash
npm run test src/__tests__/FunnelBuilder.test.tsx
```
Expected: 5 passed.

---

## Task 8: CSS polish — funnel styles + final cleanup

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Append all funnel CSS to `globals.css`**

```css
/* ============================================================
   Funnel Builder
   ============================================================ */
.funnel-builder {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.funnel-item {
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  overflow: hidden;
}

.funnel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.funnel-header:hover { background: rgba(255,255,255,0.03); }

.funnel-chevron { font-size: 9px; color: #6B7280; flex-shrink: 0; }

.funnel-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: #D1D5DB;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.funnel-status {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.status-running  { background: rgba(16,185,129,0.15); color: #10B981; }
.status-paused   { background: rgba(245,158,11,0.15);  color: #F59E0B; }
.status-draft    { background: rgba(107,114,128,0.15); color: #6B7280; }
.status-stopped  { background: rgba(239,68,68,0.15);   color: #EF4444; }

/* Funnel visual flow */
.funnel-flow {
  padding: 8px 12px 12px;
  border-top: 1px solid #2a2d3a;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}

.funnel-step-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.funnel-step-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #161921;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.funnel-step-card:hover {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.07);
}

.step-icon { font-size: 18px; flex-shrink: 0; }

.step-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.step-name {
  font-size: 12px;
  font-weight: 500;
  color: #D1D5DB;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-type {
  font-size: 10px;
  color: #6B7280;
  text-transform: capitalize;
}

/* Arrow connector between steps */
.funnel-step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0;
}

.funnel-step-line {
  width: 2px;
  height: 8px;
  background: #2a2d3a;
}

.funnel-step-arrow {
  font-size: 12px;
  color: #7C3AED;
  line-height: 1;
}

/* Add step + new funnel buttons */
.funnel-add-step {
  margin-top: 10px;
  width: 100%;
  padding: 7px;
  background: none;
  border: 1px dashed #374151;
  border-radius: 6px;
  color: #6B7280;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.funnel-add-step:hover { border-color: #7C3AED; color: #a78bfa; }

.funnel-new-btn {
  width: 100%;
  padding: 9px;
  background: none;
  border: 1px dashed #374151;
  border-radius: 8px;
  color: #6B7280;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  text-align: center;
}

.funnel-new-btn:hover { border-color: #7C3AED; color: #a78bfa; }

.funnel-create {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #0f1117;
  border: 1px solid #7C3AED;
  border-radius: 8px;
}

.funnel-name-input {
  width: 100%;
  padding: 7px 10px;
  background: #161921;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  outline: none;
}

.funnel-name-input:focus { border-color: #7C3AED; }

.funnel-create-actions {
  display: flex;
  gap: 6px;
}

/* Step config flyout */
.funnel-step-config-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.funnel-step-config {
  background: #161921;
  border: 1px solid #2a2d3a;
  border-radius: 12px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

.step-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.step-config-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.step-config-close {
  background: none;
  border: none;
  color: #6B7280;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}

.step-config-close:hover { color: #fff; }

.step-config-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.step-config-field label {
  font-size: 11px;
  font-weight: 500;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.step-config-input,
.step-config-select {
  padding: 7px 10px;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}

.step-config-input:focus,
.step-config-select:focus { border-color: #7C3AED; }

.step-config-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
```

**Step 2: Run the full dashboard test suite**

```bash
npm run test
```
Expected: All tests pass (drop-order: 6, ComponentBrowser: 5, FunnelBuilder: 5 = 16 total).

**Step 3: Check build compiles cleanly**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build succeeds (or only pre-existing warnings).

---

## Final verification checklist

1. `npm run test` in `apps/canvas-dashboard` → 16 tests pass
2. `npm run build` → no new errors
3. Start dev server (`npm run dev --workspace=apps/canvas-dashboard`), open `localhost:3002/canvas/[pageId]`:
   - Left panel shows 3 tabs: Layers / Components / Funnels
   - Layers tab: ⠿ drag handles visible on hover, nodes draggable
   - Components tab: loads from `/api/components`, shows grid, click injects component
   - Funnels tab: loads from `/api/funnels`, expand to see flow, create new funnel works
   - DragOverlay shows purple preview while dragging
