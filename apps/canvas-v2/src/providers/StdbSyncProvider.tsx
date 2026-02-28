"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { DbConnection, tables } from "@/module_bindings";
import {
  SpacetimeDBProvider,
  useTable,
  useSpacetimeDB,
} from "spacetimedb/react";
import { useFunnel } from "@/context/FunnelContext";
import {
  flatNodesToTree,
  flattenElements,
  computeOps,
  canvasNodeToElement,
  type RawCanvasNode,
} from "@/lib/nodeConverter";
import type { FunnelElement } from "@/types";
import { LiveCursors } from "@/components/LiveCursors";

// ── Inner component: runs inside SpacetimeDBProvider ─────────────────────────

function StdbSyncInner({
  pageId,
  tenantId,
}: {
  pageId: string;
  tenantId: string;
}) {
  const { elements, setElements, setRemoteElements, mergeRemoteNode } = useFunnel();
  const stdb = useSpacetimeDB() as any;
  const conn = (stdb?.getConnection?.() ?? null) as DbConnection | null;
  const [flatNodes] = useTable(tables.canvas_node);

  const initialized = useRef(false);
  // Separate ready flag for remote-merge effect so it only starts after initial seed completes
  const remoteMergeReady = useRef(false);
  const prevElementsRef = useRef<FunnelElement[]>([]);
  const dirtyIds = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connRef = useRef<DbConnection | null>(null);
  // Track previous STDB node snapshots to detect remote changes
  const prevNodesRef = useRef<Map<string, RawCanvasNode>>(new Map());
  // Track local user's identity so LiveCursors can filter out self
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  // Keep connRef in sync with conn without triggering re-renders
  // Also capture the local user's identity for cursor filtering (state so LiveCursors re-renders)
  useEffect(() => {
    connRef.current = conn;
    if (conn) {
      setCurrentUserId((conn as any).identity?.toHexString?.());
    }
  }, [conn]);

  // Reset initialization when pageId changes (user navigated to a different page)
  useEffect(() => {
    initialized.current = false;
    remoteMergeReady.current = false;
    prevElementsRef.current = [];
    dirtyIds.current.clear();
    prevNodesRef.current = new Map();
  }, [pageId]);

  // Initial load: flat STDB nodes → FunnelElement tree → context
  useEffect(() => {
    if (initialized.current) return;
    if (flatNodes.length === 0) return;

    const filtered = [...flatNodes].filter(
      (n) => (n as any).pageId === pageId && (n as any).tenantId === tenantId
    ) as RawCanvasNode[];
    const tree = flatNodesToTree(filtered);
    initialized.current = true;
    prevElementsRef.current = tree;
    // Seed prevNodesRef so the remote-merge effect doesn't re-process the initial load
    prevNodesRef.current = new Map(filtered.map((n) => [n.id, n]));
    setElements(tree);
    // Signal that remote-merge effect is now safe to run (Bug 2 fix)
    remoteMergeReady.current = true;
  }, [flatNodes, setElements, pageId, tenantId]);

  // Remote merge: STDB changes from AI / other users → FunnelContext
  useEffect(() => {
    // Bug 2 fix: guard on remoteMergeReady (set after initial seed) instead of initialized,
    // so we don't double-apply nodes that were already seeded in the initial-load effect.
    if (!remoteMergeReady.current) return;

    const filtered = [...flatNodes].filter(
      (n) => (n as any).pageId === pageId && (n as any).tenantId === tenantId
    ) as RawCanvasNode[];

    const currentMap = new Map(filtered.map((n) => [n.id, n]));
    const prevMap = prevNodesRef.current;

    // Detect upserts: new nodes or nodes changed by remote (AI / other users)
    let hasNewNode = false;
    for (const [id, node] of currentMap) {
      if (dirtyIds.current.has(id)) continue; // local edit — skip
      const prev = prevMap.get(id);
      const isNew = !prev;
      const changed =
        isNew ||
        prev.styles !== node.styles ||
        prev.props !== node.props ||
        prev.settings !== node.settings ||
        prev.parentId !== node.parentId ||
        prev.order !== node.order;
      if (changed) {
        if (isNew) {
          // Bug 1 fix: new remote node — rebuild full tree from flat snapshot so
          // parent-child nesting is correct instead of appending to root.
          hasNewNode = true;
        } else {
          const element = canvasNodeToElement(node);
          if (element) {
            mergeRemoteNode(id, "upsert", element);
          }
        }
      }
    }

    if (hasNewNode) {
      // Rebuild the full tree from the current flat snapshot to place all new
      // nodes under their correct parents (Bug 1 fix).
      const tree = flatNodesToTree(filtered);
      prevElementsRef.current = tree;   // prevent echo-back: update ref before state so watch-elements effect sees no diff
      setRemoteElements(tree);
    }

    // Detect deletes: nodes removed by remote
    for (const [id] of prevMap) {
      if (!currentMap.has(id) && !dirtyIds.current.has(id)) {
        mergeRemoteNode(id, "delete");
      }
    }

    prevNodesRef.current = currentMap;
  }, [flatNodes, pageId, tenantId, mergeRemoteNode, setRemoteElements]);

  // Debounced sync: local changes → STDB reducers
  const scheduleSync = useCallback(
    (nextElements: FunnelElement[]) => {
      const prev = prevElementsRef.current;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        if (!connRef.current) return;
        const ops = computeOps(prev, nextElements, pageId, tenantId);
        if (ops.length === 0) return;

        console.log(`[StdbSync] flushing ${ops.length} ops`);

        for (const op of ops) {
          try {
            if (op.type === "insert" && op.node) {
              // insertNode reducer signature (from insert_node_reducer.ts):
              // id, pageId, tenantId, nodeType, parentId (option<string>),
              // order, styles, props, settings, childrenIds, componentUrl (option<string>),
              // componentId (option<string>), componentVersion (option<string>)
              connRef.current.reducers.insertNode({
                id: op.node.id,
                pageId: op.node.pageId,
                tenantId: op.node.tenantId,
                parentId: op.node.parentId ?? null,
                nodeType: op.node.nodeType,
                order: op.node.order,
                styles: op.node.styles,
                props: op.node.props,
                settings: op.node.settings,
                childrenIds: "",
                componentUrl: op.node.componentUrl ?? null,
                componentVersion: op.node.componentVersion ?? null,
                componentId: op.node.componentId ?? null,
              });
            } else if (op.type === "update_styles" && op.styles !== undefined) {
              // updateNodeStyles reducer signature: { nodeId, styles }
              connRef.current.reducers.updateNodeStyles({
                nodeId: op.nodeId,
                styles: op.styles,
              });
            } else if (op.type === "update_props" && op.props !== undefined) {
              // updateNodeProps reducer signature: { nodeId, props }
              connRef.current.reducers.updateNodeProps({
                nodeId: op.nodeId,
                props: op.props,
              });
            } else if (
              op.type === "update_settings" &&
              op.settings !== undefined
            ) {
              // updateNodeSettings reducer signature: { nodeId, settings }
              connRef.current.reducers.updateNodeSettings({
                nodeId: op.nodeId,
                settings: op.settings,
              });
            } else if (op.type === "move") {
              // moveNode reducer signature: { nodeId, newParentId, newOrder }
              connRef.current.reducers.moveNode({
                nodeId: op.nodeId,
                newParentId: op.newParentId ?? "",
                newOrder: op.newOrder ?? "",
              });
            } else if (op.type === "delete") {
              // deleteNodeCascade reducer signature: { nodeId }
              connRef.current.reducers.deleteNodeCascade({
                nodeId: op.nodeId,
              });
            }
          } catch (err) {
            console.error("[StdbSync] reducer error:", op.type, err);
          }
        }

        prevElementsRef.current = nextElements;
        dirtyIds.current.clear();
      }, 100);
    },
    [pageId, tenantId]
  );

  // Watch elements for local changes
  useEffect(() => {
    if (!initialized.current) return;

    // Track dirty IDs
    const nextMap = flattenElements(elements);
    const prevMap = flattenElements(prevElementsRef.current);
    for (const [id, entry] of nextMap) {
      const prev = prevMap.get(id);
      if (!prev || prev.styles !== entry.styles || prev.props !== entry.props) {
        dirtyIds.current.add(id);
      }
    }

    scheduleSync(elements);
  }, [elements, scheduleSync]);

  // Cursor broadcast: send mouse position to STDB at max 20fps (50ms throttle)
  const lastCursorSend = useRef(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorSend.current < 50) return;
      lastCursorSend.current = now;
      const conn = connRef.current;
      if (!conn) return;
      try {
        conn.reducers.upsertCursor({
          pageId,
          tenantId,
          x: e.clientX,
          y: e.clientY,
          selectedNodeId: null,
          hoveredNodeId: null,
          userName: "User",
          userColor: "#3B82F6",
          userType: "editor",
          userAvatar: null,
        });
      } catch {
        // Ignore reducer errors (e.g. not yet connected)
      }
    },
    [pageId, tenantId]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      // Remove cursor on unmount (cleanup) — must pass pageId + tenantId to identify the record
      const conn = connRef.current;
      if (conn) {
        try {
          conn.reducers.removeCursor({ pageId, tenantId });
        } catch {
          // Ignore errors on cleanup
        }
      }
    };
  }, [handleMouseMove]);

  return (
    <LiveCursors
      pageId={pageId}
      tenantId={tenantId}
      currentUserId={currentUserId}
    />
  );
}

