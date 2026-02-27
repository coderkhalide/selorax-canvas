import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findFirst: vi.fn(),
    },
    pageVersion: {
      findMany: vi.fn(),
    },
    experiment: {
      findFirst:   vi.fn(),
      create:      vi.fn(),
      update:      vi.fn(),
      updateMany:  vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../../db', () => ({ prisma: prismaMock }));

// ── Import tools AFTER mock ───────────────────────────────────────────────────
import { createExperimentTool }     from './create-experiment';
import { activateExperimentTool }   from './activate-experiment';
import { getExperimentResultsTool } from './get-experiment-results';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeExperiment = (overrides = {}) => ({
  id:              'exp-1',
  tenantId:        'tenant-abc',
  pageId:          'page-1',
  name:            'Hero Test',
  status:          'draft',
  primaryMetric:   'conversion_rate',
  trafficMode:     'sticky',
  minSampleSize:   500,
  analysisWindowDays: 7,
  confidenceThreshold: 0.95,
  winnerVariantId: null,
  winnerReason:    null,
  startedAt:       null,
  endedAt:         null,
  scheduledEndAt:  null,
  aiGenerated:     false,
  aiPrompt:        null,
  createdAt:       new Date('2024-01-01'),
  funnelId:        null,
  hypothesis:      null,
  variants:        [],
  ...overrides,
});

const makeVariant = (overrides = {}) => ({
  id:              'variant-1',
  experimentId:    'exp-1',
  tenantId:        'tenant-abc',
  pageId:          'page-1',
  name:            'Control',
  description:     null,
  pageVersionId:   'ver-1',
  trafficWeight:   0.5,
  isControl:       true,
  status:          'active',
  aiGenerated:     false,
  aiChangeSummary: null,
  createdAt:       new Date('2024-01-01'),
  snapshots:       [],
  ...overrides,
});

const makePage = (overrides = {}) => ({
  id:       'page-1',
  tenantId: 'tenant-abc',
  slug:     'home',
  pageType: 'landing',
  title:    'Home',
  ...overrides,
});

// ── create_experiment ─────────────────────────────────────────────────────────
describe('create_experiment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pageVersion.findMany.mockResolvedValue([{ id: 'ver-1' }, { id: 'ver-2' }]);
  });

  it('returns success: false when fewer than 2 variants are provided', async () => {
    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-1',
      name:      'Test',
      variants:  [{ name: 'A', trafficPercent: 100, pageVersionId: 'ver-1' }],
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/at least 2 variants/);
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.experiment.create).not.toHaveBeenCalled();
  });

  it('returns success: false when traffic percentages sum to more than 100', async () => {
    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-1',
      name:      'Test',
      variants:  [
        { name: 'A', trafficPercent: 70, pageVersionId: 'ver-1' },
        { name: 'B', trafficPercent: 50, pageVersionId: 'ver-1' },
      ],
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/sum to 100 or less/);
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.experiment.create).not.toHaveBeenCalled();
  });

  it('returns success: false when the page is not found for this tenant', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-missing',
      name:      'Test',
      variants:  [
        { name: 'A', trafficPercent: 50, pageVersionId: 'ver-1' },
        { name: 'B', trafficPercent: 50, pageVersionId: 'ver-1' },
      ],
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toBe('Page not found');
    expect(prismaMock.experiment.create).not.toHaveBeenCalled();
  });

  it('creates experiment with variants and returns correct shape on success', async () => {
    const variant1 = makeVariant({ id: 'variant-1', name: 'Control', trafficWeight: 0.5 });
    const variant2 = makeVariant({ id: 'variant-2', name: 'Treatment', trafficWeight: 0.5, isControl: false });
    const experiment = makeExperiment({ variants: [variant1, variant2] });

    prismaMock.page.findFirst.mockResolvedValue(makePage());
    prismaMock.experiment.create.mockResolvedValue(experiment);

    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-1',
      name:      'Hero Test',
      variants:  [
        { name: 'Control',   trafficPercent: 50, pageVersionId: 'ver-1' },
        { name: 'Treatment', trafficPercent: 50, pageVersionId: 'ver-1' },
      ],
      goal_metric: 'click_rate',
    } as any);

    expect(result.success).toBe(true);
    const exp = (result as any).experiment;
    expect(exp.id).toBe('exp-1');
    expect(exp.name).toBe('Hero Test');
    expect(exp.status).toBe('draft');
    expect(exp.goalMetric).toBeDefined();
    expect(exp.variants).toHaveLength(2);
    expect(exp.variants[0]).toMatchObject({ id: 'variant-1', name: 'Control', trafficPercent: 50 });

    expect(prismaMock.page.findFirst).toHaveBeenCalledWith({
      where: { id: 'page-1', tenantId: 'tenant-abc' },
    });
    expect(prismaMock.experiment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId:      'tenant-abc',
          pageId:        'page-1',
          name:          'Hero Test',
          status:        'draft',
          primaryMetric: 'click_rate',
        }),
        include: { variants: true },
      }),
    );
  });

  it('uses default goal_metric of "conversion_rate" when not provided', async () => {
    const experiment = makeExperiment({ variants: [makeVariant(), makeVariant({ id: 'variant-2', name: 'B' })] });
    prismaMock.page.findFirst.mockResolvedValue(makePage());
    prismaMock.experiment.create.mockResolvedValue(experiment);

    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-1',
      name:      'No Metric',
      variants:  [
        { name: 'A', trafficPercent: 50, pageVersionId: 'ver-1' },
        { name: 'B', trafficPercent: 50, pageVersionId: 'ver-1' },
      ],
    } as any);

    expect(result.success).toBe(true);
    expect(prismaMock.experiment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ primaryMetric: 'conversion_rate' }),
      }),
    );
  });

  it('returns success: false on DB error', async () => {
    prismaMock.page.findFirst.mockResolvedValue(makePage());
    prismaMock.experiment.create.mockRejectedValue(new Error('DB connection lost'));

    const result = await createExperimentTool.execute({
      tenant_id: 'tenant-abc',
      page_id:   'page-1',
      name:      'Error Test',
      variants:  [
        { name: 'A', trafficPercent: 50, pageVersionId: 'ver-1' },
        { name: 'B', trafficPercent: 50, pageVersionId: 'ver-1' },
      ],
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/DB connection lost/);
  });

  it('returns error when total traffic is 0', async () => {
    const result = await createExperimentTool.execute({ tenant_id: 't1', page_id: 'page-1', name: 'Test', variants: [{ name: 'A', trafficPercent: 0, pageVersionId: 'ver-1' }, { name: 'B', trafficPercent: 0, pageVersionId: 'ver-2' }] } as any);
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/greater than 0/);
  });

  it('returns error when pageVersionIds are not valid for tenant', async () => {
    prismaMock.page.findFirst.mockResolvedValue(makePage());
    prismaMock.pageVersion.findMany.mockResolvedValue([{ id: 'ver-1' }]); // only 1 found, but 2 requested
    const result = await createExperimentTool.execute({ tenant_id: 't1', page_id: 'page-1', name: 'Test', variants: [{ name: 'A', trafficPercent: 50, pageVersionId: 'ver-1' }, { name: 'B', trafficPercent: 50, pageVersionId: 'ver-FOREIGN' }] } as any);
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/pageVersionIds/);
  });
});

