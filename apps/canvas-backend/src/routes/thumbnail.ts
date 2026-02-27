import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';

const router = Router();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// POST /api/pages/:id/thumbnail
router.post('/:id/thumbnail', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let resolved = false;
      const bb = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
      bb.on('file', (_name, stream) => {
        stream.on('data', (d: Buffer) => chunks.push(d));
        stream.on('end', () => { resolved = true; resolve(Buffer.concat(chunks)); });
      });
      bb.on('finish', () => { if (!resolved) reject(new Error('No file field in multipart body')); });
      bb.on('error', reject);
      req.pipe(bb);
    });

    const key = `thumbnails/${tenant.id}/${req.params.id}.png`;
    await s3.send(new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET!,
      Key:         key,
      Body:        buffer,
      ContentType: 'image/png',
    }));

    const publicBase = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`;
    const thumbnailUrl = `${publicBase}/${key}`;

    const updated = await prisma.page.update({
      where: { id: req.params.id, tenantId: tenant.id },
      data:  { thumbnailUrl, thumbnailUpdatedAt: new Date() },
    });

    res.json({ thumbnailUrl: updated.thumbnailUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pages/:id/thumbnail-url — for AI tool to retrieve screenshot URL
router.get('/:id/thumbnail-url', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      select: { id: true, thumbnailUrl: true, thumbnailUpdatedAt: true },
    });
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json({ thumbnailUrl: page.thumbnailUrl ?? null, updatedAt: page.thumbnailUpdatedAt ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
