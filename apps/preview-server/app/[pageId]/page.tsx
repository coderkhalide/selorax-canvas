import { buildTree }  from '@/utils/tree';
import PreviewNav    from './PreviewNav';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

const STDB_HTTP = (process.env.SPACETIMEDB_URL ?? 'wss://maincloud.spacetimedb.com')
  .replace(/^wss?:\/\//, 'https://');
const STDB_NAME = process.env.SPACETIMEDB_DB_NAME ?? 'selorax-canvas';

// Decode SpacetimeDB Option<T> from SQL response: [0, value] = Some, [1, []] = None
function decodeOpt(val: any): string | null {
  if (!Array.isArray(val)) return null;
  return val[0] === 0 ? val[1] : null;
}

async function getPageNodes(pageId: string, tenantId: string) {
  const sql = `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`;
  const res = await fetch(`${STDB_HTTP}/v1/database/${STDB_NAME}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: sql,
    cache: 'no-store', // always fresh for preview
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`STDB SQL query failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as Array<{ schema: { elements: any[] }; rows: any[][] }>;
  if (!data.length) return [];

  const { schema, rows } = data[0];
  const colIndex: Record<string, number> = {};
  schema.elements.forEach((el: any, i: number) => {
    const name: string = el.name?.some ?? el.name;
    if (name) colIndex[name] = i;
  });

  return rows.map(row => ({
    id:                row[colIndex['id']],
    page_id:           row[colIndex['page_id']],
    tenant_id:         row[colIndex['tenant_id']],
    node_type:         row[colIndex['node_type']],
    parent_id:         decodeOpt(row[colIndex['parent_id']]),
    order:             row[colIndex['order']],
    styles:            row[colIndex['styles']],
    props:             row[colIndex['props']],
    settings:          row[colIndex['settings']],
    children_ids:      row[colIndex['children_ids']],
    component_url:     decodeOpt(row[colIndex['component_url']]),
    component_id:      decodeOpt(row[colIndex['component_id']]),
    component_version: decodeOpt(row[colIndex['component_version']]),
  }));
}

export default async function PreviewPage({
  params, searchParams,
}: {
  params: { pageId: string };
  searchParams: { tenantId?: string };
}) {
  const pageId   = params.pageId;
  const tenantId = searchParams.tenantId ?? process.env.TENANT_ID!;

  let flatNodes: any[] = [];

  try {
    flatNodes = await getPageNodes(pageId, tenantId);
  } catch (err: any) {
    return (
      <div style={{ padding: 40, color: '#DC2626', textAlign: 'center' }}>
        <h2>Preview Error</h2>
        <p>{err.message}</p>
        <p style={{ marginTop: 8, color: '#6B7280', fontSize: 14 }}>
          Make sure SpacetimeDB is accessible and the page has been opened in the editor.
        </p>
      </div>
    );
  }

  if (!flatNodes.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <h2>No content yet</h2>
        <p>Open the canvas editor to add content, then preview here.</p>
        <a href={`${process.env.DASHBOARD_URL}/canvas/${pageId}`}
           style={{ color: '#7C3AED', marginTop: 8, display: 'inline-block' }}>
          ← Back to Editor
        </a>
      </div>
    );
  }

  const tree = buildTree(flatNodes);
  const data = { store: { name: process.env.TENANT_NAME ?? 'My Store' } };

  // Fetch funnel nav context (preview navigation only — no analytics fired)
  let funnelNavContext: {
    funnelId: string;
    funnelStepOrder: number;
    nextStepPageId: string | null;
    nextStepUrl: string | null;
    isLastStep: boolean;
  } | null = null;
  try {
    const navRes = await fetch(
      `${BACKEND}/api/serve/${tenantId}/funnel-nav/${pageId}`,
      { cache: 'no-store' },
    );
    if (navRes.ok) {
      const { funnelContext } = await navRes.json();
      funnelNavContext = funnelContext;
    }
  } catch {
    // No funnel context — renders without navigation
  }

  // Build renderer-compatible funnelContext (navigation handled by PreviewNav below)
  const rendererFunnelContext = funnelNavContext ? {
    funnelId:        funnelNavContext.funnelId,
    funnelStepOrder: funnelNavContext.funnelStepOrder,
    nextStepUrl:     funnelNavContext.nextStepUrl,
    isLastStep:      funnelNavContext.isLastStep,
    onSuccess:       null as null,
    onSkip:          null as null,
  } : null;

  // Next preview URL: navigate to the next step's preview page (not storefront slug)
  const nextPreviewUrl = funnelNavContext?.nextStepPageId
    ? `/${funnelNavContext.nextStepPageId}?tenantId=${tenantId}`
    : null;

  return (
    <>
      {/* Preview banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: '#7C3AED', color: '#fff', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16, fontSize: 14,
      }}>
        <span>⚠️ Preview — not published yet</span>
        <a href={`${process.env.DASHBOARD_URL}/canvas/${pageId}`}
           style={{ color: '#fff', textDecoration: 'underline' }}>
          ← Back to Editor
        </a>
        <form method="POST" action={`${BACKEND}/api/pages/${pageId}/publish`}
              style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <button type="submit" style={{
            background: '#fff', color: '#7C3AED', border: 'none',
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          }}>
            Publish Now
          </button>
        </form>
      </div>

      <div style={{ marginTop: 44 }}>
        <PreviewNav
          tree={tree}
          data={data}
          funnelContext={rendererFunnelContext}
          nextPreviewUrl={nextPreviewUrl}
        />
      </div>
    </>
  );
}
