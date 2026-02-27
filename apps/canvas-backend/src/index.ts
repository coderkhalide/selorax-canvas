import express   from 'express';
import cors      from 'cors';
import { tenantMiddleware } from './middleware/tenant';
import pagesRouter      from './routes/pages';
import thumbnailRouter  from './routes/thumbnail';
import serveRouter      from './routes/serve';
import componentsRouter from './routes/components';
import funnelsRouter    from './routes/funnels';
import aiRouter         from './routes/ai';
import experimentsRouter from './routes/experiments';
import eventsRouter     from './routes/events';
import analyticsRouter  from './routes/analytics';
import devRouter        from './routes/dev';

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({
  status: 'ok', service: 'canvas-backend',
  tenant:   process.env.TENANT_ID ?? 'dynamic',
  mvpMode:  process.env.MVP_MODE === 'true',
  stdb:     process.env.SPACETIMEDB_URL,
}));

app.use('/api/pages',       tenantMiddleware, thumbnailRouter);
app.use('/api/pages',       tenantMiddleware, pagesRouter);
app.use('/api/serve',       serveRouter);           // public — no tenant middleware
app.use('/api/components',  tenantMiddleware, componentsRouter);
app.use('/api/funnels',     tenantMiddleware, funnelsRouter);
app.use('/api/ai',          tenantMiddleware, aiRouter);
app.use('/api/experiments', tenantMiddleware, experimentsRouter);
app.use('/api/events',      eventsRouter);          // public — fire-and-forget
app.use('/api/analytics',   tenantMiddleware, analyticsRouter);

// Dev/seed routes — only in MVP mode
if (process.env.MVP_MODE === 'true') {
  app.use('/api/dev', tenantMiddleware, devRouter);
}

// MCP endpoint
app.all('/mcp', async (req, res) => {
  try {
    const { mastra } = await import('./mastra');
    const mcp        = mastra.getMCPServer('seloraxMcp');
    const response   = await (mcp as any).handleRequest(req);
    res.status(response.status).json(response.body);
  } catch (err) {
    res.status(500).json({ error: 'MCP error' });
  }
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   SeloraX Canvas Backend                ║
║   Port:   ${PORT}                           ║
║   Tenant: ${process.env.TENANT_ID ?? 'dynamic'}               ║
║   STDB:   ${process.env.SPACETIMEDB_URL}  ║
╚══════════════════════════════════════════╝`);
});
