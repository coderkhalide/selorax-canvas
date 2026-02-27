'use client';
// @selorax/renderer — SSR-compatible tree renderer
// Works in Next.js App Router (server + client), no canvas deps
import { memo, useState, useEffect } from 'react';

const MODULE_CACHE = new Map<string, React.ComponentType<any>>();

export function PageRenderer({ tree, data }: { tree: any; data: any }) {
  if (!tree) return null;
  return <RenderNode node={tree} data={data} />;
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
      const Tag = (props.level ?? 'h2') as keyof JSX.IntrinsicElements;
      return <Tag style={styles}>{text(props.content)}</Tag>;
    }
    case 'image':   return <img src={props.src} alt={props.alt ?? ''} style={styles} />;
    case 'button':  return (
      <button style={styles} onClick={() => handleAction(props.action)}>
        {text(props.label)}
      </button>
    );
    case 'divider': return <hr style={styles} />;
    default:        return <div style={styles}>{props.content}</div>;
  }
}

function RenderComponent({ node, styles, data }: any) {
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

function resolveStyles(styles: any, device?: string): React.CSSProperties {
  if (!styles) return {};
  const { _sm, _md, _lg, _hover, _active, _focus, ...base } = styles;
  if (device === 'mobile' && _sm) Object.assign(base, _sm);
  if (device === 'tablet' && _md) Object.assign(base, _md);
  return base;
}

function resolveTokens(value: string, data: any): string {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (_, path) =>
    path.trim().split('.').reduce((o: any, k: string) => o?.[k], data) ?? ''
  );
}

function handleAction(action: any) {
  if (!action) return;
  if (action.type === 'link' && action.url) window.location.href = action.url;
}
