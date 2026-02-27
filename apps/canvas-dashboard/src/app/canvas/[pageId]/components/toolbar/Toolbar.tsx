'use client';
import PublishButton from './PublishButton';
import ExportButton from './ExportButton';

interface ToolbarProps {
  conn: any;
  pageId: string;
  tenantId: string;
  tenantName: string;
  connected: boolean;
}

export default function Toolbar({ conn, pageId, tenantId, tenantName, connected }: ToolbarProps) {
  return (
    <div className="toolbar">
      <span className="toolbar-title">{tenantName} — Canvas</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
        <div className={`connection-dot ${connected ? '' : 'disconnected'}`} />
        <span>{connected ? 'Live' : 'Disconnected'}</span>
      </div>
      <ExportButton />
      <PublishButton pageId={pageId} tenantId={tenantId} />
    </div>
  );
}
