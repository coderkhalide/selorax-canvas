import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';

export const updateNodeStylesTool = createTool({
  id: 'update_node_styles',
  description: 'Update node styles. Patch-merged with existing styles. Supports responsive keys: _sm, _md, _lg, _hover.',
  inputSchema: z.object({
    tenant_id: z.string(),
    node_id:   z.string(),
    styles:    z.record(z.any()).describe('CSS properties to merge. Use _sm/_md/_lg for responsive.'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    await callReducer('update_node_styles', {
      node_id:   context.node_id,
      tenant_id: context.tenant_id,
      styles:    JSON.stringify(context.styles),
    });
    return { message: `Styles updated for node ${context.node_id}` };
  },
});
