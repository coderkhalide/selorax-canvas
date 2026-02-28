import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { callReducer } from '../../spacetime/client';

export const streamComponentCodeTool = createTool({
  id: 'stream_component_code',
  description:
    'Send the generated component source code to the canvas in real-time. ' +
    'Call this after generating the component code so users can see it live. ' +
    'Pass the full JSX/ESM source as code_chunk.',
  inputSchema: z.object({
    build_id:   z.string().describe('Build ID returned by build_component'),
    code_chunk: z.string().describe('Full JSX/ESM source code of the component'),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (context) => {
    await callReducer('stream_component_code', {
      build_id:   context.build_id,
      code_chunk: context.code_chunk,
    });
    return { ok: true };
  },
});
