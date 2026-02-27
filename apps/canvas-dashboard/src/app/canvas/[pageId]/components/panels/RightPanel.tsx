'use client';
import StyleEditor from './StyleEditor';

interface RightPanelProps {
  node: any;
  conn: any;
  tenantId: string;
}

export default function RightPanel({ node, conn, tenantId }: RightPanelProps) {
  return (
    <div className="panel-right">
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
              <p style={{ fontSize: 12, color: '#a78bfa' }}>{node.node_type}</p>
            </div>
            <StyleEditor node={node} conn={conn} tenantId={tenantId} />
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#4B5563' }}>Select a node to edit</p>
        )}
      </div>
    </div>
  );
}
