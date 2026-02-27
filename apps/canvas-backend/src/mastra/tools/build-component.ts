import { createTool }  from '@mastra/core/tools';
import { z }           from 'zod';
import { callReducer } from '../../spacetime/client';
import { prisma }      from '../../db';

export const buildComponentTool = createTool({
  id: 'build_component',
  description: 'AI-generate a new React component. Streams code live to canvas via SpacetimeDB. Always search_components first.',
  inputSchema: z.object({
    tenant_id:    z.string(),
    operation_id: z.string().describe('The current AI operation ID'),
    name:         z.string().describe('Component name'),
    description:  z.string().describe('What the component does'),
    schema:       z.record(z.any()).optional().describe('Settings schema for this component'),
    prompt:       z.string().describe('Full AI prompt for generation'),
  }),
  outputSchema: z.object({ build_id: z.string(), component_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const build_id     = crypto.randomUUID();
    const component_id = crypto.randomUUID();

    // Create component in MySQL
    const component = await prisma.component.create({
      data: {
        id: component_id,
        tenantId:   context.tenant_id,
        name:       context.name,
        description: context.description,
        schemaJson: JSON.stringify(context.schema ?? {}),
        origin:     'ai',
        aiPrompt:   context.prompt,
      },
    });

    // Create build row in STDB — canvas clients see it instantly
    await callReducer('create_component_build', {
      id:           build_id,
      tenant_id:    context.tenant_id,
      operation_id: context.operation_id,
      description:  context.description,
    });

    return {
      build_id,
      component_id: component.id,
      message: `Build started. Stream code with stream_component_code tool. Build ID: ${build_id}`,
    };
  },
});
