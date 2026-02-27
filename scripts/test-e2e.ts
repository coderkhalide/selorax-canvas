#!/usr/bin/env tsx
/**
 * SeloraX Canvas — End-to-End Backend Test Suite
 *
 * Tests: backend API, SpacetimeDB, publish pipeline, storefront, R2 component upload, preview server
 *
 * Run: npm run test:e2e (from repo root)
 * Or:  cd scripts && tsx test-e2e.ts
 */

import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(import.meta.dirname ?? __dirname, '../.env') });

const BACKEND  = 'http://localhost:3001';
const STORE    = 'http://localhost:3003';
const PREVIEW  = 'http://localhost:3004';
const TENANT   = process.env.TENANT_ID ?? 'store_001';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32m✓\x1b[0m');
    passed++;
  } catch (err: any) {
    console.log(`\x1b[31m✗\x1b[0m  ${err.message}`);
    failed++;
    failures.push(`${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function json(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function section(title: string) {
  console.log(`\n\x1b[1m\x1b[34m▶ ${title}\x1b[0m`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

section('1. Backend Health');

await test('GET /health returns ok', async () => {
  const { status, body } = await json(`${BACKEND}/health`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.status === 'ok', `Expected status=ok, got ${body.status}`);
  assert(body.mvpMode === true, 'Expected mvpMode=true');
  assert(body.tenant === TENANT, `Expected tenant=${TENANT}, got ${body.tenant}`);
  console.log(`\n    tenant=${body.tenant} stdb=${body.stdb}`);
});

// ── Pages API ─────────────────────────────────────────────────────────────────
section('2. Pages API');

let pageId: string;
let pageSlug = `e2e-test-${Date.now()}`;

await test('GET /api/pages — list pages (empty or existing)', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
  console.log(`\n    ${body.length} existing pages`);
});

await test('POST /api/pages — create test page', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages`, {
    method: 'POST',
    body: JSON.stringify({ slug: pageSlug, pageType: 'custom', title: 'E2E Test Page' }),
  });
  assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
  assert(body.id, 'Expected page.id');
  assert(body.tenantId === TENANT, `Expected tenantId=${TENANT}`);
  pageId = body.id;
  console.log(`\n    pageId=${pageId}`);
});

await test('POST /api/pages — duplicate slug returns 409', async () => {
  const { status } = await json(`${BACKEND}/api/pages`, {
    method: 'POST',
    body: JSON.stringify({ slug: pageSlug, pageType: 'custom' }),
  });
  assert(status === 409, `Expected 409, got ${status}`);
});

await test('GET /api/pages/:id — get page by id', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.id === pageId, 'Expected matching id');
});

await test('PATCH /api/pages/:id — update title', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated E2E Title' }),
  });
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.title === 'Updated E2E Title', 'Expected updated title');
});

// ── SpacetimeDB via Dev Seed ──────────────────────────────────────────────────
section('3. SpacetimeDB — Insert Nodes via Dev Seed');

await test('POST /api/dev/seed — insert canvas nodes into STDB', async () => {
  const { status, body } = await json(`${BACKEND}/api/dev/seed`, {
    method: 'POST',
    body: JSON.stringify({ slug: pageSlug, pageType: 'custom', title: 'E2E Test Page' }),
  });
  // Seed finds existing page (same slug+pageType)
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
  assert(body.ok === true, `Expected ok=true: ${JSON.stringify(body)}`);
  assert(body.nodesInserted >= 5, `Expected ≥5 nodes, got ${body.nodesInserted}`);
  console.log(`\n    ${body.nodesInserted} nodes in STDB for page ${body.page.id}`);
});

await test('GET /api/dev/stdb-health — verify nodes readable from STDB', async () => {
  const { status, body } = await json(`${BACKEND}/api/dev/stdb-health?pageId=${pageId}`);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.ok, `STDB health failed: ${body.error}`);
  assert(body.nodeCount >= 5, `Expected ≥5 nodes in STDB, got ${body.nodeCount}`);
  console.log(`\n    ${body.nodeCount} nodes verified in STDB`);
});

// ── Publish Pipeline ──────────────────────────────────────────────────────────
section('4. Publish Pipeline (STDB → MySQL → Redis → CDN)');

let publishedVersionId: string;

await test('POST /api/pages/:id/publish — full pipeline', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}/publish`, {
    method: 'POST',
  });
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
  assert(body.id, 'Expected version id');
  assert(body.pageId === pageId, 'Expected matching pageId');
  publishedVersionId = body.id;
  console.log(`\n    versionId=${publishedVersionId}`);
});

await test('GET /api/pages/:id/versions — version history', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}/versions`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
  assert(body.length >= 1, 'Expected at least 1 version');
  assert(body[0].id === publishedVersionId, 'Latest version should match published');
});

