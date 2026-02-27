import { Router }      from 'express';
import { getTenant }   from '../middleware/tenant';
import { callReducer } from '../spacetime/client';

const router = Router();

// POST /api/ai/canvas — trigger canvas agent, stream response
router.post('/canvas', async (req, res) => {
  const tenant = getTenant(req);
  const { prompt, page_id, selected_node_id } = req.body;

  if (!prompt || !page_id)
    return res.status(400).json({ error: 'prompt and page_id required' });

  // Create AI operation in SpacetimeDB — all canvas clients see it instantly
  const op_id = crypto.randomUUID();
  await callReducer('create_ai_operation', {
    id: op_id, page_id, tenant_id: tenant.id, prompt,
  });

  // Stream response
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Operation-Id', op_id);

  try {
    const { mastra } = await import('../mastra');
    const agent      = mastra.getAgent('canvasAgent');

    const stream = await agent.stream(
      `Tenant ID: ${tenant.id}\nPage ID: ${page_id}\n` +
      (selected_node_id ? `Selected node: ${selected_node_id}\n` : '') +
      `User request: ${prompt}`,
      { runtimeContext: { op_id, tenant_id: tenant.id, page_id } }
    );

    for await (const chunk of stream.textStream) res.write(chunk);
  } catch (err: any) {
    console.error('[AI] Error:', err.message);
    // Update op to error state
    await callReducer('update_ai_operation', {
      op_id, status: 'error',
      current_action: `Error: ${err.message}`, progress: 0,
    }).catch(() => {});
    res.write(`\n[Error: ${err.message}]`);
  } finally {
    res.end();
  }
});

export default router;
