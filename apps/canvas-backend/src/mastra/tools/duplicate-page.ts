import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const duplicatePageTool = createTool({
  id: 'duplicate_page',
  description:
    'Duplicate an existing page (MySQL record only). The duplicate starts with an empty canvas — SpacetimeDB nodes are NOT copied.',
  inputSchema: z.object({
    tenant_id:      z.string(),
    source_page_id: z.string(),
    new_title:      z.string(),
    new_slug:       z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    page:    z.object({ id: z.string(), title: z.string(), slug: z.string(), pageType: z.string() }).optional(),
    note:    z.string().optional(),
    error:   z.string().optional(),
  }),
  execute: async (context) => {
    const tenantId = context.tenant_id;
    const { source_page_id, new_title, new_slug } = context;

    const sourcePage = await prisma.page.findFirst({ where: { id: source_page_id, tenantId } });
    if (!sourcePage) {
      return { success: false, error: 'Source page not found' };
    }

    // The unique constraint is @@unique([tenantId, pageType, slug]), so check all three fields.
    const slugTaken = await prisma.page.findFirst({ where: { tenantId, slug: new_slug, pageType: sourcePage.pageType } });
    if (slugTaken) {
      return { success: false, error: 'New slug already taken' };
    }

    try {
      const page = await prisma.page.create({
        data: {
          tenantId,
          title:    new_title,
          slug:     new_slug,
          pageType: sourcePage.pageType,
        },
      });

      return {
        success: true,
        page: { id: page.id, title: page.title ?? '', slug: page.slug, pageType: page.pageType },
        note: 'Canvas nodes are NOT copied — the duplicate starts with an empty canvas. The AI or user must rebuild the design.',
      };
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        return { success: false, error: 'Slug already taken for this page type' };
      }
      throw err;
    }
  },
});
