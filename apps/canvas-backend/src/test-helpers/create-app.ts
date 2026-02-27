// apps/canvas-backend/src/test-helpers/create-app.ts
import express from 'express';
import type { Tenant } from '@selorax/types';
import pagesRouter      from '../routes/pages';
import serveRouter      from '../routes/serve';
import componentsRouter from '../routes/components';
import funnelsRouter    from '../routes/funnels';
import experimentsRouter from '../routes/experiments';
import eventsRouter     from '../routes/events';

export function createTestApp() {
  const app = express();
  app.use(express.json());

  // MVP tenant middleware — always injects a fixed test tenant
  // Mirrors what tenantMiddleware does in production, satisfies Tenant shape
  app.use((req, _res, next) => {
    (req as any).tenant = {
      id:     'test-tenant',
      name:   'Test Store',
      domain: 'test.selorax.com',
      plan:   'pro',
    } satisfies Tenant;
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Tenant-scoped routes
  app.use('/api/pages',       pagesRouter);
  app.use('/api/components',  componentsRouter);
  app.use('/api/funnels',     funnelsRouter);
  app.use('/api/experiments', experimentsRouter);

  // Public routes — no tenant middleware in production either
  app.use('/api/serve',  serveRouter);
  app.use('/api/events', eventsRouter);

  return app;
}
