'use client';
import { useMemo, useState, useCallback } from 'react';
import { DbConnection, tables }           from '@/module_bindings';
import { SpacetimeDBProvider, useTable, useSpacetimeDB } from 'spacetimedb/react';
import { buildTree }                      from '@/utils/tree';
import Canvas       from './Canvas';
import LeftPanel    from './panels/LeftPanel';
import RightPanel   from './panels/RightPanel';
import Toolbar      from './toolbar/Toolbar';
import AIBar        from './ai/AIBar';
import AIStatusBar  from './ai/AIStatusBar';

// Inner component — must be inside SpacetimeDBProvider to use useTable
function CanvasInner({
  pageId, tenantId, tenantName,
}: { pageId: string; tenantId: string; tenantName: string }) {
  const conn = useSpacetimeDB() as DbConnection | null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // useTable — live React state, auto-updates on any row change (no polling)
  const [flatNodes] = useTable(tables.canvas_node.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));
  const [cursors] = useTable(tables.active_cursor.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));
  const [aiOps] = useTable(tables.ai_operation.where(r =>
    r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
  ));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!conn) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    conn.reducers.move_cursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      selected_node_id: selectedId,
      hovered_node_id: null,
    });
  }, [conn, selectedId]);

  const tree       = flatNodes.length > 0 ? buildTree(flatNodes) : null;
  const activeAiOp = aiOps.find(op => op.status !== 'done' && op.status !== 'error');
  const selectedNode = flatNodes.find(n => n.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string | null) => {
    if (!conn) return;
    if (selectedId && selectedId !== id) conn.reducers.unlock_node({ node_id: selectedId });
    if (id) conn.reducers.lock_node({ node_id: id });
    setSelectedId(id);
  }, [conn, selectedId]);

  if (!conn) return (
    <div className="canvas-loading">
      <div className="spinner" />
      <p>Connecting to SpacetimeDB...</p>
    </div>
  );

  return (
    <div className="canvas-layout">
      <Toolbar conn={conn} pageId={pageId} tenantId={tenantId} tenantName={tenantName} connected={true} />
      <div className="canvas-body">
        <LeftPanel flatNodes={flatNodes} selectedId={selectedId} onSelect={handleSelect} />
        <div className="canvas-area" onMouseMove={handleMouseMove}>
          {activeAiOp && <AIStatusBar operation={activeAiOp} />}
          <Canvas
            tree={tree} cursors={cursors}
            selectedId={selectedId} onSelect={handleSelect}
          />
          <AIBar
            conn={conn} pageId={pageId}
            tenantId={tenantId} selectedNodeId={selectedId}
          />
        </div>
        <RightPanel node={selectedNode} conn={conn} tenantId={tenantId} />
      </div>
    </div>
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
        // Subscribe ONLY to this tenant's page — NEVER subscribeToAllTables
        conn.subscriptionBuilder()
          .onApplied(() => console.log('[STDB] Canvas ready'))
          .subscribe([
            tables.canvas_node.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.active_cursor.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.ai_operation.where(r =>
              r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
            ),
            tables.component_build.where(r =>
              r.tenant_id.eq(tenantId)
            ),
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
