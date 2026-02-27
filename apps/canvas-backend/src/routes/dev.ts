// Dev-only routes — ONLY available when MVP_MODE=true
// Used for seeding test data and verifying infrastructure

import { Router }      from 'express';
import { prisma }      from '../db';
import { redis }       from '../redis/client';
import { callReducer, getPageNodes, opt } from '../spacetime/client';
import { getTenant }   from '../middleware/tenant';
import { publishPage } from '../publish';
import { uploadToR2, r2Configured } from '../utils/r2';

const router = Router();

// POST /api/dev/seed — create a test page with canvas nodes + publish it
router.post('/seed', async (req, res) => {
  try {
    const tenant  = getTenant(req);
    const tenantId = tenant.id;
    const slug    = req.body.slug ?? `test-${Date.now()}`;
    const pageType = req.body.pageType ?? 'home';

    // 1. Create (or find existing) page in MySQL
    let page = await prisma.page.findFirst({ where: { tenantId, slug, pageType } });
    if (!page) {
      page = await prisma.page.create({
        data: { tenantId, slug, pageType, title: req.body.title ?? 'Test Page' },
      });
    }

    const pageId = page.id;

    // 2. Insert sample canvas nodes into SpacetimeDB
    const rootId   = crypto.randomUUID();
    const heroId   = crypto.randomUUID();
    const headingId = crypto.randomUUID();
    const textId   = crypto.randomUUID();
    const buttonId = crypto.randomUUID();

    const nodes = [
      {
        id: rootId, page_id: pageId, tenant_id: tenantId, parent_id: null,
        order: 'a0', node_type: 'layout',
        styles: JSON.stringify({ display: 'flex', flexDirection: 'column', minHeight: '100vh' }),
        props: JSON.stringify({ tag: 'div' }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([heroId]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: heroId, page_id: pageId, tenant_id: tenantId, parent_id: opt(rootId),
        order: 'a0', node_type: 'layout',
        styles: JSON.stringify({
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 20px', background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
          color: '#fff', textAlign: 'center',
        }),
        props: JSON.stringify({ tag: 'section' }),
        settings: JSON.stringify({}),
        children_ids: JSON.stringify([headingId, textId, buttonId]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: headingId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a0', node_type: 'element',
        styles: JSON.stringify({ fontSize: '48px', fontWeight: '700', marginBottom: '16px', color: '#fff' }),
        props: JSON.stringify({ tag: 'heading', level: 1, content: 'Welcome to {{store.name}}' }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: textId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a1', node_type: 'element',
        styles: JSON.stringify({ fontSize: '18px', maxWidth: '600px', marginBottom: '32px', opacity: '0.9' }),
        props: JSON.stringify({ tag: 'text', content: 'Build stunning pages with AI-powered tools.' }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: buttonId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a2', node_type: 'element',
        styles: JSON.stringify({
          display: 'inline-block', padding: '16px 40px', background: '#fff',
          color: '#7C3AED', fontWeight: '700', fontSize: '16px', borderRadius: '8px', cursor: 'pointer',
        }),
        props: JSON.stringify({ tag: 'button', label: 'Get Started', action: { type: 'link', url: '/products' } }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
    ];

    for (const node of nodes) {
      await callReducer('insert_node', node);
    }

    res.json({
      ok: true,
      page: { id: pageId, slug, pageType, tenantId },
      nodesInserted: nodes.length,
      nodeIds: { rootId, heroId, headingId, textId, buttonId },
      message: `Seeded ${nodes.length} nodes. Call POST /api/pages/${pageId}/publish to publish.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
  }
});

// POST /api/dev/seed-and-publish — seed + publish in one shot
router.post('/seed-and-publish', async (req, res) => {
  try {
    const tenant   = getTenant(req);
    const tenantId = tenant.id;
    const slug     = req.body.slug ?? 'index';
    const pageType = req.body.pageType ?? 'home';

    // Seed via internal logic (reuse seed route logic)
    let page = await prisma.page.findFirst({ where: { tenantId, slug, pageType } });
    if (!page) {
      page = await prisma.page.create({
        data: { tenantId, slug, pageType, title: req.body.title ?? 'Home Page' },
      });
    }

    const pageId = page.id;

    // Insert nodes
    const rootId   = crypto.randomUUID();
    const heroId   = crypto.randomUUID();
    const headingId = crypto.randomUUID();
    const textId   = crypto.randomUUID();
    const btnId    = crypto.randomUUID();

    const nodes = [
      {
        id: rootId, page_id: pageId, tenant_id: tenantId, parent_id: null,
        order: 'a0', node_type: 'layout',
        styles: JSON.stringify({ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }),
        props: JSON.stringify({ tag: 'div' }), settings: JSON.stringify({}),
        children_ids: JSON.stringify([heroId]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: heroId, page_id: pageId, tenant_id: tenantId, parent_id: opt(rootId),
        order: 'a0', node_type: 'layout',
        styles: JSON.stringify({
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 20px', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          color: '#fff', textAlign: 'center',
        }),
        props: JSON.stringify({ tag: 'section' }), settings: JSON.stringify({}),
        children_ids: JSON.stringify([headingId, textId, btnId]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: headingId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a0', node_type: 'element',
        styles: JSON.stringify({ fontSize: '56px', fontWeight: '800', margin: '0 0 16px', lineHeight: '1.1' }),
        props: JSON.stringify({ tag: 'heading', level: 1, content: 'Welcome to {{store.name}}' }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: textId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a1', node_type: 'element',
        styles: JSON.stringify({ fontSize: '20px', maxWidth: '600px', margin: '0 0 40px', opacity: '0.85', lineHeight: '1.6' }),
        props: JSON.stringify({ tag: 'text', content: 'AI-powered page builder. Design, test, and ship stunning pages in minutes.' }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
      {
        id: btnId, page_id: pageId, tenant_id: tenantId, parent_id: opt(heroId),
        order: 'a2', node_type: 'element',
        styles: JSON.stringify({
          display: 'inline-block', padding: '18px 48px', background: '#fff',
          color: '#7C3AED', fontWeight: '700', fontSize: '18px',
          borderRadius: '12px', cursor: 'pointer', border: 'none',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }),
        props: JSON.stringify({ tag: 'button', label: 'Shop Now', action: { type: 'link', url: '/products' } }),
        settings: JSON.stringify({}), children_ids: JSON.stringify([]),
        component_id: null, component_url: null, component_version: null,
      },
    ];

    for (const node of nodes) {
      await callReducer('insert_node', node);
    }

    // Wait for STDB consistency then publish
    await new Promise(r => setTimeout(r, 500));
    const published = await publishPage(pageId, tenantId);

    res.json({
      ok: true,
      page: { id: pageId, slug, pageType, tenantId },
      nodesInserted: nodes.length,
      published,
      serveUrl: `/api/serve/${tenantId}/${pageType}/${slug}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
});

// GET /api/dev/stdb-health — verify STDB connection + node count
router.get('/stdb-health', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const { pageId } = req.query as { pageId?: string };

    if (!pageId) {
      return res.status(400).json({ error: 'pageId query param required' });
    }

    const nodes = await getPageNodes(pageId, tenant.id);
    res.json({
      ok: true,
      nodeCount: nodes.length,
      nodeIds: nodes.map(n => n.id),
      nodeTypes: nodes.map(n => ({ id: n.id, type: n.node_type })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/dev/redis-health — verify Redis
router.get('/redis-health', async (_req, res) => {
  try {
    if (!redis || redis.status !== 'ready') {
      return res.json({ ok: false, status: redis?.status ?? 'null', message: 'Redis not ready' });
    }
    await redis.set('health-check', 'ok', 'EX', 10);
    const val = await redis.get('health-check');
    res.json({ ok: val === 'ok', status: redis.status, message: 'Redis read/write OK' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/dev/seed-component — full end-to-end component test:
// create component in MySQL → compile ESM → upload to R2 → inject into home page → publish
router.post('/seed-component', async (req, res) => {
  try {
    const tenant   = getTenant(req);
    const tenantId = tenant.id;
    const slug     = req.body.slug ?? 'index';
    const pageType = req.body.pageType ?? 'home';

    if (!r2Configured()) {
      return res.status(500).json({ ok: false, error: 'R2 not configured' });
    }

    // 1. Find existing home page
    const page = await prisma.page.findFirst({ where: { tenantId, slug, pageType } });
    if (!page) {
      return res.status(404).json({ ok: false, error: 'Page not found — run seed-and-publish first' });
    }

    // 2. Create component record in MySQL
    const component = await prisma.component.create({
      data: {
        tenantId,
        name:        'TestBanner',
        description: 'A simple banner component loaded from Cloudflare R2',
        category:    'banner',
        schemaJson:  JSON.stringify({
          title: { type: 'string', default: 'Hello from R2!', label: 'Title' },
          color: { type: 'color',  default: '#7C3AED', label: 'Background color' },
        }),
        origin:  'dev',
        isPublic: false,
        currentVersion: '1.0.0',
      },
    });

    // 3. ESM component — uses React.createElement so it works via dynamic import
    //    No hooks → no multiple-React-instance issues
    const sourceCode = `
// SeloraX TestBanner component — ${new Date().toISOString()}
// ESM component loaded from Cloudflare R2 via dynamic import
import { createElement as h } from 'https://esm.sh/react@18.3.1';

export default function TestBanner({ settings = {}, data = {} }) {
  const { title = 'Hello from R2!', color = '#7C3AED' } = settings;
  return h('div', {
    style: {
      padding: '32px 20px',
      background: color,
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '12px',
      textAlign: 'center',
      margin: '24px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    },
  },
    h('h2', { style: { margin: '0 0 8px', fontSize: '28px', fontWeight: 800 } }, title),
    h('p', { style: { margin: 0, opacity: 0.85 } }, 'Store: ' + (data?.store?.name ?? 'Unknown')),
    h('p', { style: { margin: '8px 0 0', fontSize: '12px', opacity: 0.6 } }, '✅ Loaded from Cloudflare R2'),
  );
}
`.trim();

    // 4. Upload ESM to R2
    const key = `components/${tenantId}/${component.id}/1.0.0.js`;
    const compiledUrl = await uploadToR2(key, sourceCode);

    // 5. Create ComponentVersion in MySQL
    await prisma.componentVersion.create({
      data: {
        componentId:   component.id,
        version:       '1.0.0',
        sourceCode,
        compiledUrl,
        changeSummary: 'Initial version — dev seed',
        isStable:      true,
      },
    });

    // Update component with URL
    await prisma.component.update({
      where: { id: component.id },
      data:  { currentUrl: compiledUrl },
    });

    // 6. Find the root layout node in STDB so we can parent the component correctly
    const existingNodes = await getPageNodes(page.id, tenantId);
    const rootNode = existingNodes.find(n => !n.parent_id) ?? null;

    const nodeId = crypto.randomUUID();
    await callReducer('insert_node', {
      id:                nodeId,
      page_id:           page.id,
      tenant_id:         tenantId,
      parent_id:         opt(rootNode?.id ?? null),  // child of root, or root if none exists
      order:             'b0',       // after 'a0' hero
      node_type:         'component',
      styles:            JSON.stringify({ width: '100%' }),
      props:             JSON.stringify({}),
      settings:          JSON.stringify({ title: 'Loaded from R2!', color: '#059669' }),
      children_ids:      '[]',
      component_id:      opt(component.id),
      component_url:     opt(compiledUrl),
      component_version: opt('1.0.0'),
    });

    // 7. Publish the page (STDB → MySQL → Redis)
    await new Promise(r => setTimeout(r, 500));
    const published = await publishPage(page.id, tenantId);

    res.json({
      ok: true,
      component: { id: component.id, name: 'TestBanner', compiledUrl },
      nodeId,
      published,
      serveUrl: `/api/serve/${tenantId}/${pageType}/${slug}`,
      storefront: `http://localhost:3003`,
      note: 'PageRenderer will dynamic-import the component from R2 in the browser',
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
});

// POST /api/dev/test-r2 — upload a minimal ESM component to R2 and verify it
router.post('/test-r2', async (_req, res) => {
  try {
    if (!r2Configured()) {
      return res.status(500).json({ ok: false, error: 'R2 credentials not configured' });
    }

    const componentCode = `
// SeloraX Test Component — ${new Date().toISOString()}
import { createElement as h } from 'https://esm.sh/react@18.3.1';
export default function TestBanner({ settings = {}, data = {} }) {
  const { title = 'Hello from R2!', color = '#7C3AED' } = settings;
  return h('div', {
    style: { padding: '20px', background: color, color: '#fff',
      fontFamily: 'system-ui', borderRadius: '8px', textAlign: 'center' },
  },
    h('h2', { style: { margin: 0 } }, title),
    h('p',  { style: { margin: '8px 0 0', opacity: 0.8 } }, 'Store: ' + (data?.store?.name ?? 'Unknown')),
  );
}`.trim();

    const key = `components/test-banner-${Date.now()}.js`;
    const publicComponentUrl = await uploadToR2(key, componentCode);

    // Verify it's publicly accessible
    const verifyRes = await fetch(publicComponentUrl);
    const preview   = verifyRes.ok ? (await verifyRes.text()).slice(0, 100) : null;

    res.json({ ok: true, key, publicUrl: publicComponentUrl,
      publiclyAccessible: verifyRes.ok, preview });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