await test('Publish dedup — same content returns same version id', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}/publish`, {
    method: 'POST',
  });
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.id === publishedVersionId, `Expected same versionId (dedup), got ${body.id}`);
});

await test('GET /api/pages/:id — publishedVersionId set', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.publishedVersionId === publishedVersionId, 'publishedVersionId should be set');
});

// ── Serve API ─────────────────────────────────────────────────────────────────
section('5. Serve API (Redis-first → MySQL fallback)');

await test(`GET /api/serve/${TENANT}/custom/${pageSlug} — serve published page`, async () => {
  const { status, body } = await json(`${BACKEND}/api/serve/${TENANT}/custom/${pageSlug}`);
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  assert(body.tree, 'Expected tree in response');
  assert(body.versionId, 'Expected versionId');
  assert(body.pageId === pageId, 'Expected matching pageId');
  const nodeCount = countNodes(body.tree);
  assert(nodeCount >= 5, `Expected ≥5 nodes in tree, got ${nodeCount}`);
  console.log(`\n    tree has ${nodeCount} nodes, versionId=${body.versionId}`);
});

await test('GET /api/serve/:tenantId/pages — list published pages', async () => {
  const { status, body } = await json(`${BACKEND}/api/serve/${TENANT}/pages`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
  const our = body.find((p: any) => p.id === pageId);
  assert(our, `Our page not in published list`);
});

await test(`GET /api/serve/${TENANT}/custom/does-not-exist — 404 for unpublished`, async () => {
  const { status } = await json(`${BACKEND}/api/serve/${TENANT}/custom/does-not-exist-xyz`);
  assert(status === 404, `Expected 404, got ${status}`);
});

// ── Storefront ────────────────────────────────────────────────────────────────
section('6. Storefront — End-to-End Page Rendering');

await test('GET localhost:3003/ — storefront root (home page)', async () => {
  // Storefront serves home/index — may 404 if home page not seeded yet
  const res = await fetch(`${STORE}/`);
  assert(res.status === 200, `Storefront root returned ${res.status} (hint: seed home page if 404)`);
  const html = await res.text();
  assert(html.includes('<'), 'Expected HTML response');
  console.log(`\n    ${html.length} bytes of HTML`);
});

// ── Rollback ──────────────────────────────────────────────────────────────────
section('7. Rollback');

await test('POST /api/pages/:id/rollback/:versionId — rollback to v1', async () => {
  const { status, body } = await json(`${BACKEND}/api/pages/${pageId}/rollback/${publishedVersionId}`, {
    method: 'POST',
  });
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.ok === true, 'Expected ok=true');
  assert(body.rolledBackTo === publishedVersionId, 'Expected correct versionId');
});

// ── Components API ────────────────────────────────────────────────────────────
section('8. Components API');

let componentId: string;

await test('GET /api/components — list components', async () => {
  const { status, body } = await json(`${BACKEND}/api/components`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
  console.log(`\n    ${body.length} components`);
});

await test('POST /api/components — create test component', async () => {
  const { status, body } = await json(`${BACKEND}/api/components`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E Test Banner',
      description: 'Test component created by e2e suite',
      category: 'hero',
      schemaJson: JSON.stringify({ title: { type: 'string', default: 'Hello' } }),
      aiPrompt: 'A simple banner with title and subtitle',
    }),
  });
  assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
  assert(body.id, 'Expected component id');
  componentId = body.id;
});

await test('GET /api/components/:id — get component', async () => {
  const { status, body } = await json(`${BACKEND}/api/components/${componentId}`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(body.name === 'E2E Test Banner', 'Expected matching name');
});

await test('GET /api/components?search=Banner — search components', async () => {
  const { status, body } = await json(`${BACKEND}/api/components?search=Banner`);
  assert(status === 200, `Expected 200, got ${status}`);
  const found = body.find((c: any) => c.id === componentId);
  assert(found, 'Our component should appear in search results');
});

// ── R2 Component Upload ───────────────────────────────────────────────────────
section('9. Cloudflare R2 — ESM Component Upload');

await test('POST /api/dev/test-r2 — upload ESM component to R2 + verify public access', async () => {
  const { status, body } = await json(`${BACKEND}/api/dev/test-r2`, { method: 'POST' });
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
  assert(body.ok, `R2 upload failed: ${body.error}`);
  assert(body.publiclyAccessible, `File uploaded but not publicly accessible at ${body.publicUrl}`);
  console.log(`\n    Uploaded to: ${body.publicUrl}`);
  console.log(`    Public: ${body.publiclyAccessible}`);
  console.log(`    Preview: ${body.preview?.slice(0, 60)}...`);
});

// ── Funnels API ───────────────────────────────────────────────────────────────
section('10. Funnels API');

await test('GET /api/funnels — list funnels', async () => {
  const { status, body } = await json(`${BACKEND}/api/funnels`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
});

await test('POST /api/funnels — create funnel with steps', async () => {
  const { status, body } = await json(`${BACKEND}/api/funnels`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E Test Funnel',
      goal: 'Increase conversions',
      steps: [
        { pageId, stepOrder: 1, name: 'Landing', onSuccess: { type: 'next' } },
      ],
    }),
  });
  assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
  assert(body.id, 'Expected funnel id');
  assert(body.steps?.length === 1, 'Expected 1 step');
});

// ── Experiments API ───────────────────────────────────────────────────────────
section('11. Experiments API');

await test('GET /api/experiments — list experiments', async () => {
  const { status, body } = await json(`${BACKEND}/api/experiments`);
  assert(status === 200, `Expected 200, got ${status}`);
  assert(Array.isArray(body), 'Expected array');
});

await test('POST /api/experiments — create A/B experiment', async () => {
  const { status, body } = await json(`${BACKEND}/api/experiments`, {
    method: 'POST',
    body: JSON.stringify({
      pageId,
      name: 'E2E Headline Test',
      hypothesis: 'Shorter headline improves CTR',
      variants: [
        { name: 'Control', pageVersionId: publishedVersionId, trafficWeight: 0.5, isControl: true },
        { name: 'Variant B', pageVersionId: publishedVersionId, trafficWeight: 0.5, isControl: false },
      ],
    }),
  });
  assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
  assert(body.id, 'Expected experiment id');
  assert(body.variants?.length === 2, 'Expected 2 variants');
});

// ── Events API ────────────────────────────────────────────────────────────────
section('12. Events API (fire-and-forget)');

await test('POST /api/events — fire page_view event (204)', async () => {
  const res = await fetch(`${BACKEND}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'page_view', tenantId: TENANT, pageId, visitorId: 'e2e-visitor-001',
      device: 'desktop', referrer: 'direct',
    }),
  });
  assert(res.status === 204, `Expected 204, got ${res.status}`);
});

