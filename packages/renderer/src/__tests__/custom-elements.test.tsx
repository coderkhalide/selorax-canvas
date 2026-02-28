import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PageRenderer } from '../PageRenderer';

// Mock the custom element registry
vi.mock('../elements/registry', () => ({
  CUSTOM_ELEMENT_REGISTRY: {
    countdown: () => Promise.resolve({
      default: ({ data }: { data: any }) => (
        <div data-testid="countdown">{data.duration}</div>
      ),
    }),
  },
}));

const makeTree = (customType: string, data: Record<string, any>) => ({
  id: 'root',
  type: 'layout',
  styles: {},
  props: {},
  settings: {},
  children: [{
    id: 'node1',
    type: 'component',
    styles: {},
    props: {},
    settings: { customType, data },
    url: null,
    children: [],
  }],
});

describe('PageRenderer custom elements', () => {
  it('renders a known customType using the registry', async () => {
    render(<PageRenderer tree={makeTree('countdown', { duration: '24h' })} data={{}} />);
    await waitFor(() => {
      expect(screen.getByTestId('countdown')).toBeInTheDocument();
    });
    expect(screen.getByTestId('countdown').textContent).toBe('24h');
  });

  it('renders nothing while loading (no flash)', () => {
    render(<PageRenderer tree={makeTree('countdown', {})} data={{}} />);
    // Before async import resolves, should render empty div (no placeholder text)
    expect(screen.queryByText('Component URL missing')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading component...')).not.toBeInTheDocument();
  });

  it('still renders CDN component when url is set and no customType', async () => {
    // CDN component — url is set, no customType — existing behaviour unchanged
    const tree = {
      id: 'root',
      type: 'layout',
      styles: {},
      props: {},
      settings: {},
      children: [{
        id: 'n2',
        type: 'component',
        styles: {},
        props: {},
        settings: {},
        url: 'https://cdn.example.com/comp.js',
        children: [],
      }],
    };
    render(<PageRenderer tree={tree} data={{}} />);
    // Should show "Loading component..." (CDN import, not yet resolved)
    expect(screen.getByText('Loading component...')).toBeInTheDocument();
  });
});
