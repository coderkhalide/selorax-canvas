import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createPageTool = createTool({
  id: 'create_page',
  description: 'Create a new page for the tenant. Fails if the slug is already taken.',
  inputSchema: z.object({
    tenant_id: z.string(),
    title:     z.string(),
    slug:      z.string(),
    page_type: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    page:    z.object({ id: z.string(), title: z.string(), slug: z.string(), pageType: z.string() }).optional(),
    error:   z.string().optional(),
  }),
  execute: async (context) => {
    const tenantId  = context.tenant_id;
    const { title, slug, page_type: pageType } = context;

    // The unique constraint is @@unique([tenantId, pageType, slug]), so check all three fields.
    const existing = await prisma.page.findFirst({ where: { tenantId, slug, pageType } });
    if (existing) {
      return { success: false, error: 'Slug already taken' };
    }

    try {
      const page = await prisma.page.create({
        data: { tenantId, title, slug, pageType },
      });

      return {
        success: true,
        page: { id: page.id, title: page.title ?? '', slug: page.slug, pageType: page.pageType },
      };
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        return { success: false, error: 'Slug already taken for this page type' };
      }
      throw err;
    }
  },
});
