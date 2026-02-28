import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';

export const deleteNodeTool = createTool({
  id: 'delete_node',
  description: 'Delete a node and all its children (cascade). Use carefully.',
  inputSchema: z.object({
    tenant_id: z.string(),
    node_id:   z.string().describe('Node ID to delete (will cascade to all children)'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    await callReducer('delete_node_cascade', { node_id: context.node_id });
    return { message: `Node ${context.node_id} and all children deleted` };
  },
});