// ── Outer: creates SpacetimeDB connection ─────────────────────────────────────

export function StdbSyncProvider({
  pageId,
  tenantId,
  children,
}: {
  pageId: string;
  tenantId: string;
  children: React.ReactNode;
}) {
  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(
          process.env.NEXT_PUBLIC_SPACETIMEDB_URL ??
            "wss://maincloud.spacetimedb.com"
        )
        .withDatabaseName(
          process.env.NEXT_PUBLIC_SPACETIMEDB_DB ?? "selorax-canvas"
        )
        .onConnect((conn: DbConnection) => {
          console.log("[StdbSync] connected, subscribing to page:", pageId);
          conn
            .subscriptionBuilder()
            .onApplied(() => console.log("[StdbSync] subscription ready"))
            .subscribe([
              // MUST use raw SQL — query builder generates wrong column names (camelCase vs snake_case)
              `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
              `SELECT * FROM active_cursor WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
            ]);
        })
        .onDisconnect(() => console.log("[StdbSync] disconnected")),
    [pageId, tenantId]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpacetimeDBProviderAny = SpacetimeDBProvider as any;

  return (
    <SpacetimeDBProviderAny connectionBuilder={connectionBuilder}>
      <StdbSyncInner pageId={pageId} tenantId={tenantId} />
      {children}
    </SpacetimeDBProviderAny>
  );
}
