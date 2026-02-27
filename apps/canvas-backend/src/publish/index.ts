import { prisma }        from '../db';
import { redis }         from '../redis/client';
import { getPageNodes }  from '../spacetime/client';
import { buildTree }     from '../utils/tree';
import { createHash }    from 'crypto';

export async function publishPage(pageId: string, tenantId: string) {
  // 1. Verify ownership
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
  });
  if (!page) throw new Error('Page not found or access denied');

  // 2. Read live nodes from SpacetimeDB Maincloud
  const flatNodes = await getPageNodes(pageId, tenantId);
  if (!flatNodes.length) throw new Error('No nodes — open canvas editor first');

  // 3. Build + serialize
  const tree     = buildTree(flatNodes);
  const clean    = stripCanvasMetadata(tree);
  const treeJson = JSON.stringify(clean);
  const treeHash = createHash('sha256').update(treeJson).digest('hex');

  // 4. Dedup — same content?
  const existing = await prisma.pageVersion.findFirst({
    where: { pageId, treeHash },
  });

  let versionId: string;

  if (existing) {
    versionId = existing.id;
  } else {
    // 5. Save new immutable version (never mutated — rollback = pointer update only)
    const version = await prisma.pageVersion.create({
      data: { pageId, tenantId, tree: treeJson, treeHash, publishedBy: 'system' },
    });
    versionId = version.id;
  }

  // 6. Update page pointer (this is the rollback mechanism — just change the pointer)
  await prisma.page.update({
    where: { id: pageId },
    data:  { publishedVersionId: versionId, publishedAt: new Date() },
  });

  // 7. Warm Redis cache (1 hour TTL) — skip if Redis unavailable
  const cacheKey = `serve:${tenantId}:${page.pageType}:${page.slug}`;
  if (redis && redis.status === 'ready') {
    await redis.set(cacheKey, JSON.stringify({
      tree: clean, versionId, updatedAt: new Date().toISOString(),
    }), 'EX', 3600).catch(() => {});
  }

  // 8. Purge Cloudflare (if configured)
  if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: [`tenant-${tenantId}`, `page-${pageId}`] }),
      }
    );
  }

  console.log(`[publish] ${pageId} → version ${versionId} (tenant: ${tenantId})`);
  return { id: versionId, pageId, tenantId, publishedAt: new Date() };
}

function stripCanvasMetadata(node: any): any {
  if (!node) return null;
  const { lockedBy, lockedAt, updatedBy, updatedAt, ...clean } = node;
  if (clean.children) clean.children = clean.children.map(stripCanvasMetadata);
  return clean;
}
