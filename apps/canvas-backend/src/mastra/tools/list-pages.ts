import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const listPagesTool = createTool({
  id: 'list_pages',
  description: 'List all pages for the tenant with their publish status.',
  inputSchema: z.object({
    tenant_id: z.string(),
  }),
  outputSchema: z.object({ pages: z.array(z.any()) }),
  execute: async (context) => {
    const pages = await prisma.page.findMany({
      where: { tenantId: context.tenant_id },
      select: {
        id: true, slug: true, pageType: true, title: true,
        publishedVersionId: true, publishedAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { pages };
  },
});
