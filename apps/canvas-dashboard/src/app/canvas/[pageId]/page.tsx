import { headers } from 'next/headers';
import CanvasPage  from './components/CanvasPage';

export default async function CanvasRoute({ params }: { params: { pageId: string } }) {
  const headersList = await headers();
  const tenantId    = headersList.get('x-tenant-id') ?? process.env.TENANT_ID!;
  const tenantName  = headersList.get('x-tenant-name') ?? process.env.TENANT_NAME ?? 'My Store';
  // key forces full remount (new STDB connection) when navigating between pages
  return <CanvasPage key={params.pageId} pageId={params.pageId} tenantId={tenantId} tenantName={tenantName} />;
}
