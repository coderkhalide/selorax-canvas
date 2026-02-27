import KpiCards          from './components/KpiCards';
import FunnelChart       from './components/FunnelChart';
import AiSuggestions     from './components/AiSuggestions';
import ExperimentResults from './components/ExperimentResults';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';
const TENANT  = process.env.TENANT_ID  ?? 'store_001';

export default async function PageAnalytics({ params }: { params: { pageId: string } }) {
  const { pageId } = params;
  const headers = { 'x-tenant-id': TENANT };

  const [statsRes, funnelRes] = await Promise.all([
    fetch(`${BACKEND}/api/analytics/pages/${pageId}?days=30`, { headers, cache: 'no-store' }),
    fetch(`${BACKEND}/api/analytics/pages/${pageId}/funnel?days=30`, { headers, cache: 'no-store' }).catch(() => null),
  ]);

  const stats  = statsRes.ok       ? await statsRes.json()  : null;
  const funnel = funnelRes?.ok      ? await funnelRes.json() : null;

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>
          Page Analytics
        </h1>
        <a
          href={`/canvas/${pageId}`}
          style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'none' }}
        >
          ← Back to Editor
        </a>
      </div>

      {stats ? <KpiCards stats={stats} /> : (
        <p style={{ color: '#6B7280', fontSize: 14 }}>No data yet. Publish the page and start sending traffic to see analytics.</p>
      )}

      {stats?.experimentLift && <ExperimentResults experimentLift={stats.experimentLift} />}

      {funnel && <FunnelChart funnel={funnel} />}

      <AiSuggestions pageId={pageId} tenantId={TENANT} />
    </div>
  );
}
