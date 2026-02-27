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

    const payload = {
      tree: JSON.parse(version.tree),
      versionId: version.id,
      pageId: page.id,
      tenantId,
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
