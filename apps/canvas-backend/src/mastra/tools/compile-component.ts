import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { callReducer, opt } from '../../spacetime/client';
import { prisma }     from '../../db';
import { uploadToR2, r2Configured } from '../../utils/r2';

export const compileComponentTool = createTool({
  id: 'compile_component',
  description:
    'Upload the generated component code to the CDN (Cloudflare R2), save it to the database, ' +
    'and mark the component build as ready. Call this after stream_component_code. ' +
    'Returns the compiledUrl — pass it to inject_component.',
  inputSchema: z.object({
    tenant_id:    z.string(),
    build_id:     z.string().describe('Build ID from build_component'),
    component_id: z.string().describe('Component ID from build_component'),
    source_code:  z.string().describe('Full ESM/JSX source code to compile and upload'),
    ai_prompt:    z.string().optional().describe('The prompt used to generate this component'),
  }),
  outputSchema: z.object({
    compiled_url: z.string(),
    version:      z.string(),
    message:      z.string(),
  }),
  execute: async (context) => {
    if (!r2Configured()) {
      throw new Error('R2 is not configured (missing S3_* env vars). Cannot upload component.');
    }

    // Find component to get current version
    const component = await prisma.component.findFirst({
      where: { id: context.component_id, tenantId: context.tenant_id },
    });
    if (!component) {
      throw new Error(`Component ${context.component_id} not found for tenant ${context.tenant_id}`);
    }

    // Determine next version
    const parts = component.currentVersion.split('.').map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    const version = parts.join('.');

    // Upload to R2
    const key = `components/${context.tenant_id}/${context.component_id}/${version}.js`;
    const compiledUrl = await uploadToR2(key, context.source_code);

    // Save ComponentVersion in MySQL
    await prisma.componentVersion.create({
      data: {
        componentId:   context.component_id,
        version,
        sourceCode:    context.source_code,
        compiledUrl,
        changeSummary: 'AI generated',
        aiPrompt:      context.ai_prompt ?? null,
        isStable:      true,
      },
    });

    // Update Component pointer
    await prisma.component.update({
      where: { id: context.component_id },
      data:  { currentVersion: version, currentUrl: compiledUrl, updatedAt: new Date() },
    });

    // Mark build as ready in STDB — canvas shows green ✓
    await callReducer('update_component_build', {
      build_id:     context.build_id,
      status:       'ready',
      progress:     100,
      compiled_url: opt(compiledUrl),
      component_id: opt(context.component_id),
    });

    return {
      compiled_url: compiledUrl,
      version,
      message: `Component compiled and ready. URL: ${compiledUrl}. Now call inject_component with this URL.`,
    };
  },
});
