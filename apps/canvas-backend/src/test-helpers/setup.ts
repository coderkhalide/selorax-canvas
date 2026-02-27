// apps/canvas-backend/src/test-helpers/setup.ts
// This file documents how to use mocks in integration tests.
//
// In each integration test file that hits Express routes, add these vi.mock()
// calls BEFORE any imports (Vitest hoists them automatically):
//
// vi.mock('../db', () => ({ prisma: prismaMock }));
// vi.mock('../redis/client', () => ({ redis: null }));
// vi.mock('../spacetime/client', () => ({
//   getPageNodes: vi.fn(),
//   callReducer: vi.fn(),
// }));
//
// Then import prismaMock from './test-helpers/mocks'.
// Call resetMocks() in beforeEach.
//
// -----------------------------------------------------------------------
// WHY vi.mock() MUST BE IN EACH TEST FILE (not here)
// -----------------------------------------------------------------------
// Vitest hoists vi.mock() calls to the top of the file at compile time.
// This hoisting only works within the same file — vi.mock() calls in a
// shared setup file are NOT hoisted into test files that import it.
// Therefore every integration test file that needs to intercept the db
// module must declare its own vi.mock('../db', ...) at the top level.
//
// The db module (src/db/index.ts) exports a single named export:
//   export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
//
// So the factory passed to vi.mock must return that same shape:
//   vi.mock('../db', () => ({ prisma: prismaMock }));
//
// -----------------------------------------------------------------------
// FULL INTEGRATION TEST BOILERPLATE
// -----------------------------------------------------------------------
//
// import { describe, it, expect, beforeEach, vi } from 'vitest';
// import { prismaMock, resetMocks } from '../test-helpers/mocks';
//
// vi.mock('../db', () => ({ prisma: prismaMock }));
// vi.mock('../redis/client', () => ({ redis: null }));
// vi.mock('../spacetime/client', () => ({
//   getPageNodes: vi.fn(),
//   callReducer: vi.fn(),
// }));
//
// import request from 'supertest';
// import { app } from '../index';       // import AFTER vi.mock() declarations
//
// describe('My route', () => {
//   beforeEach(() => {
//     resetMocks();                     // reset per-test — clearMocks in vitest.config.ts
//   });                                // handles the automatic clear between tests
//
//   it('does something', async () => {
//     prismaMock.page.findMany.mockResolvedValue([]);
//     const res = await request(app).get('/api/pages').set('x-tenant-id', 'tenant-1');
//     expect(res.status).toBe(200);
//   });
// });

export {};  // ensures this is treated as a module, not a script
