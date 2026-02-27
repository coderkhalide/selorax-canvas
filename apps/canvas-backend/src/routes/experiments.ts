import { Router }    from 'express';
import { prisma }    from '../db';
import { redis }     from '../redis/client';
import { getTenant } from '../middleware/tenant';

const router = Router();

// GET /api/experiments
router.get('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const experiments = await prisma.experiment.findMany({
      where: { tenantId: tenant.id },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(experiments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/experiments/:id
router.get('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const experiment = await prisma.experiment.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: {
        variants: true,
        snapshots: { orderBy: { snapshotAt: 'desc' }, take: 20 },
        analyses:  { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!experiment) return res.status(404).json({ error: 'Not found' });
    res.json(experiment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/experiments
router.post('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { pageId, name, hypothesis, primaryMetric, trafficMode, variants } = req.body;

    const experiment = await prisma.experiment.create({
      data: {
        tenantId: tenant.id, pageId, name, hypothesis,
        primaryMetric: primaryMetric ?? 'conversion_rate',
        trafficMode: trafficMode ?? 'sticky',
        variants: variants ? {
          create: variants.map((v: any) => ({
            tenantId: tenant.id, pageId,
            name: v.name, description: v.description,
            pageVersionId: v.pageVersionId,
            trafficWeight: v.trafficWeight ?? 0.5,
            isControl: v.isControl ?? false,
          })),
        } : undefined,
      },
      include: { variants: true },
    });
    res.status(201).json(experiment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/experiments/:id/start — start experiment
router.patch('/:id/start', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const experiment = await prisma.experiment.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: { variants: true },
    });
    if (!experiment) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.experiment.update({
      where: { id: req.params.id },
      data: { status: 'running', startedAt: new Date() },
    });

    // Cache experiment config in Redis for fast serving
    const cacheKey = `exp:page:${tenant.id}:${experiment.pageId}`;
    await redis.set(cacheKey, JSON.stringify({
      experimentId: experiment.id,
      variants: experiment.variants,
    }), 'EX', 86400 * 30); // 30 days

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/experiments/:id/stop
router.patch('/:id/stop', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const experiment = await prisma.experiment.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!experiment) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.experiment.update({
      where: { id: req.params.id },
      data: { status: 'paused', endedAt: new Date() },
    });

    // Remove from Redis serve cache
    const cacheKey = `exp:page:${tenant.id}:${experiment.pageId}`;
    await redis.del(cacheKey);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
