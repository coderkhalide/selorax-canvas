'use client';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { DbConnection, tables }           from '@/module_bindings';
import { SpacetimeDBProvider, useTable, useSpacetimeDB } from 'spacetimedb/react';
import { buildTree }                      from '@/utils/tree';
import { computeGroupParent }             from '@/utils/selection';
import Canvas       from './Canvas';
import LeftPanel    from './panels/LeftPanel';
import RightPanel   from './panels/RightPanel';
import Toolbar      from './toolbar/Toolbar';
import AIBar        from './ai/AIBar';
import AIStatusBar  from './ai/AIStatusBar';
import ContextMenu, { type ContextMenuAction } from './ContextMenu';
import {
  DndContext, DragOverlay, closestCenter,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { resolveDropOrder } from '@/utils/drop-order';
import { copyNodes, pasteNodes, duplicateNodes } from '@/utils/clipboard';
import { CanvasContextProvider, useCanvas } from '@/context/CanvasContext';

// ── CanvasUI — all UI logic, receives conn + cursors + aiOps as props ──────────
function CanvasUI({
  pageId, tenantId, tenantName, cursors, aiOps, conn,
}: {
  pageId: string;
  tenantId: string;
  tenantName: string;
  cursors: any[];
  aiOps: any[];
  conn: DbConnection;
}) {
  const { flatNodes, selectedIds, selectNode, multiSelectNodes, selectedNode, draggingId, setDraggingId } = useCanvas();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    fetch(`${backend}/api/pages/${pageId}`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then((data: { publishedVersionId?: string | null }) => {
        setIsPublished(!!data.publishedVersionId);
      })
      .catch(() => {});
  }, [pageId, tenantId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  }, [setDraggingId]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeNode = flatNodes.find(n => n.id === active.id);
    const overNode   = flatNodes.find(n => n.id === over.id);
    if (!activeNode || !overNode) return;

    // Guard: check overNode is not a descendant of activeNode
    const isDescendant = (nodeId: string, ancestorId: string): boolean => {
      let current = flatNodes.find(n => n.id === nodeId);
      while (current?.parentId) {
        if (current.parentId === ancestorId) return true;
        current = flatNodes.find(n => n.id === current!.parentId);
      }
      return false;
    };

    // Drop ONTO a layout node → reparent as last child
    if (overNode.nodeType === 'layout' && over.id !== activeNode.parentId && !isDescendant(over.id as string, active.id as string)) {
      const children = flatNodes
        .filter(n => n.parentId === over.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      const newOrder = resolveDropOrder(children[children.length - 1]?.order, undefined);
      conn.reducers.moveNode({ nodeId: active.id as string, newParentId: over.id as string, newOrder });
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
      newParentId: newParentId ?? 'root',
      newOrder,
    });
  }, [conn, flatNodes, setDraggingId]);

  const lastSelectedId = [...selectedIds].at(-1) ?? null;
  const tree           = flatNodes.length > 0 ? buildTree([...flatNodes]) : null;
  const activeAiOp     = aiOps.find(op => op.status !== 'done' && op.status !== 'error');

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    conn.reducers.moveCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      selectedNodeId: lastSelectedId ?? undefined,
      hoveredNodeId: undefined,
    });
  }, [conn, lastSelectedId]);

  const handleContextMenu = useCallback((x: number, y: number, targetId: string | null) => {
    if (targetId && !selectedIds.has(targetId)) {
      // Unlock all currently selected nodes
      selectedIds.forEach(sid => conn?.reducers.unlockNode({ nodeId: sid }));
      // Lock the right-clicked node
      conn?.reducers.lockNode({ nodeId: targetId });
      selectNode(targetId);
    }
    setContextMenu({ x, y, targetId });
  }, [conn, selectedIds, selectNode]);

  const buildContextMenuActions = useCallback((_targetId: string | null): ContextMenuAction[] => {
    const count     = selectedIds.size;
    const selArray  = [...selectedIds];
    const selSet    = new Set(selArray);
    const selNodes  = flatNodes.filter(n => selectedIds.has(n.id));
    const isLayout  = selNodes.length === 1 && selNodes[0]?.nodeType === 'layout';

    const groupAction: ContextMenuAction = {
      label: 'Group Selection',
      icon: '⬜',
      disabled: count < 2,
      onClick: () => {
        const parentId = computeGroupParent(selArray, [...flatNodes]);
        const parentChildren = flatNodes
          .filter(n => n.parentId === parentId)
          .sort((a, b) => a.order.localeCompare(b.order));
        const firstSelectedInParent = parentChildren.find(n => selectedIds.has(n.id));
        const prevSiblingIndex = firstSelectedInParent
          ? parentChildren.findIndex(n => n.id === firstSelectedInParent.id) - 1
          : -1;
        const prevSiblingOrder = prevSiblingIndex >= 0 ? parentChildren[prevSiblingIndex]?.order : undefined;
        const groupOrder = resolveDropOrder(prevSiblingOrder, firstSelectedInParent?.order);
        const groupId = crypto.randomUUID();
        conn.reducers.insertNode({
          id: groupId,
          pageId,
          tenantId,
          parentId: parentId ?? undefined,
          nodeType: 'layout',
          order: groupOrder,
          styles: JSON.stringify({ display: 'flex', flexDirection: 'column', gap: '8px' }),
          props: '{}',
          settings: '{}',
          childrenIds: '[]',
          componentUrl: undefined,
          componentVersion: undefined,
          componentId: undefined,
        });
        const selByDocOrder = [...selArray].sort((a, b) => {
          const na = flatNodes.find(n => n.id === a);
          const nb = flatNodes.find(n => n.id === b);
          return (na?.order ?? '').localeCompare(nb?.order ?? '');
        });
        let prevGroupOrder: string | undefined = undefined;
        selByDocOrder.forEach((id) => {
          const order = resolveDropOrder(prevGroupOrder, undefined);
          prevGroupOrder = order;
          conn.reducers.moveNode({
            nodeId: id,
            newParentId: groupId,
            newOrder: order,
          });
        });
        // Unlock previously selected nodes, lock new group
        selArray.forEach(id => conn.reducers.unlockNode({ nodeId: id }));
        conn.reducers.lockNode({ nodeId: groupId });
        selectNode(groupId);
      },
    };

    const ungroupAction: ContextMenuAction = {
      label: 'Ungroup',
      icon: '↗️',
      disabled: !isLayout,
      onClick: () => {
        if (!isLayout) return;
        const layout   = selNodes[0];
        const children = flatNodes
          .filter(n => n.parentId === layout.id)
          .sort((a, b) => a.order.localeCompare(b.order));

        // Handle empty group
        if (children.length === 0) {
          conn.reducers.unlockNode({ nodeId: layout.id });
          conn.reducers.deleteNodeCascade({ nodeId: layout.id });
          selectNode(null);
          return;
        }

        // Get all siblings of the layout node sorted by order
        const allParentSiblings = flatNodes
          .filter(n => n.parentId === (layout.parentId ?? null))
          .sort((a, b) => a.order.localeCompare(b.order));

        const layoutIdx = allParentSiblings.findIndex(n => n.id === layout.id);

        // prevOrder = last sibling BEFORE the layout node
        const prevOrder = layoutIdx > 0 ? allParentSiblings[layoutIdx - 1].order : undefined;
        // nextOrder = first sibling AFTER the layout node
        const nextOrder = layoutIdx < allParentSiblings.length - 1 ? allParentSiblings[layoutIdx + 1].order : undefined;

        // Chain orders: each promoted child gets an order between prevOrder/last-child and nextOrder
        const promotedOrders: string[] = [];
        children.forEach((child, i) => {
          const before = i === 0 ? prevOrder : promotedOrders[i - 1];
          const order  = resolveDropOrder(before, nextOrder);
          promotedOrders.push(order);
          conn.reducers.moveNode({
            nodeId: child.id,
            newParentId: layout.parentId ?? 'root',
            newOrder: order,
          });
        });
        // Unlock layout, lock promoted children
        conn.reducers.unlockNode({ nodeId: layout.id });
        children.forEach(child => conn.reducers.lockNode({ nodeId: child.id }));
        conn.reducers.deleteNodeCascade({ nodeId: layout.id });
        multiSelectNodes(children.map(c => c.id));
      },
    };

    // ---- Bring to Front ----
    const bringToFrontAction: ContextMenuAction = {
      label: 'Bring to Front',
      icon: '⬆',
      disabled: count === 0,
      onClick: () => {
        // Sort selected ascending by current order so we process lowest-order first
        const sorted = [...selArray].sort((a, b) => {
          const oa = flatNodes.find(n => n.id === a)?.order ?? '';
          const ob = flatNodes.find(n => n.id === b)?.order ?? '';
          return oa.localeCompare(ob);
        });
        let prevOrder: string | undefined;
        let prevParent: string | null = '__sentinel__' as any;
        sorted.forEach(id => {
          const node = flatNodes.find(n => n.id === id);
          if (!node) return;
          const thisParent = node.parentId ?? null;
          if (thisParent !== prevParent) {
            prevOrder = undefined;
            prevParent = thisParent;
          }
          const siblings = flatNodes
            .filter(n => n.parentId === thisParent && !selSet.has(n.id))
            .sort((a, b) => a.order.localeCompare(b.order));
          if (siblings.length === 0 && prevOrder === undefined) return;
          const before = prevOrder ?? siblings.at(-1)?.order;
          const newOrder = resolveDropOrder(before, undefined);
          conn.reducers.moveNode({ nodeId: id, newParentId: node.parentId ?? 'root', newOrder });
          prevOrder = newOrder;
        });
      },
    };

    // ---- Send to Back ----
    const sendToBackAction: ContextMenuAction = {
      label: 'Send to Back',
      icon: '⬇',
      disabled: count === 0,
      onClick: () => {
        // Sort selected descending so we process highest-order first
        const sorted = [...selArray].sort((a, b) => {
          const oa = flatNodes.find(n => n.id === a)?.order ?? '';
          const ob = flatNodes.find(n => n.id === b)?.order ?? '';
          return ob.localeCompare(oa);
        });
        let nextOrder: string | undefined;
        let nextParent: string | null = '__sentinel__' as any;
        sorted.forEach(id => {
          const node = flatNodes.find(n => n.id === id);
          if (!node) return;
          const thisParent = node.parentId ?? null;
          if (thisParent !== nextParent) {
            nextOrder = undefined;
            nextParent = thisParent;
          }
          const siblings = flatNodes
            .filter(n => n.parentId === thisParent && !selSet.has(n.id))
            .sort((a, b) => a.order.localeCompare(b.order));
          if (siblings.length === 0 && nextOrder === undefined) return;
          const after = nextOrder ?? siblings[0]?.order;
          const newOrder = resolveDropOrder(undefined, after);
          conn.reducers.moveNode({ nodeId: id, newParentId: node.parentId ?? 'root', newOrder });
          nextOrder = newOrder;
        });
      },
    };

    // ---- Lock / Unlock ----
    const allLocked = selNodes.length > 0 && selNodes.every(n => n.lockedBy);
    const lockAction: ContextMenuAction = {
      label: allLocked ? 'Unlock' : 'Lock',
      icon:  allLocked ? '🔓' : '🔒',
      disabled: count === 0,
      onClick: () => {
        if (allLocked) {
          selArray.forEach(id => conn.reducers.unlockNode({ nodeId: id }));
        } else {
          selArray.forEach(id => conn.reducers.lockNode({ nodeId: id }));
        }
      },
    };

    const firstNode = selNodes[0];

    const duplicateAction: ContextMenuAction = {
      divider: true,
      label: 'Duplicate',
      icon: '⿸',
      shortcut: '⌘D',
      disabled: count === 0,
      onClick: () => {
        const lastSibling = flatNodes
          .filter(n => n.parentId === (firstNode?.parentId ?? null))
          .sort((a, b) => a.order.localeCompare(b.order))
          .at(-1);
        const baseOrder = resolveDropOrder(lastSibling?.order, undefined);
        const newNodes = duplicateNodes(selArray, [...flatNodes], baseOrder);
        newNodes.forEach(n => conn.reducers.insertNode({
          id: n.id, pageId, tenantId,
          parentId: n.parentId ?? undefined,
          nodeType: n.nodeType, order: n.order,
          styles: n.styles ?? '{}',
          props: n.props ?? '{}',
          settings: n.settings ?? '{}',
          childrenIds: '[]',
          componentUrl: n.componentUrl,
          componentVersion: n.componentVersion,
          componentId: n.componentId ?? undefined,
        }));
        // Select only top-level duplicated nodes (those whose parentId is not in newNodes)
        const newNodeIds = new Set(newNodes.map(n => n.id));
        const topLevel = newNodes.filter(n => !newNodeIds.has(n.parentId ?? ''));
        // Unlock previously selected nodes
        selArray.forEach(id => conn.reducers.unlockNode({ nodeId: id }));
        multiSelectNodes(topLevel.map(n => n.id));
        // Lock new top-level duplicated nodes
        topLevel.forEach(n => conn.reducers.lockNode({ nodeId: n.id }));
      },
    };

    const copyAction: ContextMenuAction = {
      label: 'Copy',
      icon: '📋',
      shortcut: '⌘C',
      disabled: count === 0,
      onClick: () => copyNodes(selArray, [...flatNodes]),
    };

    const pasteAction: ContextMenuAction = {
      label: 'Paste',
      icon: '📌',
      shortcut: '⌘V',
      onClick: () => {
        const clipboard = pasteNodes();
        if (!clipboard.length) return;

        // Assign new IDs and build remapping
        const idMap = new Map<string, string>();
        clipboard.forEach(n => idMap.set(n.oldId, crypto.randomUUID()));

        // Compute base order from last existing node
        const lastSibling = [...flatNodes]
          .filter(n => !n.parentId)
          .sort((a, b) => a.order.localeCompare(b.order))
          .at(-1);

        // Per-parent order chain to avoid collisions with existing sibling orders
        const perParentOrder = new Map<string, string | undefined>();
        perParentOrder.set('root', lastSibling?.order); // root-level starts after last existing

        // Track pasted nodes to identify root-level ones after insertion
        const pastedRootIds: string[] = [];

        clipboard.forEach(n => {
          const newId = idMap.get(n.oldId)!;
          const newParentId = n.parentId ? (idMap.get(n.parentId) ?? undefined) : undefined;
          const parentKey = newParentId ?? 'root';

          if (!perParentOrder.has(parentKey)) {
            perParentOrder.set(parentKey, undefined); // first child of this parent
          }
          const prevOrder = perParentOrder.get(parentKey);
          const order = resolveDropOrder(prevOrder, undefined);
          perParentOrder.set(parentKey, order);

          // Root-level pasted nodes have no parent in the new tree
          if (!newParentId) {
            pastedRootIds.push(newId);
          }

          conn.reducers.insertNode({
            id: newId, pageId, tenantId,
            parentId: newParentId,
            nodeType: n.nodeType,
            order,
            styles: n.styles ?? '{}',
            props: n.props ?? '{}',
            settings: n.settings ?? '{}',
            childrenIds: '[]',
            componentUrl: n.componentUrl,
            componentVersion: n.componentVersion,
            componentId: n.componentId ?? undefined,
          });
        });

        // Unlock previously selected nodes, select and lock pasted root nodes
        selArray.forEach(id => conn.reducers.unlockNode({ nodeId: id }));
        multiSelectNodes(pastedRootIds);
        pastedRootIds.forEach(id => conn.reducers.lockNode({ nodeId: id }));
      },
    };

    return [
      groupAction,
      ungroupAction,
      bringToFrontAction,
      sendToBackAction,
      lockAction,
      duplicateAction,
      copyAction,
      pasteAction,
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        divider: true,
        disabled: count === 0,
        onClick: () => {
          selArray.forEach(id => conn?.reducers.deleteNodeCascade({ nodeId: id }));
          selectNode(null);
        },
      },
    ];
  }, [conn, selectedIds, flatNodes, pageId, tenantId, selectNode, multiSelectNodes]);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="canvas-layout">
        <Toolbar conn={conn} pageId={pageId} tenantId={tenantId} tenantName={tenantName} connected={conn !== null} />
        <div className="canvas-body">
          <LeftPanel pageId={pageId} tenantId={tenantId} conn={conn} />
          <div className="canvas-area" onMouseMove={handleMouseMove}>
            {activeAiOp && <AIStatusBar operation={{
              status: activeAiOp.status,
              currentAction: activeAiOp.currentAction,
              progress: activeAiOp.progress,
              prompt: activeAiOp.prompt,
            }} />}
            <Canvas
              tree={tree} cursors={cursors}
              selectedIds={selectedIds} onSelect={selectNode}
              onMultiSelect={multiSelectNodes}
              onContextMenu={handleContextMenu}
            />
            <AIBar
              conn={conn} pageId={pageId}
              tenantId={tenantId} selectedNodeId={lastSelectedId}
            />
          </div>
          <RightPanel node={selectedNode} conn={conn} tenantId={tenantId} pageId={pageId} isPublished={isPublished} />
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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={buildContextMenuActions(contextMenu.targetId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DndContext>
  );
}

