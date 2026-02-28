'use client';
// @selorax/renderer — SSR-compatible tree renderer
// Works in Next.js App Router (server + client), no canvas deps
import { memo, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import * as Icons from 'lucide-react';
import { CUSTOM_ELEMENT_REGISTRY } from './elements/registry';

// ─── Per-node error boundary ─────────────────────────────────────────────────
// Isolates crashes so a single bad node/component doesn't take down the page.

interface NodeErrorBoundaryState { error: Error | null }

class NodeErrorBoundary extends Component<{ children: ReactNode; nodeId?: string }, NodeErrorBoundaryState> {
  state: NodeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): NodeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[PageRenderer] Node render error', this.props.nodeId, error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      // Silent empty placeholder in production; visible hint in dev
      if (process.env.NODE_ENV !== 'production') {
        return (
          <div style={{ border: '2px dashed #EF4444', borderRadius: 4, padding: '8px 12px', color: '#EF4444', fontSize: 12, minHeight: 32 }}>
            ⚠ Render error{this.props.nodeId ? ` (node: ${this.props.nodeId})` : ''}: {this.state.error.message}
          </div>
        );
      }
      return <div style={{ minHeight: 32 }} />;
    }
    return this.props.children;
  }
}

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
  return (
    <NodeErrorBoundary nodeId={tree?.id}>
      <RenderNode node={tree} data={enrichedData} />
    </NodeErrorBoundary>
  );
}

const RenderNode = memo(function RenderNode({ node, data }: any) {
  if (!node) return null;
  const styles = resolveStyles(node.styles, node.settings, data?.device);

  switch (node.type) {
    case 'layout':
      return <NodeErrorBoundary nodeId={node.id}><RenderLayout node={node} styles={styles} data={data} /></NodeErrorBoundary>;
    case 'element':
      return <NodeErrorBoundary nodeId={node.id}><RenderElement node={node} styles={styles} data={data} /></NodeErrorBoundary>;
    case 'component':
      return <NodeErrorBoundary nodeId={node.id}><RenderComponent node={node} styles={styles} data={data} /></NodeErrorBoundary>;
    case 'slot': {
      const content = data?.slots?.[node.props?.name] ?? node.props?.fallback ?? [];
      return (
        <NodeErrorBoundary nodeId={node.id}>
          <div style={styles} data-slot={node.props?.name}>
            {Array.isArray(content)
              ? content.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)
              : content}
          </div>
        </NodeErrorBoundary>
      );
    }
    default:
      return null;
  }
});

// ─── Layout (section / row / col / wrapper) ──────────────────────────────────

function RenderLayout({ node, styles, data }: any) {
  const props    = node.props    ?? {};
  const settings = node.settings ?? {};
  const elData   = settings.data ?? {};
  const isMobile = data?.device === 'mobile';

  const Tag = props.tag === 'section' ? 'section' : 'div';

  const layout = elData.containerLayout
    ?? elData.rowContainerLayout
    ?? (isMobile ? elData.mobileContainerLayout ?? elData.mobileRowContainerLayout : undefined);

  // Grid layout
  if (layout === 'grid') {
    const cols = isMobile
      ? (elData.gridColumnsMobile ?? elData.rowGridColumnsMobile)
      : (elData.gridColumnsDesktop ?? elData.rowGridColumnsDesktop);
    const gridStyles: React.CSSProperties = cols
      ? { ...styles, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }
      : styles;
    return (
      <Tag style={gridStyles} className={settings.className}>
        {node.children?.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)}
      </Tag>
    );
  }

  // Carousel layout
  if (layout === 'carousel') {
    const slides = isMobile ? (elData.slidesPerViewMobile ?? 1) : (elData.slidesPerViewDesktop ?? 3);
    return (
      <Tag style={styles} className={settings.className}>
        <div style={{
          display: 'flex', flexDirection: 'row', overflowX: 'auto',
          gap: styles.gap as any, scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
        }}>
          {node.children?.map((c: any) => (
            <div key={c.id} style={{ flex: `0 0 ${100 / slides}%`, scrollSnapAlign: 'start' }}>
              <RenderNode node={c} data={data} />
            </div>
          ))}
        </div>
      </Tag>
    );
  }

  return (
    <Tag style={styles} className={settings.className}>
      {node.children?.map((c: any) => <RenderNode key={c.id} node={c} data={data} />)}
    </Tag>
  );
}

// ─── Elements ────────────────────────────────────────────────────────────────

