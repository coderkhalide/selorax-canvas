import { Mastra }      from '@mastra/core/mastra';
import { canvasAgent } from './agents/canvas-agent';
import { seloraxMcp }  from './mcp/server';

export const mastra = new Mastra({
  agents:     { canvasAgent },
  mcpServers: { seloraxMcp },
});
