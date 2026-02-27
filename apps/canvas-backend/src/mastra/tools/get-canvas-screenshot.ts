import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const getCanvasScreenshot = createTool({
  id: 'get_canvas_screenshot',
  description: 'Retrieve the latest screenshot of the canvas page as a base64-encoded image. Use this to visually inspect the current page layout.',
  inputSchema: z.object({
    tenant_id: z.string().describe('Tenant ID — required for isolation'),
    page_id:   z.string().describe('Page ID to fetch screenshot for'),
  }),
  outputSchema: z.union([
    z.object({
      hasScreenshot: z.literal(false),
      message: z.string(),
    }),
    z.object({
      hasScreenshot: z.literal(true),
      imageBase64: z.string(),
      mediaType: z.literal('image/png'),
      capturedAt: z.string().optional(),
      message: z.string(),
    }),
  ]),
  execute: async (context) => {
    const page = await prisma.page.findFirst({
      where: { id: context.page_id, tenantId: context.tenant_id },
      select: { id: true, thumbnailUrl: true, thumbnailUpdatedAt: true },
    });

    if (!page) {
      return {
        hasScreenshot: false as const,
        message: 'No screenshot available yet. Use publish_page or the Publish button to generate one.',
      };
    }

    if (!page.thumbnailUrl) {
      return {
        hasScreenshot: false as const,
        message: 'No screenshot available yet. Use publish_page or the Publish button to generate one.',
      };
    }

    try {
      const response = await fetch(page.thumbnailUrl);
      if (!response.ok) {
        await response.body?.cancel();
        return {
          hasScreenshot: false as const,
          message: `Failed to fetch screenshot: HTTP ${response.status} ${response.statusText}`,
        };
      }
      const arrayBuffer = await response.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
      return {
        hasScreenshot: true as const,
        imageBase64,
        mediaType: 'image/png' as const,
        capturedAt: page.thumbnailUpdatedAt?.toISOString(),
        message: 'Screenshot retrieved successfully',
      };
    } catch (err: any) {
      return {
        hasScreenshot: false as const,
        message: `Failed to fetch screenshot: ${err.message}`,
      };
    }
  },
});
