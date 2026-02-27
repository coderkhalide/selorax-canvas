import { DbConnection, tables } from '@/module_bindings';
import { PageRenderer }         from '@selorax/renderer';
import { buildTree }            from '@/utils/tree';

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
    // One-shot: connect → subscribe → get nodes → disconnect
    flatNodes = await new Promise<any[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview timeout after 10s')), 10_000);

      DbConnection.builder()
        .withUri(process.env.SPACETIMEDB_URL!)
        .withDatabaseName(process.env.SPACETIMEDB_DB_NAME!)
        .onConnect(ctx => {
          ctx.subscriptionBuilder()
            .onApplied(() => {
              const nodes = Array.from(ctx.db.canvas_node.iter())
                .filter(n => n.page_id === pageId && n.tenant_id === tenantId);
              clearTimeout(timer);
              ctx.disconnect();
              resolve(nodes);
            })
            .subscribe([
              tables.canvas_node.where(r =>
                r.page_id.eq(pageId).and(r.tenant_id.eq(tenantId))
              ),
            ]);
        })
        .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
        .build();
    });
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
        <form method="POST" action={`${process.env.BACKEND_URL}/api/pages/${pageId}/publish`}
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
        <PageRenderer tree={tree} data={data} />
      </div>
    </>
  );
}