// ── activate_experiment ───────────────────────────────────────────────────────
describe('activate_experiment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success: false when experiment is not found', async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);

    const result = await activateExperimentTool.execute({
      tenant_id:     'tenant-abc',
      experiment_id: 'nonexistent',
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toBe('Experiment not found');
    expect(prismaMock.experiment.updateMany).not.toHaveBeenCalled();
  });

  it('returns success: false when experiment is already active', async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(makeExperiment({ status: 'active' }));

    const result = await activateExperimentTool.execute({
      tenant_id:     'tenant-abc',
      experiment_id: 'exp-1',
    } as any);

    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/active/);
    expect(prismaMock.experiment.updateMany).not.toHaveBeenCalled();
  });

  it('updates status to active with startedAt and returns correct shape', async () => {
    const startedAt = new Date('2024-06-01T10:00:00Z');
    const updatedExperiment = makeExperiment({ status: 'active', startedAt });
    prismaMock.experiment.findFirst
      .mockResolvedValueOnce(makeExperiment({ status: 'draft' }))
      .mockResolvedValueOnce(updatedExperiment);
    prismaMock.experiment.updateMany.mockResolvedValue({ count: 1 });

    const result = await activateExperimentTool.execute({
      tenant_id:     'tenant-abc',
      experiment_id: 'exp-1',
    } as any);

    expect(result.success).toBe(true);
    const exp = (result as any).experiment;
    expect(exp.id).toBe('exp-1');
    expect(exp.name).toBe('Hero Test');
    expect(exp.status).toBe('active');
    expect(exp.startedAt).toBe(startedAt.toISOString());

    expect(prismaMock.experiment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-1', tenantId: 'tenant-abc' },
        data:  expect.objectContaining({
          status:    'active',
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns error when experiment is not in draft status', async () => {
    prismaMock.experiment.findFirst.mockResolvedValue({ id: 'exp-1', name: 'Test', status: 'completed' });
    const result = await activateExperimentTool.execute({ tenant_id: 't1', experiment_id: 'exp-1' } as any);
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/completed/);
  });
});

