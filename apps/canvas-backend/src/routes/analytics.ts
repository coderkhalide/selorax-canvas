import { Router } from 'express';
import { prisma } from '../db';
import { getTenant } from '../middleware/tenant';

const router = Router();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// GET /api/analytics/pages/:pageId?days=30
router.get('/pages/:pageId', async (req, res) => {
  const tenant = getTenant(req);
  const pageId = req.params.pageId;
  const rawDays = parseInt((req.query.days as string) ?? '', 10);
  const days    = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 30;
  const since  = daysAgo(days);

  try {
    const [visitorsResult, conversionsResult] = await Promise.all([
      prisma.$queryRaw<[{ visitors: bigint }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: bigint; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    res.json({
      visitors,
      conversions,
      conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
      conversionValue: totalValue,
      experimentLift:  null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/funnels/:funnelId?days=30
router.get('/funnels/:funnelId', async (req, res) => {
  const tenant   = getTenant(req);
  const funnelId = req.params.funnelId;
  const rawDays = parseInt((req.query.days as string) ?? '', 10);
  const days    = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 30;
  const since    = daysAgo(days);

  try {
    const funnel = await prisma.funnel.findFirst({
      where:   { id: funnelId, tenantId: tenant.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!funnel) return res.status(404).json({ error: 'Funnel not found' });

    const stepCounts = await Promise.all(
      funnel.steps.map(step =>
        prisma.$queryRaw<[{ visitors: bigint }]>`
          SELECT COUNT(DISTINCT visitor_id) as visitors
          FROM conversion_events
          WHERE tenant_id  = ${tenant.id}
            AND page_id    = ${step.pageId}
            AND event_type = 'page_view'
            AND occurred_at >= ${since}
        `.then(r => ({ pageId: step.pageId, visitors: Number(r[0]?.visitors ?? 0) })),
      ),
    );

    const convResult = await prisma.$queryRaw<[{ conversions: bigint; total_value: number }]>`
      SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
      FROM conversion_events
      WHERE tenant_id  = ${tenant.id}
        AND funnel_id  = ${funnelId}
        AND event_type = 'conversion'
        AND occurred_at >= ${since}
    `;

    const firstStepVisitors = stepCounts[0]?.visitors ?? 0;

    res.json({
      funnelId: funnel.id,
      name:     funnel.name,
      steps: funnel.steps.map((step, i) => {
        const visitors = stepCounts[i]?.visitors ?? 0;
        const prev     = i === 0 ? firstStepVisitors : (stepCounts[i - 1]?.visitors ?? firstStepVisitors);
        const dropOff  = i === 0 ? 0 : prev > 0 ? Math.round(((prev - visitors) / prev) * 1000) / 10 : 0;
        return { stepOrder: step.stepOrder, pageId: step.pageId, name: step.name, visitors, dropOff };
      }),
      totalConversions: Number(convResult[0]?.conversions ?? 0),
      totalRevenue:     Number(convResult[0]?.total_value  ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/ai-context/:pageId?days=30
router.get('/ai-context/:pageId', async (req, res) => {
  const tenant = getTenant(req);
  const pageId = req.params.pageId;
  const rawDays = parseInt((req.query.days as string) ?? '', 10);
  const days    = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 30;
  const since  = daysAgo(days);

  try {
    const [visitorsResult, conversionsResult, recentEvents] = await Promise.all([
      prisma.$queryRaw<[{ visitors: bigint }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: bigint; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
      prisma.conversionEvent.findMany({
        where:   { tenantId: tenant.id, pageId },
        orderBy: { occurredAt: 'desc' },
        take:    100,
      }),
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    res.json({
      stats: {
        visitors,
        conversions,
        conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
        conversionValue: totalValue,
      },
      recentEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
