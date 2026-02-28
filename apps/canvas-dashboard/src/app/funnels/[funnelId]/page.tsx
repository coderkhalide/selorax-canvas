import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import FunnelDetailView from './components/FunnelDetailView';

const backend = () => process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

async function fetchFunnel(funnelId: string, tenantId: string) {
  try {
    const res = await fetch(`${backend()}/api/funnels/${funnelId}`, {
      headers: { 'x-tenant-id': tenantId }, cache: 'no-store',
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function fetchPages(tenantId: string) {
  try {
    const res = await fetch(`${backend()}/api/pages`, {
      headers: { 'x-tenant-id': tenantId }, cache: 'no-store',
    });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function FunnelDetailPage({ params }: { params: { funnelId: string } }) {
  const headersList = headers();
  const tenantId    = headersList.get('x-tenant-id') ?? 'store_001';

  const [funnel, pages] = await Promise.all([
    fetchFunnel(params.funnelId, tenantId),
    fetchPages(tenantId),
  ]);

  if (!funnel) notFound();

  return <FunnelDetailView funnel={funnel} pages={pages} tenantId={tenantId} />;
}
