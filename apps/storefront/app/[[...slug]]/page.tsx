import { PageRenderer } from '@selorax/renderer';

const BACKEND = process.env.BACKEND_URL!;

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const slug     = params.slug ?? [];
  const tenantId = process.env.TENANT_ID!;
  const { pageType, pageSlug } = resolvePageType(slug);

  const res = await fetch(`${BACKEND}/api/serve/${tenantId}/${pageType}/${pageSlug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <h1 style={{ marginBottom: 8 }}>Page not found</h1>
        <p>This page hasn&apos;t been published yet.</p>
      </div>
    );
  }

  const { tree } = await res.json();
  const data = {
    store: { name: process.env.TENANT_NAME ?? 'My Store' },
    device: 'desktop',
  };

  return <PageRenderer tree={tree} data={data} />;
}

function resolvePageType(slug: string[]): { pageType: string; pageSlug: string } {
  if (!slug.length)           return { pageType: 'home',    pageSlug: 'index' };
  if (slug[0] === 'products') return { pageType: 'product', pageSlug: slug[1] ?? '' };
  if (slug[0] === 'pages')    return { pageType: 'custom',  pageSlug: slug[1] ?? '' };
  return { pageType: 'custom', pageSlug: slug.join('/') };
}
