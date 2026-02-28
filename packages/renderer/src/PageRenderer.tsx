'use client';
// @selorax/renderer — SSR-compatible tree renderer
// Works in Next.js App Router (server + client), no canvas deps
import { memo, useState, useEffect } from 'react';
import { CUSTOM_ELEMENT_REGISTRY } from './elements/registry';

const MODULE_CACHE = new Map<string, React.ComponentType<any>>();

export interface FunnelContext {
  nextStepUrl: string | null;
  funnelId: string;
  funnelStepOrder: number;
  isLastStep: boolean;
  onSuccess: (() => void) | null;
  onSkip: (() => void) | null;
}

export interface PageRendererProps {
  tree: any;
  data: any;
  funnelContext?: FunnelContext | null;
  onEvent?: (event: { eventType: string; value?: number; funnelId?: string; funnelStepOrder?: number }) => void;
  onFunnelNext?: () => void;
}

export function PageRenderer({ tree, data, funnelContext, onEvent, onFunnelNext }: PageRendererProps) {
  if (!tree) return null;
  const enrichedData = { ...data, _funnelContext: funnelContext, _onEvent: onEvent, _onFunnelNext: onFunnelNext };
  return <RenderNode node={tree} data={enrichedData} />;
}

const RenderNode = memo(function RenderNode({ node, data }: any) {
  if (!node) return null;
  const styles = resolveStyles(node.styles, data?.device);

  switch (node.type) {
    case 'layout':
      return (
        <div style={styles} data-id={node.id}>
          {node.children?.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)}
        </div>
      );
    case 'element':   return <RenderElement   node={node} styles={styles} data={data} />;
    case 'component': return <RenderComponent node={node} styles={styles} data={data} />;
    case 'slot': {
      const content = data?.slots?.[node.props?.name] ?? node.props?.fallback ?? [];
      return (
        <div style={styles} data-slot={node.props?.name}>
          {Array.isArray(content)
            ? content.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)
            : content}
        </div>
      );
    }
    default: return null;
  }
});

function RenderElement({ node, styles, data }: any) {
  const props = node.props ?? {};
  const text  = (s: string) => resolveTokens(s ?? '', data);

  switch (props.tag) {
    case 'text':    return <p style={styles}>{text(props.content)}</p>;
    case 'heading': {
      const Tag = `h${props.level ?? 2}` as keyof JSX.IntrinsicElements;
      return <Tag style={styles}>{text(props.content)}</Tag>;
    }
    case 'image':   return <img src={props.src} alt={props.alt ?? ''} style={styles} />;
    case 'button':  return (
      <button
        style={styles}
        onClick={() => handleAction(props.action, data?._funnelContext, data?._onEvent, data?._onFunnelNext)}
      >
        {text(props.label)}
      </button>
    );
    case 'divider': return <hr style={styles} />;
    default:        return <div style={styles}>{props.content}</div>;
  }
}

function RenderComponent({ node, styles, data }: any) {
  const customType: string | undefined = node.settings?.customType;
  if (customType) {
    return <RenderCustomElement customType={customType} data={node.settings?.data ?? {}} styles={styles} />;
  }
  return <RenderCdnComponent node={node} styles={styles} data={data} />;
}

function RenderCdnComponent({ node, styles, data }: any) {
  const [Comp, setComp] = useState<any>(() => MODULE_CACHE.get(node.url) ?? null);

  useEffect(() => {
    if (!node.url) return;
    if (MODULE_CACHE.has(node.url)) { setComp(() => MODULE_CACHE.get(node.url)!); return; }
    import(/* webpackIgnore: true */ node.url)
      .then(m => { MODULE_CACHE.set(node.url, m.default); setComp(() => m.default); })
      .catch(() => setComp(null));
  }, [node.url]);

  if (!Comp) return (
    <div style={{ ...styles, minHeight: 60, background: '#f5f5f5', borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>
      {node.url ? 'Loading component...' : 'Component URL missing'}
    </div>
  );
  return <div style={styles}><Comp settings={node.settings ?? {}} data={data} /></div>;
}

const CUSTOM_ELEMENT_CACHE = new Map<string, React.ComponentType<any>>();

function RenderCustomElement({ customType, data, styles }: { customType: string; data: any; styles: any }) {
  const [Comp, setComp] = useState<any>(() => CUSTOM_ELEMENT_CACHE.get(customType) ?? null);

  useEffect(() => {
    if (CUSTOM_ELEMENT_CACHE.has(customType)) {
      setComp(() => CUSTOM_ELEMENT_CACHE.get(customType)!);
      return;
    }
    const loader = CUSTOM_ELEMENT_REGISTRY[customType];
    if (!loader) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[PageRenderer] Unknown customType: "${customType}". Run make elements-generate.`);
      }
      return;
    }
    loader()
      .then(m => { CUSTOM_ELEMENT_CACHE.set(customType, m.default); setComp(() => m.default); })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[PageRenderer] Failed to load customType "${customType}":`, err);
        }
      });
  }, [customType]);

  if (!Comp) return <div style={{ ...styles, minHeight: 60 }} />;
  return <div style={styles}><Comp data={data} style={styles} /></div>;
}

export function resolveStyles(styles: any, device?: string): React.CSSProperties {
  if (!styles) return {};
  const { _sm, _md, _lg, _hover, _active, _focus, ...base } = styles;
  if (device === 'mobile' && _sm) Object.assign(base, _sm);
  if (device === 'tablet' && _md) Object.assign(base, _md);
  return base;
}

export function resolveTokens(value: string, data: any): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\{\{([^}]+)\}\}/g, (_, path) =>
    path.trim().split('.').reduce((o: any, k: string) => o?.[k], data) ?? ''
  );
}

function handleAction(
  action: any,
  funnelContext?: FunnelContext | null,
  onEvent?: (e: any) => void,
  onFunnelNext?: () => void,
) {
  if (!action) return;

  if (action.type === 'link' && action.url) {
    window.location.href = action.url;
    return;
  }

  if (action.type === 'nextFunnelStep') {
    if (!funnelContext) return;  // no context = nothing to advance
    onEvent?.({
      eventType: 'funnel_step_complete',
      funnelId: funnelContext.funnelId,
      funnelStepOrder: funnelContext.funnelStepOrder,
    });
    onFunnelNext?.();
    return;
  }

  if (action.type === 'conversion') {
    onEvent?.({ eventType: 'conversion', value: action.value ?? 0 });
    if (action.url) window.location.href = action.url;
    return;
  }
}
