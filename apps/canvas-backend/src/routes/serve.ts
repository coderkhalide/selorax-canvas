// Production serving API — storefront calls this for page JSON trees
// Public — no tenant middleware. tenantId is in the URL.
import { Router } from 'express';
import { prisma } from '../db';
import { redis }  from '../redis/client';

const router = Router();

// GET /api/serve/:tenantId/:pageType/:slug
router.get('/:tenantId/:pageType/:slug', async (req, res) => {
  const { tenantId, pageType, slug } = req.params;

  try {
    const cacheKey = `serve:${tenantId}:${pageType}:${slug}`;

    // 1. Redis fast path (skip if Redis unavailable)
    if (redis && redis.status === 'ready') {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
          return res.json(JSON.parse(cached));
        }
      } catch {
        // Redis miss — fall through to MySQL
      }
    }

    // 2. MySQL slow path
    const page = await prisma.page.findFirst({
      where: {
        tenantId, pageType, slug,
        publishedVersionId: { not: null },
      },
    });
    if (!page) return res.status(404).json({ error: 'Not found or not published' });

    const version = await prisma.pageVersion.findUnique({
      where: { id: page.publishedVersionId! },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    // Resolve funnel context
    let funnelContext = null;
    const funnelStep = await prisma.funnelStep.findFirst({
      where: { pageId: page.id },
    });
    if (funnelStep) {
      const nextStep = await prisma.funnelStep.findFirst({
        where: { funnelId: funnelStep.funnelId, stepOrder: funnelStep.stepOrder + 1 },
        include: { page: { select: { slug: true, pageType: true } } },
      });
      let parsedOnSuccess = null;
      try { parsedOnSuccess = funnelStep.onSuccess ? JSON.parse(funnelStep.onSuccess) : null; } catch { /* invalid JSON → treat as null */ }
      let parsedOnSkip = null;
      try { parsedOnSkip = funnelStep.onSkip ? JSON.parse(funnelStep.onSkip) : null; } catch { /* invalid JSON → treat as null */ }
      funnelContext = {
        funnelId:        funnelStep.funnelId,
        funnelStepOrder: funnelStep.stepOrder,
        nextStepUrl:     nextStep ? `/${nextStep.page.slug}` : null,
        isLastStep:      !nextStep,
        onSuccess:       parsedOnSuccess,
        onSkip:          parsedOnSkip,
      };
    }

    const payload = {
      tree: JSON.parse(version.tree),
      versionId: version.id,
      pageId: page.id,
      tenantId,
      funnelContext,
      experimentContext: null,
    };

    // 3. Populate cache if Redis available
    if (redis && redis.status === 'ready') {
      redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600).catch(() => {});
    }

    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/serve/:tenantId/funnel-nav/:pageId
// Preview-server calls this to resolve next funnel step for in-editor navigation.
// Public — no tenant middleware. Returns only funnel nav data, no tree.
router.get('/:tenantId/funnel-nav/:pageId', async (req, res) => {
  const { tenantId, pageId } = req.params;
  try {
    const funnelStep = await prisma.funnelStep.findFirst({
      where: { pageId, page: { tenantId } },
    });
    if (!funnelStep) return res.json({ funnelContext: null });

    const nextStep = await prisma.funnelStep.findFirst({
      where: { funnelId: funnelStep.funnelId, stepOrder: funnelStep.stepOrder + 1 },
      select: { pageId: true, page: { select: { slug: true } } },
    });

    res.json({
      funnelContext: {
        funnelId:        funnelStep.funnelId,
        funnelStepOrder: funnelStep.stepOrder,
        nextStepPageId:  nextStep?.pageId  ?? null,
        nextStepUrl:     nextStep ? `/${nextStep.page.slug}` : null,
        isLastStep:      !nextStep,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/serve/:tenantId/pages — list all published pages (for storefront routing)
router.get('/:tenantId/pages', async (req, res) => {
  try {
    const pages = await prisma.page.findMany({
      where: {
        tenantId: req.params.tenantId,
        publishedVersionId: { not: null },
      },
      select: { id: true, slug: true, pageType: true, title: true },
    });
    res.json(pages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
