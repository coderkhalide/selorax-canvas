import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';
import { prisma }      from '../../db';

export const injectComponentTool = createTool({
  id: 'inject_component',
  description: 'Inject an existing component into the canvas. Creates a component node at the specified position.',
  inputSchema: z.object({
    tenant_id:         z.string(),
    page_id:           z.string(),
    parent_id:         z.string(),
    position:          z.string().describe('"first" | "last" | "after:<nodeId>"'),
    component_id:      z.string(),
    component_url:     z.string().describe('CDN URL of the compiled ESM component'),
    component_version: z.string(),
    settings:          z.record(z.any()).optional().describe('Initial settings for this instance'),
    styles:            z.record(z.any()).optional(),
  }),
  outputSchema: z.object({ node_id: z.string(), message: z.string() }),
  execute: async ({ context }) => {
    const id = crypto.randomUUID();
    const order = context.position === 'first' ? 'a0'
      : context.position === 'last' ? `z${Date.now().toString(36)}`
      : `m${Date.now().toString(36)}`;

    await callReducer('insert_node', {
      id,
      page_id:           context.page_id,
      tenant_id:         context.tenant_id,
      parent_id:         context.parent_id,
      order,
      node_type:         'component',
      styles:            JSON.stringify(context.styles   ?? {}),
      props:             JSON.stringify({}),
      settings:          JSON.stringify(context.settings ?? {}),
      children_ids:      '[]',
      component_id:      context.component_id,
      component_url:     context.component_url,
      component_version: context.component_version,
    });

    return { node_id: id, message: `Component injected as node ${id}` };
  },
});
