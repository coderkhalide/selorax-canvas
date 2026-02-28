"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
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
  type RawCanvasNode,
} from "@/lib/nodeConverter";
import type { FunnelElement } from "@/types";

// ── Inner component: runs inside SpacetimeDBProvider ─────────────────────────

function StdbSyncInner({
  pageId,
  tenantId,
}: {
  pageId: string;
  tenantId: string;
}) {
  const { elements, setElements } = useFunnel();
  const stdb = useSpacetimeDB() as unknown as DbConnection | null;
  const conn = (stdb as unknown as { getConnection?: () => DbConnection | null })?.getConnection?.() ?? (stdb as unknown as DbConnection | null);
  const [flatNodes] = useTable(tables.canvas_node);

  const initialized = useRef(false);
  const prevElementsRef = useRef<FunnelElement[]>([]);
  const dirtyIds = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initial load: flat STDB nodes → FunnelElement tree → context
  useEffect(() => {
    if (initialized.current) return;
    if (flatNodes.length === 0) return;

    const tree = flatNodesToTree([...flatNodes] as RawCanvasNode[]);
    initialized.current = true;
    prevElementsRef.current = tree;
    setElements(tree);
  }, [flatNodes, setElements]);

  // Remote merge: STDB changes from AI / other users
  useEffect(() => {
    if (!initialized.current) return;

    const remoteTree = flatNodesToTree([...flatNodes] as RawCanvasNode[]);
    const remoteMap = flattenElements(remoteTree);

    setElements((current: FunnelElement[]) => {
      const localMap = flattenElements(current);

      // Check for structural changes (new or deleted nodes from remote)
      let hasNewRemote = false;
      for (const [id] of remoteMap) {
        if (!localMap.has(id)) {
          hasNewRemote = true;
          break;
        }
      }
      let hasDeletedRemote = false;
      for (const [id] of localMap) {
        if (!remoteMap.has(id) && !dirtyIds.current.has(id)) {
          hasDeletedRemote = true;
          break;
        }
      }

      // Conservative: preserve local state for now (full CRDT merge in Phase 2)
      if (!hasNewRemote && !hasDeletedRemote) return current;
      return current;
    });
  }, [flatNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sync: local changes → STDB reducers
  const scheduleSync = useCallback(
    (nextElements: FunnelElement[]) => {
      const prev = prevElementsRef.current;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        if (!conn) return;
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
              (conn as DbConnection).reducers.insertNode({
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
              (conn as DbConnection).reducers.updateNodeStyles({
                nodeId: op.nodeId,
                styles: op.styles,
              });
            } else if (op.type === "update_props" && op.props !== undefined) {
              // updateNodeProps reducer signature: { nodeId, props }
              (conn as DbConnection).reducers.updateNodeProps({
                nodeId: op.nodeId,
                props: op.props,
              });
            } else if (
              op.type === "update_settings" &&
              op.settings !== undefined
            ) {
              // updateNodeSettings reducer signature: { nodeId, settings }
              (conn as DbConnection).reducers.updateNodeSettings({
                nodeId: op.nodeId,
                settings: op.settings,
              });
            } else if (op.type === "move") {
              // moveNode reducer signature: { nodeId, newParentId, newOrder }
              (conn as DbConnection).reducers.moveNode({
                nodeId: op.nodeId,
                newParentId: op.newParentId ?? "",
                newOrder: op.newOrder ?? "",
              });
            } else if (op.type === "delete") {
              // deleteNodeCascade reducer signature: { nodeId }
              (conn as DbConnection).reducers.deleteNodeCascade({
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
    [conn, pageId, tenantId]
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

  return null;
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
