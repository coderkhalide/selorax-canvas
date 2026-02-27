import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const renamePageTool = createTool({
  id: 'rename_page',
  description: 'Rename a page title and/or change its slug. Only the fields provided are updated.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    new_title: z.string().optional(),
    new_slug:  z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    page:    z.object({ id: z.string(), title: z.string(), slug: z.string(), pageType: z.string() }).optional(),
    error:   z.string().optional(),
  }),
  execute: async (context) => {
    const tenantId = context.tenant_id;
    const { page_id, new_title, new_slug } = context;

    const existing = await prisma.page.findFirst({ where: { id: page_id, tenantId } });
    if (!existing) {
      return { success: false, error: 'Page not found' };
    }

    // If a new slug is requested and it differs from the current one, check it is not taken by another page.
    // The unique constraint is @@unique([tenantId, pageType, slug]), so check against the page's own pageType.
    if (new_slug !== undefined && new_slug !== existing.slug) {
      const slugTaken = await prisma.page.findFirst({
        where: { tenantId, slug: new_slug, pageType: existing.pageType, NOT: { id: page_id } },
      });
      if (slugTaken) {
        return { success: false, error: 'New slug already taken' };
      }
    }

    const updateData: { title?: string; slug?: string } = {};
    if (new_title !== undefined) updateData.title = new_title;
    if (new_slug  !== undefined) updateData.slug  = new_slug;

    // Tenant ownership verified above via findFirst — update by primary key only
    const page = await prisma.page.update({ where: { id: page_id }, data: updateData });

    return {
      success: true,
      page: { id: page.id, title: page.title ?? '', slug: page.slug, pageType: page.pageType },
    };
  },
});
