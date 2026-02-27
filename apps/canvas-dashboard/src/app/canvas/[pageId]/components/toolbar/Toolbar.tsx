'use client';
import PublishButton from './PublishButton';

interface ToolbarProps {
  conn: any; pageId: string; tenantId: string;
  tenantName: string; connected: boolean;
}

export default function Toolbar({ conn, pageId, tenantId, tenantName, connected }: ToolbarProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  return (
    <div className="toolbar">
      <a
        href="/dashboard"
        style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}
      >
        ← Back
      </a>
      <span className="toolbar-title">{tenantName} — Canvas</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: 'var(--text-secondary)', marginRight: 8 }}>
        <div className={`connection-dot${connected ? '' : ' disconnected'}`} />
        <span>{connected ? 'Live' : 'Disconnected'}</span>
      </div>
      <button
        onClick={() => window.open(`${backendUrl.replace('3001','3004')}/${pageId}`, '_blank')}
        className="btn btn-secondary"
        style={{ fontSize: 12 }}
      >
        ▶ Preview
      </button>
      <PublishButton pageId={pageId} tenantId={tenantId} />
    </div>
  );
}
