import FunnelChart from '../../[pageId]/components/FunnelChart';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';
const TENANT  = process.env.TENANT_ID  ?? 'store_001';

export default async function FunnelAnalytics({ params }: { params: { funnelId: string } }) {
  const res = await fetch(
    `${BACKEND}/api/analytics/funnels/${params.funnelId}?days=30`,
    { headers: { 'x-tenant-id': TENANT }, cache: 'no-store' },
  );

  if (!res.ok) {
    return <div style={{ padding: 40, color: '#6B7280', fontSize: 14 }}>Funnel not found.</div>;
  }

  const funnel = await res.json();

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#F9FAFB' }}>
        Funnel Analytics: {funnel.name}
      </h1>
      <FunnelChart funnel={funnel} />
    </div>
  );
}
