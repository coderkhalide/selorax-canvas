'use client';
import StyleEditor from './StyleEditor';
import LayoutPanel from './LayoutPanel';
import AnalyticsStrip from './AnalyticsStrip';

interface RightPanelProps {
  node: any;
  conn: any;
  tenantId: string;
  pageId?: string;
  isPublished?: boolean;
}

export default function RightPanel({ node, conn, tenantId, pageId, isPublished }: RightPanelProps) {
  const nodeStyles: Record<string, string> = (() => {
    try { return JSON.parse(node?.styles ?? '{}'); } catch { return {}; }
  })();

  return (
    <div className="panel-right">
      {pageId && (
        <AnalyticsStrip
          pageId={pageId}
          tenantId={tenantId}
          isPublished={isPublished ?? false}
        />
      )}
      <div className="panel-section">
        <h3>Properties</h3>
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
            <LayoutPanel
              nodeId={node.id}
              styles={nodeStyles}
              tenantId={tenantId}
            />
            <StyleEditor node={node} conn={conn} tenantId={tenantId} />
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#4B5563' }}>Select a node to edit</p>
        )}
      </div>
    </div>
  );
}
