// Fire-and-forget event ingestion — called via sendBeacon from storefront
// Queued in Redis, bulk-flushed to MySQL async
import { Router } from 'express';
import { redis }  from '../redis/client';

const router = Router();

// POST /api/events — fire-and-forget
router.post('/', async (req, res) => {
  // Respond immediately — never block the client
  res.status(204).send();

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    if (!events.length) return;

    // Push events to Redis queue for async processing
    const pipeline = redis.pipeline();
    for (const event of events) {
      pipeline.rpush('events:queue', JSON.stringify({
        ...event,
        receivedAt: new Date().toISOString(),
      }));
    }
    await pipeline.exec();

    // Flush to MySQL when queue is large enough
    const queueLen = await redis.llen('events:queue');
    if (queueLen >= 100) {
      setImmediate(() => flushEvents().catch(console.error));
    }
  } catch (err) {
    // Silently fail — events are best-effort
    console.error('[Events] Queue error:', err);
  }
});

async function flushEvents() {
  const { prisma } = await import('../db');

  const batch: string[] = [];
  // Pop up to 100 events
  for (let i = 0; i < 100; i++) {
    const item = await redis.lpop('events:queue');
    if (!item) break;
    batch.push(item);
  }

  if (!batch.length) return;

  const events = batch.map(s => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);

  try {
    await prisma.conversionEvent.createMany({
      data: events.map((e: any) => ({
        tenantId:    e.tenantId,
        experimentId: e.experimentId,
        variantId:   e.variantId,
        sessionId:   e.sessionId,
        visitorId:   e.visitorId,
        eventType:   e.eventType,
        elementId:   e.elementId ?? null,
        elementLabel: e.elementLabel ?? null,
        value:       e.value ?? null,
        metadata:    e.metadata ? JSON.stringify(e.metadata) : null,
        occurredAt:  e.occurredAt ? new Date(e.occurredAt) : new Date(),
      })),
      skipDuplicates: true,
    });
    console.log(`[Events] Flushed ${events.length} events to MySQL`);
  } catch (err) {
    console.error('[Events] Flush error:', err);
    // Re-queue events on failure
    for (const s of batch) await redis.rpush('events:queue', s);
  }
}

export default router;
