import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    component: { findMany: vi.fn(), findFirst: vi.fn() },
    page: { findMany: vi.fn() },
  };
  return { prismaMock };
});

vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn().mockResolvedValue(undefined),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../../db', () => ({ prisma: prismaMock }));
vi.mock('../../redis/client', () => ({ redis: null }));
vi.mock('../../publish/index', () => ({
  publishPage: vi.fn().mockResolvedValue({ id: 'ver-1', pageId: 'p1' }),
}));
// publish-page.ts imports from '../../publish' (not '../../publish/index')
vi.mock('../../publish', () => ({
  publishPage: vi.fn().mockResolvedValue({ id: 'ver-1', pageId: 'p1' }),
}));

import { callReducer } from '../../spacetime/client';
import { searchComponentsTool } from './search-components';
import { listPagesTool } from './list-pages';
import { publishPageTool } from './publish-page';
import { injectComponentTool } from './inject-component';
import { publishPage } from '../../publish';

const mockCallReducer = callReducer as ReturnType<typeof vi.fn>;
const mockPublishPage = publishPage as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCallReducer.mockResolvedValue(undefined);
  mockPublishPage.mockResolvedValue({ id: 'ver-1', pageId: 'p1' });
});

// ---------------------------------------------------------------------------
// search_components
// ---------------------------------------------------------------------------

describe('search_components', () => {
  it('searches by query and returns components with count, verifying OR query for tenant+public', async () => {
    const fakeComponents = [
      {
        id: 'comp-1',
        tenantId: 'tenant-a',
        name: 'Hero Banner',
        isPublic: false,
        versions: [],
      },
      {
        id: 'comp-2',
        tenantId: null,
        name: 'Hero Card',
        isPublic: true,
        versions: [],
      },
    ];
    prismaMock.component.findMany.mockResolvedValue(fakeComponents);

    const result = await searchComponentsTool.execute({
      tenant_id: 'tenant-a',
      query: 'Hero',
    });

    expect(result.components).toHaveLength(2);
    expect(result.count).toBe(2);

    // Verify OR query includes both tenant-owned and global public components
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ tenantId: 'tenant-a' }),
            expect.objectContaining({ tenantId: null, isPublic: true }),
          ]),
          name: expect.objectContaining({ contains: 'Hero' }),
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// list_pages
// ---------------------------------------------------------------------------

describe('list_pages', () => {
  it('returns pages list with slug field and verifies tenantId filter', async () => {
    const fakePages = [
      {
        id: 'page-1',
        slug: 'home',
        pageType: 'home',
        title: 'Home Page',
        publishedVersionId: null,
        publishedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'page-2',
        slug: 'about',
        pageType: 'custom',
        title: 'About',
        publishedVersionId: 'ver-5',
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ];
    prismaMock.page.findMany.mockResolvedValue(fakePages);

    const result = await listPagesTool.execute({ tenant_id: 'tenant-a' });

    expect(result.pages).toHaveLength(2);
    // Verify slug is present in response
    expect(result.pages[0].slug).toBe('home');
    expect(result.pages[1].slug).toBe('about');

    // Verify tenantId filter is passed to Prisma
    expect(prismaMock.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// publish_page
// ---------------------------------------------------------------------------

describe('publish_page', () => {
  it('calls publishPage pipeline and returns version info', async () => {
    mockPublishPage.mockResolvedValue({ id: 'ver-42', pageId: 'page-7' });

    const result = await publishPageTool.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-7',
    });

    expect(mockPublishPage).toHaveBeenCalledOnce();
    expect(mockPublishPage).toHaveBeenCalledWith('page-7', 'tenant-a');
    expect(result.version_id).toBe('ver-42');
    expect(result.message).toContain('ver-42');
  });
});

// ---------------------------------------------------------------------------
// inject_component
// ---------------------------------------------------------------------------

describe('inject_component', () => {
  it("calls 'insert_node' reducer with node_type='component' and component_url in args", async () => {
    const result = await injectComponentTool.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-1',
      parent_id: 'root',
      position: 'last',
      component_id: 'comp-1',
      component_url: 'https://cdn.r2.dev/comp-1/1.0.0.js',
      component_version: '1.0.0',
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('insert_node');
    expect(args.node_type).toBe('component');
    // component_url is wrapped by opt() — verify the { some: value } shape
    expect(args.component_url).toEqual({ some: 'https://cdn.r2.dev/comp-1/1.0.0.js' });

    // result has a valid UUID node_id
    expect(result.node_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.message).toContain(result.node_id);
  });

  it('verifies tenant_id is in reducer args (Critical Rule)', async () => {
    await injectComponentTool.execute({
      tenant_id: 'tenant-b',
      page_id: 'page-2',
      parent_id: 'root',
      position: 'first',
      component_id: 'comp-2',
      component_url: 'https://cdn.r2.dev/comp-2/2.0.0.js',
      component_version: '2.0.0',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'insert_node',
      expect.objectContaining({ tenant_id: 'tenant-b' }),
    );
  });
});
