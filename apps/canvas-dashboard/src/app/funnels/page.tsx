import { headers } from 'next/headers';
import FunnelList from './components/FunnelList';

async function fetchFunnels(tenantId: string) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${backend}/api/funnels`, {
      headers: { 'x-tenant-id': tenantId },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function FunnelsPage() {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id') ?? 'store_001';
  const funnels  = await fetchFunnels(tenantId);

  return <FunnelList initialFunnels={funnels} tenantId={tenantId} />;
}
