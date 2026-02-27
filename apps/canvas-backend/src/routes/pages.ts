import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';
import { publishPage } from '../publish';

const router = Router();

// GET /api/pages — list all pages for tenant
router.get('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const pages = await prisma.page.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pages/:id
router.get('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: { versions: { orderBy: { publishedAt: 'desc' }, take: 5 } },
    });
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pages — create page
router.post('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { slug, pageType = 'custom', title, metaTitle, metaDescription } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const page = await prisma.page.create({
      data: { tenantId: tenant.id, slug, pageType, title, metaTitle, metaDescription },
    });
    res.status(201).json(page);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Page with this slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pages/:id
router.patch('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { title, metaTitle, metaDescription, slug } = req.body;

    const existing = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const page = await prisma.page.update({
      where: { id: req.params.id },
      data: { title, metaTitle, metaDescription, slug },
    });
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pages/:id
router.delete('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const existing = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.page.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pages/:id/publish — full pipeline: STDB → MySQL → Redis → CDN
router.post('/:id/publish', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const result = await publishPage(req.params.id, tenant.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pages/:id/versions — version history
router.get('/:id/versions', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!page) return res.status(404).json({ error: 'Not found' });

    const versions = await prisma.pageVersion.findMany({
      where: { pageId: req.params.id, tenantId: tenant.id },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, pageId: true, tenantId: true, treeHash: true, publishedBy: true, publishedAt: true },
    });
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pages/:id/rollback/:versionId — rollback = pointer update
router.post('/:id/rollback/:versionId', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const version = await prisma.pageVersion.findFirst({
      where: { id: req.params.versionId, pageId: req.params.id, tenantId: tenant.id },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    await prisma.page.update({
      where: { id: req.params.id },
      data: { publishedVersionId: req.params.versionId, publishedAt: new Date() },
    });

    res.json({ ok: true, rolledBackTo: req.params.versionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
