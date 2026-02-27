// apps/canvas-backend/src/test-helpers/mocks.ts
import { vi } from 'vitest';

export const prismaMock = {
  page: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pageVersion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  component: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  componentVersion: {
    create: vi.fn(),
  },
  funnel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  experiment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversionEvent: {
    createMany: vi.fn(),
    count: vi.fn(),
  },
};

export function resetMocks() {
  Object.values(prismaMock).forEach(model => {
    Object.values(model).forEach(fn => (fn as ReturnType<typeof vi.fn>).mockReset());
  });
}
