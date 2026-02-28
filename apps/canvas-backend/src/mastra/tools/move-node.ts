import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';

export const moveNodeTool = createTool({
  id: 'move_node',
  description: 'Move a node to a new parent or position.',
  inputSchema: z.object({
    tenant_id:    z.string(),
    node_id:      z.string(),
    new_parent_id: z.string().describe('New parent node ID'),
    new_order:    z.string().describe('New order string (fractional index)'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    await callReducer('move_node', {
      node_id:       context.node_id,
      new_parent_id: context.new_parent_id,
      new_order:     context.new_order,
    });
    return { message: `Node ${context.node_id} moved` };
  },
});
