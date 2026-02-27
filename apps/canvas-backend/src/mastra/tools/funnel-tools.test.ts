import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    funnel: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
    },
    funnelStep: {
      delete:      vi.fn(),
      deleteMany:  vi.fn(),
      update:      vi.fn(),
      updateMany:  vi.fn(),
      create:      vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prismaMock };
});

vi.mock('../../db', () => ({ prisma: prismaMock }));

// ── Import tools AFTER mock ───────────────────────────────────────────────────
import { listFunnelsTool }       from './list-funnels';
import { createFunnelTool }      from './create-funnel';
import { updateFunnelStepsTool } from './update-funnel-steps';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeFunnel = (overrides = {}) => ({
  id:          'funnel-1',
  tenantId:    'tenant-abc',
  name:        'My Funnel',
  goal:        'Sell stuff',
  status:      'draft',
  aiGenerated: false,
  aiPrompt:    null,
  createdAt:   new Date('2024-01-01'),
  publishedAt: null,
  steps:       [],
  ...overrides,
});

const makeStep = (overrides = {}) => ({
  id:        'step-1',
  funnelId:  'funnel-1',
  pageId:    'page-1',
  stepOrder: 0,
  stepType:  null,
  name:      'Landing',
  onSuccess: '{}',
  onSkip:    null,
  ...overrides,
});

// ── list_funnels ──────────────────────────────────────────────────────────────
describe('list_funnels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of funnels with steps', async () => {
    const step    = makeStep();
    const funnel  = makeFunnel({ steps: [step] });
    prismaMock.funnel.findMany.mockResolvedValue([funnel]);

    const result = await listFunnelsTool.execute({ tenant_id: 'tenant-abc' } as any);

    expect(prismaMock.funnel.findMany).toHaveBeenCalledWith({
      where:   { tenantId: 'tenant-abc' },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    expect(result.funnels).toHaveLength(1);
    expect(result.funnels[0]).toMatchObject({
      id:          'funnel-1',
      name:        'My Funnel',
      description: 'Sell stuff',
      steps:       [{ id: 'step-1', name: 'Landing', pageId: 'page-1', order: 0 }],
    });
  });
});

// ── create_funnel ─────────────────────────────────────────────────────────────
describe('create_funnel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates funnel with steps and returns full object', async () => {
    const step   = makeStep();
    const funnel = makeFunnel({ steps: [step] });
    prismaMock.funnel.create.mockResolvedValue(funnel);

    const result = await createFunnelTool.execute({
      tenant_id:   'tenant-abc',
      name:        'My Funnel',
      description: 'Sell stuff',
      steps:       [{ name: 'Landing', pageId: 'page-1', order: 0 }],
    } as any);

    expect(result.success).toBe(true);
    expect(result.funnel).toMatchObject({
      id:          'funnel-1',
      name:        'My Funnel',
      description: 'Sell stuff',
      steps:       [{ id: 'step-1', name: 'Landing', pageId: 'page-1', order: 0 }],
    });

    expect(prismaMock.funnel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-abc',
          name:     'My Funnel',
          goal:     'Sell stuff',
        }),
      }),
    );
  });

  it('returns { success: false, error } when Prisma throws', async () => {
    prismaMock.funnel.create.mockRejectedValue(new Error('Unique constraint failed'));

    const result = await createFunnelTool.execute({
      tenant_id:   'tenant-abc',
      name:        'Duplicate',
      description: undefined,
      steps:       [],
    } as any);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unique constraint failed/);
    expect(result.funnel).toBeUndefined();
  });
});

// ── update_funnel_steps ───────────────────────────────────────────────────────
describe('update_funnel_steps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { success: false, error: "Funnel not found" } when funnel missing', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);

    const result = await updateFunnelStepsTool.execute({
      tenant_id: 'tenant-abc',
      funnel_id: 'nonexistent',
      steps:     [],
    } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Funnel not found');
  });

  it('calls $transaction, deletes removed steps, creates new steps, returns updated funnel', async () => {
    // Existing funnel has step-1 and step-2; we keep step-1, remove step-2, add a new one
    const existingStep1 = makeStep({ id: 'step-1', stepOrder: 0 });
    const existingStep2 = makeStep({ id: 'step-2', stepOrder: 1, name: 'Upsell' });
    const existingFunnel = makeFunnel({ steps: [existingStep1, existingStep2] });

    const newStep = makeStep({ id: 'step-3', stepOrder: 2, name: 'Thank You', pageId: 'page-3' });
    const updatedFunnel = makeFunnel({ steps: [existingStep1, newStep] });

    // First findFirst call returns the existing funnel
    prismaMock.funnel.findFirst
      .mockResolvedValueOnce(existingFunnel)  // ownership check
      .mockResolvedValueOnce(updatedFunnel);  // fetch after transaction

    // $transaction: call through so individual mocks are invoked
    prismaMock.$transaction.mockImplementation(async (queries: any[]) =>
      Promise.all(queries),
    );

    // Individual ops used inside transaction
    prismaMock.funnelStep.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.funnelStep.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.funnelStep.create.mockResolvedValue(newStep);

    const result = await updateFunnelStepsTool.execute({
      tenant_id: 'tenant-abc',
      funnel_id: 'funnel-1',
      steps: [
        { id: 'step-1', name: 'Landing',   pageId: 'page-1', order: 0 },
        { name: 'Thank You', pageId: 'page-3', order: 2 },          // new (no id)
      ],
    } as any);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    // step-2 should have been deleted (with funnelId for defense-in-depth)
    expect(prismaMock.funnelStep.deleteMany).toHaveBeenCalledWith({ where: { id: 'step-2', funnelId: 'funnel-1' } });
    // new step should have been created
    expect(prismaMock.funnelStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pageId: 'page-3', stepOrder: 2 }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.funnel).toMatchObject({ id: 'funnel-1', name: 'My Funnel' });
    expect(result.funnel?.steps).toHaveLength(2);
  });
});
