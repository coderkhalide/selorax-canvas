'use client';
import { useTable } from 'spacetimedb/react';
import { tables }   from '@/module_bindings';

interface ComponentBuildPanelProps {
  tenantId: string;
  operationId: string;
}

export default function ComponentBuildPanel({ tenantId, operationId }: ComponentBuildPanelProps) {
  const [builds] = useTable(tables.component_build.where(r =>
    r.tenant_id.eq(tenantId).and(r.operation_id.eq(operationId))
  ));

  if (!builds.length) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 60, right: 16,
      width: 400, maxHeight: 300, background: '#0f1117',
      border: '1px solid #2a2d3a', borderRadius: 8,
      overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d3a',
        display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
          🧩 Building Component
        </span>
      </div>
      {builds.map(build => (
        <div key={build.id} style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#6B7280' }}>{build.description}</span>
            <span style={{ fontSize: 11, color: '#7C3AED' }}>{build.progress}%</span>
          </div>
          {build.preview_code && (
            <pre style={{
              fontSize: 10, color: '#9CA3AF', overflow: 'auto',
              maxHeight: 200, background: '#0a0c14', padding: 8,
              borderRadius: 4, border: '1px solid #1e2030',
              fontFamily: 'monospace',
            }}>
              {build.preview_code}
            </pre>
          )}
          {build.status === 'ready' && build.compiled_url && (
            <p style={{ fontSize: 11, color: '#059669', marginTop: 6 }}>
              ✓ Ready: {build.compiled_url}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