// ── CanvasInner — thin wrapper: gets conn + STDB data, wraps with context ──────
function CanvasInner({
  pageId, tenantId, tenantName,
}: { pageId: string; tenantId: string; tenantName: string }) {
  const stdb = useSpacetimeDB() as any;
  const conn = (stdb?.getConnection?.() ?? null) as DbConnection | null;

  const [flatNodes] = useTable(tables.canvas_node);
  const [cursors]   = useTable(tables.active_cursor);
  const [aiOps]     = useTable(tables.ai_operation);

  if (!conn) return (
    <div className="canvas-loading">
      <div className="spinner" />
      <p>Connecting to SpacetimeDB...</p>
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

// Outer wrapper — creates connection builder + SpacetimeDBProvider
export default function CanvasPage({
  pageId, tenantId, tenantName,
}: { pageId: string; tenantId: string; tenantName: string }) {
  // Build once per pageId/tenantId — SpacetimeDBProvider manages the lifecycle
  const connectionBuilder = useMemo(() =>
    DbConnection.builder()
      .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URL!)
      .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB!)
      .onConnect((conn, _identity, _token) => {
        // Subscribe ONLY to this tenant's page — raw SQL (snake_case DB columns)
        conn.subscriptionBuilder()
          .onApplied(() => console.log('[STDB] Canvas ready'))
          .subscribe([
            `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
            `SELECT * FROM active_cursor WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
            `SELECT * FROM ai_operation WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
            `SELECT * FROM component_build WHERE tenant_id = '${tenantId}'`,
          ]);
      })
      .onConnectError((_ctx, err) => console.error('[STDB] Connect error:', err))
  , [pageId, tenantId]);

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <CanvasInner pageId={pageId} tenantId={tenantId} tenantName={tenantName} />
    </SpacetimeDBProvider>
  );
}
