import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';

export const updateNodeSettingsTool = createTool({
  id: 'update_node_settings',
  description: 'Update component settings. Patch-merged with existing settings.',
  inputSchema: z.object({
    tenant_id: z.string(),
    node_id:   z.string(),
    settings:  z.record(z.any()).describe('Component-specific settings to merge.'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    await callReducer('update_node_settings', {
      node_id:   context.node_id,
      tenant_id: context.tenant_id,
      settings:  JSON.stringify(context.settings),
    });
    return { message: `Settings updated for node ${context.node_id}` };
  },
});
