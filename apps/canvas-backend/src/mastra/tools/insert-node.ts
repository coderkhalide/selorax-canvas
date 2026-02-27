import { createTool }    from '@mastra/core/tools';
import { z }             from 'zod';
import { callReducer }   from '../../spacetime/client';

export const insertNodeTool = createTool({
  id: 'insert_node',
  description: 'Insert a new canvas node. Changes appear live on the canvas instantly for all viewers.',
  inputSchema: z.object({
    tenant_id:         z.string().describe('Tenant ID — required'),
    page_id:           z.string().describe('Page ID'),
    parent_id:         z.string().describe('Parent node ID'),
    position:          z.string().describe('"first" | "last" | "after:<nodeId>"'),
    node_type:         z.enum(['layout', 'element', 'component', 'slot']),
    styles:            z.record(z.any()).optional().describe('CSS styles, supports _sm/_md/_lg/_hover'),
    props:             z.record(z.any()).optional().describe('Element props: tag, content, src, label, etc.'),
    settings:          z.record(z.any()).optional().describe('Component settings'),
    component_id:      z.string().optional(),
    component_url:     z.string().optional(),
    component_version: z.string().optional(),
  }),
  outputSchema: z.object({ node_id: z.string(), message: z.string() }),
  execute: async ({ context }) => {
    const id = crypto.randomUUID();
    await callReducer('insert_node', {
      id,
      page_id:           context.page_id,
      tenant_id:         context.tenant_id,
      parent_id:         context.parent_id,
      order:             resolveOrder(context.position),
      node_type:         context.node_type,
      styles:            JSON.stringify(context.styles    ?? {}),
      props:             JSON.stringify(context.props     ?? {}),
      settings:          JSON.stringify(context.settings  ?? {}),
      children_ids:      '[]',
      component_id:      context.component_id      ?? null,
      component_url:     context.component_url     ?? null,
      component_version: context.component_version ?? null,
    });
    return { node_id: id, message: 'Node inserted — visible on canvas now' };
  },
});

function resolveOrder(position: string): string {
  if (position === 'first') return 'a0';
  if (position === 'last')  return `z${Date.now().toString(36)}`;
  return `m${Date.now().toString(36)}`;
}
