import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { publishPage } from '../../publish';

export const publishPageTool = createTool({
  id: 'publish_page',
  description: 'Publish a page. Only call with EXPLICIT user confirmation. Reads STDB → MySQL → Redis → CDN.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
  }),
  outputSchema: z.object({ version_id: z.string(), message: z.string() }),
  execute: async ({ context }) => {
    const result = await publishPage(context.page_id, context.tenant_id);
    return { version_id: result.id, message: `Page published. Version: ${result.id}` };
  },
});
