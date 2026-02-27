import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FunnelBuilder from '@/app/canvas/[pageId]/components/panels/FunnelBuilder';

const mockFunnels = [
  {
    id: 'f1', name: 'Checkout Funnel', goal: 'conversion', status: 'running',
    steps: [
      { id: 's1', pageId: 'p1', stepOrder: 0, stepType: 'landing',  name: 'Home',    onSuccess: '{"action":"next"}' },
      { id: 's2', pageId: 'p2', stepOrder: 1, stepType: 'checkout', name: 'Product', onSuccess: '{"action":"next"}' },
    ],
  },
  {
    id: 'f2', name: 'Lead Gen', goal: 'lead', status: 'paused', steps: [],
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockFunnels),
  }));
});

const defaultProps = {
  tenantId:   'tenant-a',
  backendUrl: 'http://localhost:3001',
};

describe('FunnelBuilder', () => {
  it('fetches funnels on mount', async () => {
    render(<FunnelBuilder {...defaultProps} />);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'http://localhost:3001/api/funnels',
        expect.objectContaining({ headers: expect.objectContaining({ 'x-tenant-id': 'tenant-a' }) }),
      );
    });
  });

  it('renders all funnels with name and status', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    expect(screen.getByText('Checkout Funnel')).toBeInTheDocument();
    expect(screen.getByText('Lead Gen')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('expands funnel to show steps on click', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    // Steps not visible before click
    expect(screen.queryByText('Home')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Checkout Funnel'));

    // Steps visible after expand
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('creates a new funnel via POST and adds to list', async () => {
    const newFunnel = { id: 'f3', name: 'New Funnel', goal: 'conversion', status: 'draft', steps: [] };
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFunnels) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(newFunnel) } as any);

    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    fireEvent.click(screen.getByText('+ New Funnel'));
    fireEvent.change(screen.getByPlaceholderText('Funnel name...'), {
      target: { value: 'New Funnel' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(screen.getByText('New Funnel')).toBeInTheDocument());

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:3001/api/funnels',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New Funnel'),
      }),
    );
  });

  it('shows "+ Add step" button when funnel is expanded', async () => {
    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    fireEvent.click(screen.getByText('Checkout Funnel'));

    expect(screen.getByText('+ Add step')).toBeInTheDocument();
  });

  it('clicking "+ Add step" sends PATCH with updated steps', async () => {
    const updatedFunnel = {
      ...mockFunnels[0],
      steps: [
        ...mockFunnels[0].steps,
        { id: 's3', pageId: '', stepOrder: 2, stepType: 'landing', name: 'Step 3', onSuccess: '{"action":"next"}' },
      ],
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFunnels) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedFunnel) } as any);

    render(<FunnelBuilder {...defaultProps} />);
    await waitFor(() => screen.getByText('Checkout Funnel'));

    fireEvent.click(screen.getByText('Checkout Funnel'));
    fireEvent.click(screen.getByText('+ Add step'));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'http://localhost:3001/api/funnels/f1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('steps'),
        }),
      );
    });
  });
});
