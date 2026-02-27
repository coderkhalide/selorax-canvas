// Node.js SpacetimeDB client — used by publish pipeline + AI tools
// One-shot connections: connect → fetch/call → disconnect
import { DbConnection, tables } from '../module_bindings';

const STDB_URL  = process.env.SPACETIMEDB_URL!;
const STDB_NAME = process.env.SPACETIMEDB_DB_NAME!;

export type CanvasNode = import('../module_bindings/canvas_node').CanvasNode;

// Read all flat nodes for a page (one-shot — connects, fetches, disconnects)
export async function getPageNodes(pageId: string, tenantId: string): Promise<CanvasNode[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SpacetimeDB timeout')), 10_000);

    DbConnection.builder()
      .withUri(STDB_URL)
      .withDatabaseName(STDB_NAME)
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
}

// Call a reducer from Express (used by AI tools)
export async function callReducer(
  name: string,
  args: Record<string, any>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Reducer timeout')), 5_000);

    DbConnection.builder()
      .withUri(STDB_URL)
      .withDatabaseName(STDB_NAME)
      .onConnect(ctx => {
        (ctx.reducers as any)[name](args);
        // Give the reducer time to execute before disconnecting
        setTimeout(() => {
          clearTimeout(timer);
          ctx.disconnect();
          resolve();
        }, 300);
      })
      .onConnectError((_ctx, err) => { clearTimeout(timer); reject(err); })
      .build();
  });
}