function RenderElement({ node, styles, data }: any) {
  const props    = node.props    ?? {};
  const settings = node.settings ?? {};
  const elData   = settings.data ?? {};
  const text     = (s: string) => resolveTokens(s ?? '', data);
  const tag      = props.tag as string;

  // 'headline' → <h1> (no level stored; default to h2 unless overridden in data)
  if (tag === 'headline') {
    const level = elData.level ?? 2;
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return (
      <Tag
        style={styles}
        className={settings.className}
        dangerouslySetInnerHTML={{ __html: text(props.content ?? '') }}
      />
    );
  }

  // 'heading' legacy (canvas-dashboard compat)
  if (tag === 'heading') {
    const Tag = `h${props.level ?? 2}` as keyof JSX.IntrinsicElements;
    return <Tag style={styles} className={settings.className}>{text(props.content)}</Tag>;
  }

  if (tag === 'paragraph' || tag === 'text') {
    return (
      <p
        style={styles}
        className={settings.className}
        dangerouslySetInnerHTML={{ __html: text(props.content ?? '') }}
      />
    );
  }

  if (tag === 'button') {
    const iconSize  = elData.iconSize ?? 18;
    const iconName  = elData.iconName as string | undefined;
    const showIcon  = elData.showIcon && iconName;
    const iconPos   = elData.iconPosition ?? 'right';
    const IconComp  = showIcon ? ((Icons as any)[iconName!] ?? null) : null;
    return (
      <button
        style={styles}
        className={settings.className}
        onClick={() => handleAction(props.action ?? {
          type: elData.onClick === 'url_redirect' ? 'link' : undefined,
          url:  elData.redirectUrl ?? elData.redirect_url,
        }, data?._funnelContext, data?._onEvent, data?._onFunnelNext)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: `${elData.iconGap ?? 8}px` }}>
          {showIcon && iconPos === 'left'  && IconComp && <IconComp size={iconSize} />}
          {text(props.content ?? props.label ?? 'Button')}
          {showIcon && iconPos === 'right' && IconComp && <IconComp size={iconSize} />}
        </span>
      </button>
    );
  }

  if (tag === 'image') {
    // canvas-v2 stores image URL in content; fall back to src for compat
    const src = props.content ?? props.src ?? '';
    return <img src={src} alt={props.alt ?? ''} style={styles} className={settings.className} />;
  }

  if (tag === 'video') {
    const videoUrl = props.content ?? props.src ?? elData.videoUrl ?? '';
    const showControls = elData.showControls ?? true;
    let embedUrl = videoUrl;
    let isIframe = false;
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const id = videoUrl.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? '';
      embedUrl = `https://www.youtube.com/embed/${id}?controls=${showControls ? 1 : 0}`;
      isIframe = true;
    } else if (videoUrl.includes('vimeo.com')) {
      const id = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1] ?? '';
      embedUrl = `https://player.vimeo.com/video/${id}`;
      isIframe = true;
    }
    return (
      <div style={{ ...styles, position: 'relative' }} className={settings.className}>
        {isIframe ? (
          <iframe
            src={embedUrl}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, border: 'none' }}
            allowFullScreen
          />
        ) : (
          <video src={videoUrl} controls={showControls} style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    );
  }

  if (tag === 'icon') {
    const iconName = props.content ?? 'HelpCircle';
    const IconComp = (Icons as any)[iconName] ?? Icons.HelpCircle;
    const size = parseInt(String(styles.fontSize ?? 24));
    const color = styles.color as string | undefined;
    return <IconComp size={size} style={{ ...styles, fontSize: undefined, color }} className={settings.className} />;
  }

  if (tag === 'input') {
    return (
      <input
        type={elData.inputType ?? 'text'}
        placeholder={props.placeholder ?? ''}
        style={styles}
        className={settings.className}
      />
    );
  }

  if (tag === 'divider') {
    return <hr style={styles} className={settings.className} />;
  }

  // Fallback
  return <div style={styles} className={settings.className}>{props.content}</div>;
}

// ─── Component (CDN ESM or custom registry) ───────────────────────────────────

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
  // Pass style through to component so it can apply positioning/sizing
  return <Comp settings={node.settings ?? {}} data={data} style={styles} />;
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
  return <Comp data={data} style={styles} />;
}

// ─── Style resolution ─────────────────────────────────────────────────────────

export function resolveStyles(
  styles: any,
  settings?: any,
  device?: string,
): React.CSSProperties {
  if (!styles) return {};

  // Strip internal responsive keys; start from base
  const { _sm, _md, _lg, _hover, _active, _focus, ...base } = styles;

  // Merge settings.breakpoints (canvas-v2 stores responsive overrides here)
  const breakpoints = settings?.breakpoints ?? {};
  if (device === 'mobile'  && breakpoints.sm) Object.assign(base, breakpoints.sm);
  if (device === 'tablet'  && breakpoints.md) Object.assign(base, breakpoints.md);
  // Also handle legacy _sm/_md keys
  if (device === 'mobile'  && _sm)            Object.assign(base, _sm);
  if (device === 'tablet'  && _md)            Object.assign(base, _md);

  // Inject color scheme CSS variables
  const schemeId = settings?.schemeId;
  const schemes  = settings?._schemes;  // optionally passed via data
  if (schemeId && schemes?.[schemeId]?.settings) {
    for (const [k, v] of Object.entries(schemes[schemeId].settings)) {
      (base as any)[`--color-${k.replace(/_/g, '-')}`] = v;
    }
  }

  // backgroundColor → background (allows CSS gradients)
  const { backgroundColor, color, ...rest } = base;
  const result: React.CSSProperties = { ...rest };
  if (backgroundColor) {
    result.background = backgroundColor as string;
  }

  // Gradient text
  if (typeof color === 'string' && color.includes('gradient')) {
    result.backgroundImage = color;
    result.WebkitBackgroundClip = 'text';
    result.backgroundClip = 'text' as any;
    result.WebkitTextFillColor = 'transparent';
    result.color = 'transparent';
  } else if (color !== undefined) {
    result.color = color as string;
  }

  return result;
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
    if (!funnelContext) return;
    onEvent?.({
      eventType: 'funnel_step_complete',
      funnelId: funnelContext.funnelId,
      funnelStepOrder: funnelContext.funnelStepOrder,
    });
    onFunnelNext?.();
    return;
  }

  if (action.type === 'skipStep') {
    funnelContext?.onSkip?.();
    return;
  }

  if (action.type === 'conversion') {
    onEvent?.({ eventType: 'conversion', value: action.value ?? 0 });
    if (action.url) window.location.href = action.url;
    return;
  }
}
