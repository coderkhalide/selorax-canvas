import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ComponentBrowser from '@/app/canvas/[pageId]/components/panels/ComponentBrowser';

// Mock dnd-kit useDraggable (requires DndContext provider which we don't want in unit tests)
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core') as any;
  return {
    ...actual,
    useDraggable: () => ({
      attributes: {}, listeners: {}, setNodeRef: vi.fn(), isDragging: false,
    }),
  };
});

const mockComponents = [
  { id: 'c1', name: 'Hero Banner',  currentVersion: '1.0.0', currentUrl: 'https://cdn.r2.dev/c1/1.0.0.js', isPublic: false, tenantId: 'tenant-a' },
  { id: 'c2', name: 'Hero Card',    currentVersion: '2.0.0', currentUrl: 'https://cdn.r2.dev/c2/2.0.0.js', isPublic: false, tenantId: 'tenant-a' },
  { id: 'c3', name: 'Global Footer', currentVersion: '1.1.0', currentUrl: 'https://cdn.r2.dev/c3/1.1.0.js', isPublic: true,  tenantId: null },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockComponents),
  }));
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:3001');
});

describe('ComponentBrowser', () => {
  const defaultProps = { tenantId: 'tenant-a', pageId: 'page-1', conn: null };

  it('shows loading indicator while fetching', async () => {
    // Use a never-resolving promise to keep fetch "in flight"
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));
    render(<ComponentBrowser {...defaultProps} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches components on mount with correct tenant header', async () => {
    render(<ComponentBrowser {...defaultProps} />);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'http://localhost:3001/api/components',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-tenant-id': 'tenant-a' }),
        }),
      );
    });
  });

  it('shows tenant components under "My Components" group', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    expect(screen.getByText('My Components')).toBeInTheDocument();
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.getByText('Hero Card')).toBeInTheDocument();
  });

  it('shows public components under "Public Library" group', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Global Footer'));

    expect(screen.getByText('Public Library')).toBeInTheDocument();
    expect(screen.getByText('Global Footer')).toBeInTheDocument();
  });

  it('filters components by search query (client-side)', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.change(screen.getByPlaceholderText('Search components...'), {
      target: { value: 'Hero' },
    });

    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.getByText('Hero Card')).toBeInTheDocument();
    expect(screen.queryByText('Global Footer')).not.toBeInTheDocument();
  });

  it('calls conn.reducers.insertNode on click with component data', async () => {
    const mockConn = { reducers: { insertNode: vi.fn() } };
    render(<ComponentBrowser tenantId="tenant-a" pageId="page-1" conn={mockConn} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.click(screen.getByText('Hero Banner').closest('.component-card')!);

    expect(mockConn.reducers.insertNode).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId:     'tenant-a',
        pageId:       'page-1',
        nodeType:     'component',
        componentUrl: { some: 'https://cdn.r2.dev/c1/1.0.0.js' },
      }),
    );
  });

  it('shows empty state when no components match search', async () => {
    render(<ComponentBrowser {...defaultProps} />);
    await waitFor(() => screen.getByText('Hero Banner'));

    fireEvent.change(screen.getByPlaceholderText('Search components...'), {
      target: { value: 'xyznotfound' },
    });

    expect(screen.getByText('No components found')).toBeInTheDocument();
  });
});
