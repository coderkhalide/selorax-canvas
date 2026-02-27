import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';
import { uploadToR2, r2Configured } from '../utils/r2';

const router = Router();

// GET /api/components — list components for tenant + global
router.get('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { search, category } = req.query;

    const where: any = {
      OR: [
        { tenantId: tenant.id },
        { tenantId: null, isPublic: true },
      ],
    };
    if (search) where.name = { contains: search as string };
    if (category) where.category = category as string;

    const components = await prisma.component.findMany({
      where,
      include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(components);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/components/:id
router.get('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const component = await prisma.component.findFirst({
      where: {
        id: req.params.id,
        OR: [{ tenantId: tenant.id }, { tenantId: null, isPublic: true }],
      },
      include: { versions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!component) return res.status(404).json({ error: 'Not found' });
    res.json(component);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/components
router.post('/', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { name, description, category, tags, schemaJson, aiPrompt } = req.body;

    const component = await prisma.component.create({
      data: {
        tenantId: tenant.id, name, description, category,
        tags: tags ? JSON.stringify(tags) : null,
        schemaJson: schemaJson ?? '{}',
        aiPrompt,
      },
    });
    res.status(201).json(component);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/components/:id
router.patch('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const existing = await prisma.component.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, description, category, tags, isPublic } = req.body;
    const component = await prisma.component.update({
      where: { id: req.params.id },
      data: { name, description, category, tags: tags ? JSON.stringify(tags) : undefined, isPublic },
    });
    res.json(component);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/components/:id/versions — upload compiled code to R2 + create ComponentVersion
// Body: { sourceCode: string, version?: string, changeSummary?: string, aiPrompt?: string }
router.post('/:id/versions', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const component = await prisma.component.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!component) return res.status(404).json({ error: 'Component not found' });

    const { sourceCode, version, changeSummary, aiPrompt } = req.body;
    if (!sourceCode) return res.status(400).json({ error: 'sourceCode required' });

    if (!r2Configured()) {
      return res.status(500).json({ error: 'R2 not configured (missing S3_* env vars)' });
    }

    const ver = version ?? incrementVersion(component.currentVersion);
    const key = `components/${tenant.id}/${component.id}/${ver}.js`;
    const compiledUrl = await uploadToR2(key, sourceCode);

    const cv = await prisma.componentVersion.create({
      data: {
        componentId:  component.id,
        version:      ver,
        sourceCode,
        compiledUrl,
        changeSummary: changeSummary ?? null,
        aiPrompt:      aiPrompt ?? null,
        isStable:      true,
      },
    });

    // Update component's currentVersion + currentUrl pointer
    await prisma.component.update({
      where: { id: component.id },
      data:  { currentVersion: ver, currentUrl: compiledUrl, updatedAt: new Date() },
    });

    res.status(201).json({ ok: true, versionId: cv.id, version: ver, compiledUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function incrementVersion(current: string): string {
  const parts = current.split('.').map(Number);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join('.');
}

// DELETE /api/components/:id
router.delete('/:id', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const existing = await prisma.component.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.component.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
