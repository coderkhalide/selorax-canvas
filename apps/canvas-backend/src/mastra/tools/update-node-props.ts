import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';

export const updateNodePropsTool = createTool({
  id: 'update_node_props',
  description: 'Update node props. Patch-merged. For elements: tag, content, src, alt, label, action.',
  inputSchema: z.object({
    tenant_id: z.string(),
    node_id:   z.string(),
    props:     z.record(z.any()).describe('Props to merge. Use {{store.name}} for token replacement.'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ context }) => {
    await callReducer('update_node_props', {
      node_id: context.node_id,
      props:   JSON.stringify(context.props),
    });
    return { message: `Props updated for node ${context.node_id}` };
  },
});
