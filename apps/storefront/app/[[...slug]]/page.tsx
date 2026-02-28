import { cookies } from 'next/headers';
import ClientAnalytics from './ClientAnalytics';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const slug     = params.slug ?? [];
  const tenantId = process.env.TENANT_ID ?? 'store_001';
  const { pageType, pageSlug } = resolvePageType(slug);

  // Read visitor ID from cookie (set client-side by ClientAnalytics on first load)
  const cookieStore = cookies();
  const visitorId   = cookieStore.get('_sid')?.value ?? null;

  const url = new URL(`${BACKEND}/api/serve/${tenantId}/${pageType}/${pageSlug}`);
  if (visitorId) url.searchParams.set('visitorId', visitorId);

  const fetchOpts = visitorId
    ? { cache: 'no-store' as const }          // personalized — never cache
    : { next: { revalidate: 60 } as const };  // static — ISR

  const res = await fetch(url.toString(), fetchOpts);

  if (!res.ok) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <h1 style={{ marginBottom: 8 }}>Page not found</h1>
        <p>This page hasn&apos;t been published yet.</p>
      </div>
    );
  }

  const { tree, pageId, funnelContext, experimentContext } = await res.json();
  const data = {
    store: { name: process.env.TENANT_NAME ?? 'My Store' },
    device: 'desktop',
  };

  return (
    <ClientAnalytics
      tree={tree}
      data={data}
      pageId={pageId}
      tenantId={tenantId}
      funnelContext={funnelContext ?? null}
      experimentContext={experimentContext ?? null}
    />
  );
}

function resolvePageType(slug: string[]): { pageType: string; pageSlug: string } {
  if (!slug.length)           return { pageType: 'home',    pageSlug: 'index' };
  if (slug[0] === 'products') return { pageType: 'product', pageSlug: slug[1] ?? '' };
  if (slug[0] === 'pages')    return { pageType: 'custom',  pageSlug: slug[1] ?? '' };
  return { pageType: 'custom', pageSlug: slug.join('/') };
}
