import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';

const router = Router();

// GET /api/funnels
router.get('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const funnels = await prisma.funnel.findMany({
      where: { tenantId: tenant.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(funnels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/funnels/:id
router.get('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const funnel = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!funnel) return res.status(404).json({ error: 'Not found' });
    res.json(funnel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/funnels
router.post('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { name, goal, steps } = req.body;

    const funnel = await prisma.funnel.create({
      data: {
        tenantId: tenant.id, name, goal,
        steps: steps ? {
          create: steps.map((s: any, i: number) => ({
            pageId: s.pageId, stepOrder: i, stepType: s.stepType,
            name: s.name, onSuccess: JSON.stringify(s.onSuccess ?? {}),
            onSkip: s.onSkip ? JSON.stringify(s.onSkip) : null,
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    res.status(201).json(funnel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/funnels/:id
router.patch('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const existing = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, goal, status } = req.body;
    const funnel = await prisma.funnel.update({
      where: { id: req.params.id },
      data: { name, goal, status },
    });
    res.json(funnel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/funnels/:id
router.delete('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const existing = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.funnel.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
