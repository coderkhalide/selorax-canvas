# @selorax/renderer — Page Tree Renderer

SSR-compatible React component library that renders a canvas node tree to HTML.
Used by: storefront (production), preview-server (live preview).

## PageRenderer
```typescript
import { PageRenderer } from '@selorax/renderer';

<PageRenderer
  tree={treeNode}           // Nested TreeNode from buildTree()
  data={{ store: { name: 'My Store' }, device: 'desktop' }}
/>
```

## TreeNode Shape
```typescript
interface TreeNode {
  id: string;
  node_type: 'layout' | 'element' | 'component' | 'slot';
  styles: Record<string, any>;   // CSS + _sm/_md/_lg/_hover responsive keys
  props: Record<string, any>;    // tag, content, src, href, label, etc.
  settings: Record<string, any>; // component instance settings
  component_url?: string;        // CDN URL for ESM component
  component_id?: string;
  component_version?: string;
  children: TreeNode[];
}
```

## Rendering Logic
- **layout nodes**: renders as `<div>` with resolved styles + children
- **element nodes**: switches on `props.tag` — text, heading, image, button, divider
- **component nodes**: dynamic ESM import from `component_url` (cached in MODULE_CACHE)
- **slot nodes**: renders as empty droppable area

## Style Resolution
`resolveStyles(styles, device)` — extracts responsive overrides:
- Desktop: base styles
- `_sm`: mobile overrides (applied when `device === 'mobile'`)
- `_md`: tablet overrides
- `_hover`: hover state (applied as CSS class)

## Token Resolution
`resolveTokens(value, data)` — replaces `{{store.name}}` with data values.
Supports nested paths: `{{product.price}}`, `{{store.logo}}`.

## ESM Component Loading
```typescript
// Dynamic import with module cache to avoid re-fetching
const MODULE_CACHE = new Map<string, any>();

async function RenderComponent({ node }) {
  if (!MODULE_CACHE.has(node.component_url)) {
    const mod = await import(/* webpackIgnore: true */ node.component_url);
    MODULE_CACHE.set(node.component_url, mod.default);
  }
  const Component = MODULE_CACHE.get(node.component_url);
  return <Component settings={node.settings} data={data} />;
}
```

## Action Handling
`handleAction(action)` — supports:
- `{ type: 'link', url: '...' }` — navigate
- `{ type: 'scroll', target: '#section' }` — smooth scroll
