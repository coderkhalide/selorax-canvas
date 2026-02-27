import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../../db', () => ({ prisma: prismaMock }));

import { createPageTool }    from './create-page';
import { duplicatePageTool } from './duplicate-page';
import { renamePageTool }    from './rename-page';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// create_page
// ---------------------------------------------------------------------------

describe('create_page', () => {
  it('creates a page and returns it when slug is not taken', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null); // slug not taken
    prismaMock.page.create.mockResolvedValue({
      id:       'new-page-id',
      tenantId: 'tenant-a',
      title:    'About Us',
      slug:     'about-us',
      pageType: 'landing',
    });

    const result = await createPageTool.execute({
      tenant_id: 'tenant-a',
      title:     'About Us',
      slug:      'about-us',
      page_type: 'landing',
    });

    expect(result.success).toBe(true);
    expect(result.page).toBeDefined();
    expect(result.page!.id).toBe('new-page-id');
    expect(result.page!.title).toBe('About Us');
    expect(result.page!.slug).toBe('about-us');
    expect(result.page!.pageType).toBe('landing');

    expect(prismaMock.page.create).toHaveBeenCalledOnce();
    expect(prismaMock.page.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          title:    'About Us',
          slug:     'about-us',
          pageType: 'landing',
        }),
      })
    );
  });

  it('returns success: false when slug is already taken and does NOT call prisma.page.create', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id:       'existing-page',
      tenantId: 'tenant-a',
      slug:     'about-us',
      pageType: 'landing',
    });

    const result = await createPageTool.execute({
      tenant_id: 'tenant-a',
      title:     'Another About',
      slug:      'about-us',
      page_type: 'custom',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Slug already taken');
    expect(prismaMock.page.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// duplicate_page
// ---------------------------------------------------------------------------

describe('duplicate_page', () => {
  it('creates a duplicate page with new title and slug', async () => {
    const sourcePage = {
      id:       'source-page-id',
      tenantId: 'tenant-a',
      title:    'Home',
      slug:     'home',
      pageType: 'home',
    };

    // first findFirst → source page found; second findFirst → new slug not taken
    prismaMock.page.findFirst
      .mockResolvedValueOnce(sourcePage)
      .mockResolvedValueOnce(null);

    prismaMock.page.create.mockResolvedValue({
      id:       'dup-page-id',
      tenantId: 'tenant-a',
      title:    'Home Copy',
      slug:     'home-copy',
      pageType: 'home',
    });

    const result = await duplicatePageTool.execute({
      tenant_id:      'tenant-a',
      source_page_id: 'source-page-id',
      new_title:      'Home Copy',
      new_slug:       'home-copy',
    });

    expect(result.success).toBe(true);
    expect(result.page).toBeDefined();
    expect(result.page!.id).toBe('dup-page-id');
    expect(result.page!.slug).toBe('home-copy');
    expect(result.page!.pageType).toBe('home');
    expect(result.note).toContain('empty canvas');

    expect(prismaMock.page.create).toHaveBeenCalledOnce();
    expect(prismaMock.page.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          title:    'Home Copy',
          slug:     'home-copy',
          pageType: 'home',
        }),
      })
    );
  });

  it('returns success: false when source page is not found', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    const result = await duplicatePageTool.execute({
      tenant_id:      'tenant-a',
      source_page_id: 'non-existent',
      new_title:      'Copy',
      new_slug:       'copy',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Source page not found');
    expect(prismaMock.page.create).not.toHaveBeenCalled();
  });

  it('returns success: false when new slug is already taken and does NOT call prisma.page.create', async () => {
    const sourcePage = {
      id:       'source-page-id',
      tenantId: 'tenant-a',
      title:    'Home',
      slug:     'home',
      pageType: 'home',
    };

    const conflictingPage = {
      id:       'other-page-id',
      tenantId: 'tenant-a',
      slug:     'home-copy',
      pageType: 'custom',
    };

    // first findFirst → source found; second findFirst → slug conflict
    prismaMock.page.findFirst
      .mockResolvedValueOnce(sourcePage)
      .mockResolvedValueOnce(conflictingPage);

    const result = await duplicatePageTool.execute({
      tenant_id:      'tenant-a',
      source_page_id: 'source-page-id',
      new_title:      'Home Copy',
      new_slug:       'home-copy',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('New slug already taken');
    expect(prismaMock.page.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// rename_page
// ---------------------------------------------------------------------------

describe('rename_page', () => {
  it('renames the title only (slug unchanged)', async () => {
    const existingPage = {
      id:       'page-1',
      tenantId: 'tenant-a',
      title:    'Old Title',
      slug:     'old-slug',
      pageType: 'custom',
    };
    prismaMock.page.findFirst.mockResolvedValue(existingPage);
    prismaMock.page.update.mockResolvedValue({
      ...existingPage,
      title: 'New Title',
    });

    const result = await renamePageTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      new_title: 'New Title',
    });

    expect(result.success).toBe(true);
    expect(result.page!.title).toBe('New Title');
    expect(result.page!.slug).toBe('old-slug');

    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'page-1' },
        data:  expect.objectContaining({ title: 'New Title' }),
      })
    );
    // slug should NOT be in update data when not provided
    const updateCall = prismaMock.page.update.mock.calls[0][0];
    expect(updateCall.data.slug).toBeUndefined();

    expect(prismaMock.page.findFirst).toHaveBeenCalledOnce();
  });

  it('renames both title and slug', async () => {
    const existingPage = {
      id:       'page-1',
      tenantId: 'tenant-a',
      title:    'Old Title',
      slug:     'old-slug',
      pageType: 'custom',
    };

    // first findFirst → page found; second findFirst (slug check) → not taken
    prismaMock.page.findFirst
      .mockResolvedValueOnce(existingPage)
      .mockResolvedValueOnce(null);

    prismaMock.page.update.mockResolvedValue({
      ...existingPage,
      title: 'New Title',
      slug:  'new-slug',
    });

    const result = await renamePageTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      new_title: 'New Title',
      new_slug:  'new-slug',
    });

    expect(result.success).toBe(true);
    expect(result.page!.title).toBe('New Title');
    expect(result.page!.slug).toBe('new-slug');

    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'page-1' },
        data:  expect.objectContaining({ title: 'New Title', slug: 'new-slug' }),
      })
    );
  });

  it('returns success: false when page is not found', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    const result = await renamePageTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'non-existent',
      new_title: 'Whatever',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Page not found');
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });

  it('returns success: false when new slug is taken by ANOTHER page (excludes current page from check)', async () => {
    const existingPage = {
      id:       'page-1',
      tenantId: 'tenant-a',
      title:    'My Page',
      slug:     'my-page',
      pageType: 'custom',
    };

    const conflictingPage = {
      id:       'page-99',
      tenantId: 'tenant-a',
      slug:     'taken-slug',
      pageType: 'landing',
    };

    // first findFirst → page found; second findFirst (slug check) → conflict
    prismaMock.page.findFirst
      .mockResolvedValueOnce(existingPage)
      .mockResolvedValueOnce(conflictingPage);

    const result = await renamePageTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      new_slug:  'taken-slug',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('New slug already taken');
    expect(prismaMock.page.update).not.toHaveBeenCalled();

    // Verify the slug check used NOT: { id: page_id } to exclude current page
    expect(prismaMock.page.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          slug:     'taken-slug',
          NOT:      { id: 'page-1' },
        }),
      })
    );
  });
});