await test('POST /api/events — fire cta_click event (204)', async () => {
  const res = await fetch(`${BACKEND}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'cta_click', tenantId: TENANT, pageId, visitorId: 'e2e-visitor-001',
      elementId: 'btn-hero', elementLabel: 'Shop Now',
    }),
  });
  assert(res.status === 204, `Expected 204, got ${res.status}`);
});

// ── Preview Server ────────────────────────────────────────────────────────────
section('13. Preview Server');

await test(`GET localhost:3004/${pageId} — preview live STDB state`, async () => {
  const res = await fetch(`${PREVIEW}/${pageId}?tenantId=${TENANT}`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const html = await res.text();
  assert(html.includes('Preview'), `Expected preview banner in HTML (got ${html.length} bytes)`);
  console.log(`\n    ${html.length} bytes preview HTML`);
});

// ── Redis Health ──────────────────────────────────────────────────────────────
section('14. Redis');

await test('GET /api/dev/redis-health — Redis status', async () => {
  const { status, body } = await json(`${BACKEND}/api/dev/redis-health`);
  assert(status === 200, `Expected 200, got ${status}`);
  // Redis may be unavailable in local dev — warn but don't fail
  if (!body.ok) {
    console.log(`\n    \x1b[33m⚠ Redis not ready (${body.status ?? 'null'}) — app runs on MySQL fallback\x1b[0m`);
  } else {
    console.log(`\n    Redis status: ${body.status}`);
  }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
section('15. Cleanup');

await test('DELETE /api/pages/:id — delete test page', async () => {
  const { status } = await json(`${BACKEND}/api/pages/${pageId}`, { method: 'DELETE' });
  assert(status === 200, `Expected 200, got ${status}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
const total = passed + failed;
if (failed === 0) {
  console.log(`\x1b[32m✓ All ${total} tests passed\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ ${failed}/${total} tests failed\x1b[0m`);
  console.log('\nFailed tests:');
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function countNodes(node: any): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((sum: number, child: any) => sum + countNodes(child), 0);
}
