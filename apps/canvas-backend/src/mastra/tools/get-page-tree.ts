import { createTool }   from '@mastra/core/tools';
import { z }            from 'zod';
import { getPageNodes } from '../../spacetime/client';
import { buildTree }    from '../../utils/tree';

export const getPageTreeTool = createTool({
  id: 'get_page_tree',
  description: 'Get the full page as a nested tree. ALWAYS call this first before making any changes.',
  inputSchema:  z.object({
    tenant_id: z.string().describe('Tenant ID — required for isolation'),
    page_id:   z.string().describe('Page ID to fetch'),
  }),
  outputSchema: z.object({ tree: z.any(), node_count: z.number() }),
  execute: async ({ context }) => {
    const flatNodes = await getPageNodes(context.page_id, context.tenant_id);
    return { tree: buildTree(flatNodes), node_count: flatNodes.length };
  },
});