// ── get_experiment_results ────────────────────────────────────────────────────
describe('get_experiment_results', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns hasResults: false when experiment is not found', async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);

    const result = await getExperimentResultsTool.execute({
      tenant_id:     'tenant-abc',
      experiment_id: 'nonexistent',
    } as any);

    expect(result.hasResults).toBe(false);
    expect((result as any).message).toBe('Experiment not found');
  });

  it('returns experiment with variant results including latestSnapshot', async () => {
    const snapshot = {
      id:             'snap-1',
      experimentId:   'exp-1',
      variantId:      'variant-1',
      tenantId:       'tenant-abc',
      snapshotAt:     new Date('2024-06-01'),
      visitors:       200,
      pageViews:      220,
      ctaClicks:      40,
      checkoutsStarted: 20,
      purchases:      15,
      revenue:        750,
      ctaClickRate:   0.2,
      conversionRate: 0.075,
      revenuePerVisitor: 3.75,
      scroll25Rate:   null,
      scroll50Rate:   null,
      scroll75Rate:   null,
      scroll100Rate:  null,
      periodStart:    null,
      periodEnd:      null,
    };

    const variant1 = makeVariant({ id: 'variant-1', name: 'Control',   trafficWeight: 0.5, snapshots: [snapshot] });
    const variant2 = makeVariant({ id: 'variant-2', name: 'Treatment', trafficWeight: 0.5, snapshots: [] });
    const experiment = makeExperiment({ status: 'active', variants: [variant1, variant2] });

    prismaMock.experiment.findFirst.mockResolvedValue(experiment);

    const result = await getExperimentResultsTool.execute({
      tenant_id:     'tenant-abc',
      experiment_id: 'exp-1',
    } as any);

    expect(result.hasResults).toBe(true);
    const exp = (result as any).experiment;
    expect(exp.id).toBe('exp-1');
    expect(exp.name).toBe('Hero Test');
    expect(exp.status).toBe('active');
    expect(exp.goalMetric).toBe('conversion_rate');
    expect(exp.variants).toHaveLength(2);

    const control = exp.variants[0];
    expect(control.id).toBe('variant-1');
    expect(control.name).toBe('Control');
    expect(control.trafficPercent).toBe(50);
    expect(control.latestSnapshot).toMatchObject({
      conversions:    15,
      visitors:       200,
      conversionRate: 0.075,
    });

    const treatment = exp.variants[1];
    expect(treatment.latestSnapshot).toBeNull();

    expect(prismaMock.experiment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { id: 'exp-1', tenantId: 'tenant-abc' },
        include: expect.objectContaining({
          variants: expect.objectContaining({
            include: expect.objectContaining({
              snapshots: { orderBy: { snapshotAt: 'desc' }, take: 1 },
            }),
          }),
        }),
      }),
    );
  });
});
