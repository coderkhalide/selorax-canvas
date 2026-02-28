import { createTool }    from '@mastra/core/tools';
import { z }             from 'zod';
import { callReducer, getPageNodes, opt } from '../../spacetime/client';
import { generateOrder, orderFirst, orderLast } from '../../utils/order';

// Exported for testing
export async function resolveInsertOrder(
  position: string,
  pageId: string,
  tenantId: string,
  parentId: string,
): Promise<string> {
  if (position === 'first') return orderFirst();
  if (position === 'last')  return orderLast();

  const afterId = position.startsWith('after:') ? position.slice(6) : null;
  if (!afterId) return orderLast();

  const nodes = await getPageNodes(pageId, tenantId);
  const siblings = nodes
    .filter(n => n.parent_id === (parentId === 'root' ? null : parentId))
    .sort((a, b) => a.order.localeCompare(b.order));

  const idx = siblings.findIndex(n => n.id === afterId);
  if (idx === -1) return orderLast();

  const after  = siblings[idx].order;
  const before = siblings[idx + 1]?.order;
  // Use orderLast() when appending after the last sibling to avoid unbounded string growth
  if (!before) return orderLast();
  return generateOrder(after, before);
}

export const insertNodeTool = createTool({
  id: 'insert_node',
  description: 'Create a new canvas node that appears live on all clients instantly. Returns the new node_id.',
  inputSchema: z.object({
    tenant_id:         z.string(),
    page_id:           z.string(),
    parent_id:         z.string().describe('Parent node id, or "root" for top-level'),
    position:          z.string().describe('"first" | "last" | "after:<nodeId>"'),
    node_type:         z.enum(['layout', 'element', 'component', 'slot']),
    styles:            z.record(z.any()).optional(),
    props:             z.record(z.any()).optional(),
    settings:          z.record(z.any()).optional(),
    component_id:      z.string().optional(),
    component_url:     z.string().optional(),
    component_version: z.string().optional(),
  }),
  outputSchema: z.object({ node_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const nodeId = crypto.randomUUID();
    const order  = await resolveInsertOrder(
      context.position,
      context.page_id,
      context.tenant_id,
      context.parent_id,
    );

    await callReducer('insert_node', {
      id:                nodeId,
      page_id:           context.page_id,
      tenant_id:         context.tenant_id,
      parent_id:         opt(context.parent_id === 'root' ? null : context.parent_id),
      order,
      node_type:         context.node_type,
      styles:            JSON.stringify(context.styles  ?? {}),
      props:             JSON.stringify(context.props   ?? {}),
      settings:          JSON.stringify(context.settings ?? {}),
      children_ids:      JSON.stringify([]),
      component_id:      opt(context.component_id),
      component_url:     opt(context.component_url),
      component_version: opt(context.component_version),
    });

    return { node_id: nodeId, message: `Node ${nodeId} inserted at position "${context.position}".` };
  },
});
