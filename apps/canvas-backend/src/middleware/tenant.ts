import { Request, Response, NextFunction } from 'express';
import type { Tenant } from '@selorax/types';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.MVP_MODE === 'true') {
    (req as any).tenant = {
      id:     process.env.TENANT_ID!,
      name:   process.env.TENANT_NAME!,
      domain: process.env.TENANT_DOMAIN!,
      plan:   process.env.TENANT_PLAN ?? 'pro',
    } satisfies Tenant;
    return next();
  }

  // Production: resolve from x-tenant-id header
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

  // In production this would look up full tenant from DB
  (req as any).tenant = {
    id:     tenantId,
    name:   (req.headers['x-tenant-name'] as string) ?? tenantId,
    domain: (req.headers['x-tenant-domain'] as string) ?? '',
    plan:   (req.headers['x-tenant-plan'] as string) ?? 'starter',
  } satisfies Tenant;

  next();
}

export const getTenant = (req: Request): Tenant => (req as any).tenant;
