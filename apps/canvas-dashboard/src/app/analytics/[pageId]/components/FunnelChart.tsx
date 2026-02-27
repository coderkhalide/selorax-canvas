interface FunnelStep {
  stepOrder: number;
  pageId: string;
  name: string | null;
  visitors: number;
  dropOff: number;
}

interface FunnelData {
  name: string;
  steps: FunnelStep[];
  totalConversions: number;
  totalRevenue: number;
}

export default function FunnelChart({ funnel }: { funnel: FunnelData }) {
  if (!funnel?.steps?.length) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB', marginBottom: 16 }}>
        Funnel: {funnel.name}
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {funnel.steps.map((step, i) => (
          <div key={step.pageId} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              background: '#12141f',
              border: '1px solid #1e2130',
              borderRadius: 8,
              padding: '16px 20px',
              minWidth: 140,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px' }}>Step {step.stepOrder}</p>
              <p style={{ fontSize: 13, color: '#F9FAFB', margin: '0 0 4px', fontWeight: 600 }}>
                {step.name ?? `Step ${step.stepOrder}`}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa', margin: '0 0 2px' }}>
                {step.visitors.toLocaleString()}
              </p>
              <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>visitors</p>
            </div>
            {i < funnel.steps.length - 1 && (
              <div style={{ textAlign: 'center', padding: '0 8px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: '#EF4444', margin: '0 0 4px' }}>
                  ↓ {step.dropOff}% drop-off
                </p>
                <p style={{ fontSize: 18, color: '#4B5563', margin: 0 }}>→</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>
          Total conversions: <strong style={{ color: '#F9FAFB' }}>{funnel.totalConversions.toLocaleString()}</strong>
        </span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>
          Total revenue: <strong style={{ color: '#34D399' }}>${funnel.totalRevenue.toLocaleString()}</strong>
        </span>
      </div>
    </div>
  );
}
