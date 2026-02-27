// Dev-only routes — ONLY available when MVP_MODE=true
// Used for seeding test data and verifying infrastructure

import { Router }      from 'express';
import { prisma }      from '../db';
import { redis }       from '../redis/client';
import { callReducer, getPageNodes, opt } from '../spacetime/client';
import { getTenant }   from '../middleware/tenant';
import { publishPage } from '../publish';

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

// POST /api/dev/test-r2 — upload a minimal ESM component to R2 and verify it
router.post('/test-r2', async (_req, res) => {
  try {
    const endpoint  = process.env.S3_ENDPOINT!;
    const bucket    = process.env.S3_BUCKET!;
    const accessKey = process.env.S3_ACCESS_KEY!;
    const secretKey = process.env.S3_SECRET_KEY!;
    const publicUrl = process.env.S3_PUBLIC_URL!;

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      return res.status(500).json({ ok: false, error: 'R2 credentials not configured' });
    }

    // Minimal valid ESM React component
    const componentCode = `
// SeloraX Test Component — uploaded ${new Date().toISOString()}
export default function TestBanner({ settings = {}, data = {} }) {
  const { title = 'Hello from R2!', color = '#7C3AED' } = settings;
  return {
    type: 'div',
    props: {
      style: {
        padding: '20px', background: color, color: '#fff',
        fontFamily: 'system-ui', borderRadius: '8px', textAlign: 'center',
      },
      children: [
        { type: 'h2', props: { children: title, style: { margin: 0 } } },
        { type: 'p', props: { children: 'Store: ' + (data?.store?.name ?? 'Unknown'), style: { margin: '8px 0 0', opacity: 0.8 } } },
      ],
    },
  };
}
`.trim();

    const key     = `components/test-banner-${Date.now()}.js`;
    const putUrl  = `${endpoint}/${bucket}/${key}`;

    // AWS SigV4 signing for R2 upload
    const signed = await signRequest({
      method: 'PUT',
      url: putUrl,
      body: componentCode,
      contentType: 'application/javascript',
      accessKey,
      secretKey,
      region: 'auto',
      service: 's3',
    });

    const uploadRes = await fetch(putUrl, {
      method: 'PUT',
      headers: signed,
      body: componentCode,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      return res.status(500).json({ ok: false, uploadStatus: uploadRes.status, error: body.slice(0, 500) });
    }

    const publicComponentUrl = `${publicUrl}/${key}`;

    // Verify it's publicly accessible
    const verifyRes = await fetch(publicComponentUrl);
    const publicOk  = verifyRes.ok;
    const preview   = publicOk ? (await verifyRes.text()).slice(0, 100) : null;

    res.json({
      ok: true,
      uploadStatus: uploadRes.status,
      key,
      publicUrl: publicComponentUrl,
      publiclyAccessible: publicOk,
      preview,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
  }
});

// ── Minimal AWS SigV4 signer ──────────────────────────────────────────────────
import { createHmac, createHash } from 'crypto';

async function signRequest({
  method, url, body, contentType, accessKey, secretKey, region, service,
}: {
  method: string; url: string; body: string; contentType: string;
  accessKey: string; secretKey: string; region: string; service: string;
}): Promise<Record<string, string>> {
  const parsed    = new URL(url);
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // 20240101T120000Z
  const dateStamp = amzDate.slice(0, 8); // 20240101

  const payloadHash = createHash('sha256').update(body).digest('hex');

  const headers: Record<string, string> = {
    'host':                 parsed.host,
    'x-amz-date':          amzDate,
    'x-amz-content-sha256': payloadHash,
    'content-type':        contentType,
    'content-length':      Buffer.byteLength(body).toString(),
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('');

  const canonicalRequest = [
    method,
    parsed.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    ...headers,
    'authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

export default router;
