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
  nodes: Map<string, CanvasNode>;
  flatNodes: CanvasNode[];
  selectedIds: Set<string>;
  editingId: string | null;
  draggingId: string | null;
  selectedNode: CanvasNode | null;
  selectNode: (id: string | null, shiftKey?: boolean) => void;
  multiSelectNodes: (ids: string[]) => void;
  setEditingId: (id: string | null) => void;
  setDraggingId: (id: string | null) => void;
  insertNode: (args: Omit<CanvasNode, 'id'> & { id?: string }) => string;
  updateStyles: (nodeId: string, patch: Record<string, string>) => void;
  updateProps:  (nodeId: string, patch: Record<string, unknown>) => void;
  updateSettings: (nodeId: string, patch: Record<string, unknown>) => void;
  moveNode: (nodeId: string, newParentId: string | null, newOrder: string) => void;
  deleteNode: (nodeId: string) => void;
  duplicateSelected: () => void;
}

// ── Reducer ────────────────────────────────────────────────────────
export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
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
  conn: any;
  stdbNodes: readonly any[];
  pageId: string;
  tenantId: string;
  children: React.ReactNode;
}

export function CanvasContextProvider({
  conn, stdbNodes, pageId, tenantId, children,
}: ProviderProps) {
  const [state, dispatch] = useReducer(canvasReducer, {
    nodes: new Map<string, CanvasNode>(),
    selectedIds: new Set<string>(),
    editingId: null,
    draggingId: null,
  } satisfies CanvasState);

  // Fix 2: connRef to avoid stale closure in debounced timer
  const connRef = useRef<any>(conn);
  useEffect(() => { connRef.current = conn; }, [conn]);

  useEffect(() => {
    dispatch({ type: 'STDB_SYNC', nodes: stdbNodes });
  }, [stdbNodes]);

  const queue   = useRef<Array<() => void>>([]);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSync = useCallback((op: () => void) => {
    queue.current.push(op);
    if (timer.current) clearTimeout(timer.current);
    // Fix 2: use connRef.current instead of stale conn closure
    timer.current = setTimeout(() => {
      if (!connRef.current) { queue.current = []; return; }
      queue.current.splice(0).forEach(fn => fn());
    }, 100);
  }, []);

  // Fix 1: Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flatNodes    = Array.from(state.nodes.values());
  const lastSelId    = [...state.selectedIds].at(-1) ?? null;
  const selectedNode = lastSelId ? (state.nodes.get(lastSelId) ?? null) : null;

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
    // Fix 2: use connRef.current in queued callback
    queueSync(() => connRef.current?.reducers.insertNode({
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
  }, [pageId, tenantId, queueSync]);

  // Fix 3: Send merged styles to STDB, not just the patch
  const updateStyles = useCallback((nodeId: string, patch: Record<string, string>) => {
    const existing = state.nodes.get(nodeId);
    const merged = { ...JSON.parse(existing?.styles || '{}'), ...patch };
    dispatch({ type: 'UPDATE_STYLES', nodeId, patch });
    queueSync(() => connRef.current?.reducers.updateNodeStyles({ nodeId, styles: JSON.stringify(merged) }));
  }, [queueSync, state.nodes]);

  // Fix 3: Send merged props to STDB, not just the patch
  const updateProps = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    const existing = state.nodes.get(nodeId);
    const merged = { ...JSON.parse(existing?.props || '{}'), ...patch };
    dispatch({ type: 'UPDATE_PROPS', nodeId, patch });
    queueSync(() => connRef.current?.reducers.updateNodeProps({ nodeId, props: JSON.stringify(merged) }));
  }, [queueSync, state.nodes]);

  // Fix 3: Send merged settings to STDB, not just the patch
  const updateSettings = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    const existing = state.nodes.get(nodeId);
    const merged = { ...JSON.parse(existing?.settings || '{}'), ...patch };
    dispatch({ type: 'UPDATE_SETTINGS', nodeId, patch });
    queueSync(() => connRef.current?.reducers.updateNodeSettings({ nodeId, settings: JSON.stringify(merged) }));
  }, [queueSync, state.nodes]);

  const moveNode = useCallback((nodeId: string, newParentId: string | null, newOrder: string) => {
    dispatch({ type: 'MOVE', nodeId, newParentId, newOrder });
    queueSync(() => connRef.current?.reducers.moveNode({ nodeId, newParentId: newParentId ?? 'root', newOrder }));
  }, [queueSync]);

  // Fix 4: Don't debounce deleteNodeCascade — fire immediately to avoid race
  const deleteNode = useCallback((nodeId: string) => {
    connRef.current?.reducers.unlockNode({ nodeId });
    connRef.current?.reducers.deleteNodeCascade({ nodeId });
    dispatch({ type: 'DELETE', nodeId });
  }, []);

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
      // Fix 2: use connRef.current in queued callback
      queueSync(() => connRef.current?.reducers.insertNode({
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
