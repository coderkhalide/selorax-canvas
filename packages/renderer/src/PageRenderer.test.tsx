import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageRenderer } from './PageRenderer';
import type { TreeNode } from '@selorax/types';

// Helper: build a minimal layout root wrapping child nodes
function makeLayout(children: TreeNode[]): TreeNode {
  return {
    id: 'root',
    type: 'layout',
    styles: {},
    props: {},
    settings: {},
    children,
  };
}

// Helper: build an element node
function makeElement(id: string, props: Record<string, any>): TreeNode {
  return {
    id,
    type: 'element',
    styles: {},
    props,
    settings: {},
    children: [],
  };
}

describe('PageRenderer', () => {
  it('renders a text element', () => {
    const tree = makeLayout([
      makeElement('el-1', { tag: 'text', content: 'Hello World' }),
    ]);
    render(<PageRenderer tree={tree} data={{}} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders a heading element with correct tag', () => {
    const tree = makeLayout([
      makeElement('el-2', { tag: 'heading', level: 1, content: 'Page Title' }),
    ]);
    render(<PageRenderer tree={tree} data={{}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page Title');
  });

  it('renders an image element with src', () => {
    const tree = makeLayout([
      makeElement('el-3', { tag: 'image', src: 'https://example.com/img.jpg', alt: 'Test' }),
    ]);
    render(<PageRenderer tree={tree} data={{}} />);
    const img = screen.getByRole('img', { name: 'Test' });
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('resolves tokens in text content', () => {
    const tree = makeLayout([
      makeElement('el-4', { tag: 'text', content: 'Welcome to {{store.name}}' }),
    ]);
    render(<PageRenderer tree={tree} data={{ store: { name: 'TestShop' } }} />);
    expect(screen.getByText('Welcome to TestShop')).toBeInTheDocument();
  });

  it('renders nested layout → element', () => {
    const section: TreeNode = {
      id: 'section-1',
      type: 'layout',
      styles: {},
      props: {},
      settings: {},
      children: [
        makeElement('el-5', { tag: 'text', content: 'Nested text' }),
      ],
    };
    const tree = makeLayout([section]);
    render(<PageRenderer tree={tree} data={{}} />);
    expect(screen.getByText('Nested text')).toBeInTheDocument();
  });

  it('renders null tree gracefully (no crash)', () => {
    expect(() => render(<PageRenderer tree={null as any} data={{}} />)).not.toThrow();
  });
});

// Helper for action tests: minimal layout wrapping a single button element
function makeActionTree(action: any): TreeNode {
  return {
    id: 'root',
    type: 'layout',
    styles: {},
    props: {},
    settings: {},
    children: [
      {
        id: 'btn',
        type: 'element',
        styles: {},
        props: { tag: 'button', label: 'Next Step', action },
        settings: {},
        children: [],
      },
    ],
  };
}

describe('handleAction — nextFunnelStep', () => {
  it('calls onFunnelNext when button has nextFunnelStep action', () => {
    const onFunnelNext = vi.fn();
    render(
      <PageRenderer
        tree={makeActionTree({ type: 'nextFunnelStep' })}
        data={{}}
        funnelContext={{ nextStepUrl: '/upsell', funnelId: 'f1', funnelStepOrder: 1, isLastStep: false, onSuccess: null, onSkip: null }}
        onEvent={vi.fn()}
        onFunnelNext={onFunnelNext}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onFunnelNext).toHaveBeenCalledOnce();
  });

  it('calls onEvent with funnel_step_complete when nextFunnelStep clicked', () => {
    const onEvent = vi.fn();
    render(
      <PageRenderer
        tree={makeActionTree({ type: 'nextFunnelStep' })}
        data={{}}
        funnelContext={{ nextStepUrl: '/upsell', funnelId: 'f1', funnelStepOrder: 1, isLastStep: false, onSuccess: null, onSkip: null }}
        onEvent={onEvent}
        onFunnelNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'funnel_step_complete' }));
  });

  it('calls onEvent with conversion when button has conversion action', () => {
    const onEvent = vi.fn();
    render(
      <PageRenderer
        tree={makeActionTree({ type: 'conversion', value: 97 })}
        data={{}}
        onEvent={onEvent}
        onFunnelNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'conversion', value: 97 }));
  });

  it('navigates via window.location for link action (existing behavior)', () => {
    const locationMock = { href: '' };
    vi.stubGlobal('location', locationMock);
    render(<PageRenderer tree={makeActionTree({ type: 'link', url: '/products' })} data={{}} onEvent={vi.fn()} onFunnelNext={vi.fn()} />);
    fireEvent.click(screen.getByText('Next Step'));
    expect(window.location.href).toBe('/products');
    vi.unstubAllGlobals();
  });
});
