# Custom Elements Generate — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `make elements-generate` that auto-bundles custom canvas elements into render-ready JS, then update `@selorax/renderer` to render them in storefront and preview.

**Architecture:** A `scripts/elements-generate.ts` script reads every `CustomComponentDef` export from `apps/canvas-v2/src/components/custom-registry/`, writes a thin adapter entry file per unique component, bundles each with esbuild (React externalized), and outputs `.js` bundles + a `registry.ts` into `packages/renderer/src/elements/`. `PageRenderer.tsx` gains a `RenderCustomElement` branch that lazy-imports from this registry when `node.settings.customType` is set.

**Tech Stack:** esbuild (bundler), tsx (script runner), React 19, TypeScript

---

## Context You Must Know

### File Layout
```
apps/canvas-v2/src/components/
  custom-registry.tsx          ← CUSTOM_BLOCKS registry (all type→def mappings)
  custom-registry/             ← 11 element source files + utils.tsx
    Countdown.tsx
    CustomMarquee.tsx
    Custom-Accordian.tsx
    Custom-Category.tsx
    Custom-Gallery.tsx
    CustomHtml.tsx
    CustomSlider.tsx
    CusotmCarousel.tsx  (note typo in filename — keep it)
    ImageCarousel.tsx
    ListBlock.tsx
    ListDetails.tsx
    utils.tsx           ← DynamicIcon (needed at render time)
  custom-box.tsx              ← legacy elements (same pattern, also in CUSTOM_BLOCKS)
  custom-quotes.tsx
  custom-sequence.tsx
  custom-step.tsx
  custom-video.tsx

packages/renderer/src/
  PageRenderer.tsx    ← renderer to update
  index.ts            ← re-exports

scripts/              ← CREATE THIS DIRECTORY
  elements-generate.ts  ← CREATE

packages/renderer/src/elements/  ← CREATE THIS DIRECTORY (generated output)
```

### Custom Element Prop Contract
Every custom element component is called in the editor like:
```tsx
<CountdownComponent
  element={funnelElement}   // { id, type, data: {...}, style: {}, className: '' }
  onUpdate={fn}              // editor callback — ignore in renderer
  isPreview={true}           // pass this to disable editor-only interactions
  deviceView="desktop"       // optional
/>
```
The component reads config from `element.data` (e.g., `element.data.duration`, `element.data.items`).

### STDB Node Shape (what renderer receives)
```typescript
node = {
  type: 'component',
  settings: {
    customType: 'countdown',  // key into registry
    data: { duration: '24h', digitColor: '#fff', ... }
  },
  url: null,    // no CDN URL for custom elements
  styles: { ... }
}
```

### CUSTOM_BLOCKS keys (all aliases, from custom-registry.tsx)
```
html, custom_html → CustomHtmlDef
list → ListBlockDef
detail_list → ListWithDetailsDef
carousel, imageCarousel, product_carousel, productCarousel → ImageCarouselDef
countdown → CountdownDef
gallery, image_gallery, imageGallery, product_gallery, productGallery → CustomGalleryDef
accordion → CustomAccordianDef
video_cards → VideoCardDef
boxes → BoxesDef
quotes, testimonials, testimonial → QuotesDef
sequence → SequenceDef
step, steps → StepsDef
custom_slider, customSlider → CustomCarouselDef
hero_slider, hero → CustomSliderDef
marquee, marquee_slider → CustomMarqueeDef
category_carousel, categories, collections → CustomCategoryDef
```

### FunnelElement interface (the fake element we build in adapters)
```typescript
interface FunnelElement {
  id: string;
  type: string;       // ElementType — use 'custom'
  name: string;
  style: CSSProperties;
  className?: string;
  data?: Record<string, any>;
  // ... more fields we don't need
}
```

---

## Task 1: Install esbuild dev dependency

**Files:**
- Modify: `package.json` (monorepo root)

**Step 1: Add esbuild to root devDependencies**

Run:
```bash
cd /path/to/selorax-canvas
npm install --save-dev esbuild
```

**Step 2: Verify**

Run: `npx esbuild --version`
Expected: prints a version like `0.x.y`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add esbuild as dev dep for elements-generate script"
```

---

## Task 2: Write the elements-generate script

**Files:**
- Create: `scripts/elements-generate.ts`

**Context:** This script imports the CUSTOM_BLOCKS registry at runtime (via dynamic import / require), figures out which unique source files exist, writes an adapter entry per component to a temp dir, bundles each with esbuild, and writes output to `packages/renderer/src/elements/`.

**Step 1: Create `scripts/elements-generate.ts`**

```typescript
#!/usr/bin/env tsx
/**
 * elements-generate.ts
 * Run: tsx scripts/elements-generate.ts
 * Or:  make elements-generate
 *
 * Reads CUSTOM_BLOCKS from canvas-v2 custom-registry,
 * bundles each unique component with esbuild (React external),
 * outputs .js bundles + registry.ts to packages/renderer/src/elements/
 */

import { build } from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANVAS_V2 = path.join(ROOT, 'apps/canvas-v2/src');
const OUT_DIR = path.join(ROOT, 'packages/renderer/src/elements');

// ─── Element source map ──────────────────────────────────────────────────────
// Maps slug (output filename without .js) → { importPath, exportName, aliases }
// importPath is relative to CANVAS_V2/components/
// exportName is the named export of the React component (NOT the Def export)
//
// We list these explicitly because:
// 1. Some filenames have typos (CusotmCarousel)
// 2. Component names differ from Def names
// 3. Legacy elements live in different files
//
const ELEMENTS: Record<string, {
  importPath: string;   // path relative to CANVAS_V2/components/
  componentExport: string; // named export of the React FC
  aliases: string[];    // all CUSTOM_BLOCKS keys that map to this element
}> = {
  countdown: {
    importPath: './custom-registry/Countdown',
    componentExport: 'CountdownComponent',
    aliases: ['countdown'],
  },
  marquee: {
    importPath: './custom-registry/CustomMarquee',
    componentExport: 'MarqueeComponent',
    aliases: ['marquee', 'marquee_slider'],
  },
  accordion: {
    importPath: './custom-registry/Custom-Accordian',
    componentExport: 'AccordionComponent',
    aliases: ['accordion'],
  },
  category: {
    importPath: './custom-registry/Custom-Category',
    componentExport: 'CustomCategoryComponent',
    aliases: ['category_carousel', 'categories', 'collections'],
  },
  gallery: {
    importPath: './custom-registry/Custom-Gallery',
    componentExport: 'CustomGalleryComponent',
    aliases: ['gallery', 'image_gallery', 'imageGallery', 'product_gallery', 'productGallery'],
  },
  html: {
    importPath: './custom-registry/CustomHtml',
    componentExport: 'CustomHtmlComponent',
    aliases: ['html', 'custom_html'],
  },
  hero_slider: {
    importPath: './custom-registry/CustomSlider',
    componentExport: 'CustomSliderComponent',
    aliases: ['hero_slider', 'hero'],
  },
  carousel: {
    importPath: './custom-registry/CusotmCarousel',
    componentExport: 'CustomCarouselComponent',
    aliases: ['custom_slider', 'customSlider'],
  },
  image_carousel: {
    importPath: './custom-registry/ImageCarousel',
    componentExport: 'ImageCarouselComponent',
    aliases: ['carousel', 'imageCarousel', 'product_carousel', 'productCarousel'],
  },
  list: {
    importPath: './custom-registry/ListBlock',
    componentExport: 'ListBlockComponent',
    aliases: ['list'],
  },
  list_details: {
    importPath: './custom-registry/ListDetails',
    componentExport: 'ListDetailsComponent',
    aliases: ['detail_list'],
  },
  // Legacy elements in top-level components/
  video_cards: {
    importPath: './custom-video',
    componentExport: 'VideoCardComponent',
    aliases: ['video_cards'],
  },
  boxes: {
    importPath: './custom-box',
    componentExport: 'BoxesComponent',
    aliases: ['boxes'],
  },
  quotes: {
    importPath: './custom-quotes',
    componentExport: 'QuotesComponent',
    aliases: ['quotes', 'testimonials', 'testimonial'],
  },
  sequence: {
    importPath: './custom-sequence',
    componentExport: 'SequenceComponent',
    aliases: ['sequence'],
  },
  steps: {
    importPath: './custom-step',
    componentExport: 'StepsComponent',
    aliases: ['step', 'steps'],
  },
};

// ─── Adapter template ─────────────────────────────────────────────────────────
function makeAdapter(slug: string, importPath: string, componentExport: string): string {
  return `
import React from 'react';
import { ${componentExport} } from '${importPath}';

export default function ${slug.replace(/[^a-zA-Z0-9]/g, '_')}Render({ data, style, className }) {
  const fakeElement = {
    id: '__render__',
    type: 'custom',
    name: '${slug}',
    style: style ?? {},
    className: className ?? '',
    data: data ?? {},
  };
  return React.createElement(${componentExport}, {
    element: fakeElement,
    isPreview: true,
  });
}
`.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Ensure output dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elements-gen-'));
  const registryEntries: string[] = [];

  try {
    for (const [slug, def] of Object.entries(ELEMENTS)) {
      const { importPath, componentExport, aliases } = def;

      // Resolve absolute import path for esbuild
      const absImportPath = path.resolve(CANVAS_V2, 'components', importPath);

      // Write adapter entry to tmpdir
      const adapterPath = path.join(tmpDir, `${slug}.tsx`);
      fs.writeFileSync(adapterPath, makeAdapter(slug, absImportPath, componentExport));

      // Bundle with esbuild
      const outFile = path.join(OUT_DIR, `${slug}.js`);
      await build({
        entryPoints: [adapterPath],
        bundle: true,
        format: 'esm',
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        outfile: outFile,
        // Suppress warnings about browser APIs (window.innerWidth etc.)
        platform: 'browser',
        target: 'es2020',
        // Silence "use client" directive warnings
        logOverride: { 'ignored-bare-import': 'silent' },
      });

      // Add registry entries for all aliases
      for (const alias of aliases) {
        registryEntries.push(`  ${JSON.stringify(alias)}: () => import('./${slug}.js'),`);
      }

      console.log(`✓ ${slug}.js  (aliases: ${aliases.join(', ')})`);
    }

    // Write registry.ts
    const registryPath = path.join(OUT_DIR, 'registry.ts');
    const registryContent = `// AUTO-GENERATED by scripts/elements-generate.ts — do not edit manually
// Run: make elements-generate
import type React from 'react';

export const CUSTOM_ELEMENT_REGISTRY: Record<
  string,
  () => Promise<{ default: React.ComponentType<{ data: any; style?: any; className?: string }> }>
> = {
${registryEntries.join('\n')}
};
`;
    fs.writeFileSync(registryPath, registryContent);
    console.log(`✓ registry.ts  (${Object.values(ELEMENTS).flatMap(d => d.aliases).length} aliases)`);

  } finally {
    // Clean up tmp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

**Step 2: Run the script to see what errors come up**

```bash
cd /path/to/selorax-canvas
tsx scripts/elements-generate.ts
```

The script will fail on any component export name that doesn't match. That's expected — next task fixes those.

**Step 3: Commit the script**

```bash
git add scripts/elements-generate.ts
git commit -m "feat: add elements-generate script (esbuild adapter bundles)"
```

---

## Task 3: Verify component export names and fix mismatches

**Context:** The script assumes specific named exports from each source file (e.g., `CountdownComponent`, `MarqueeComponent`). These may not match the actual export names. Check each file and update the `ELEMENTS` map in the script.

**Step 1: Check each source file's React component export name**

Run these greps to find the actual component const names:
```bash
grep -n "^const \|^export const \|^export function " \
  apps/canvas-v2/src/components/custom-registry/Countdown.tsx \
  apps/canvas-v2/src/components/custom-registry/CustomMarquee.tsx \
  apps/canvas-v2/src/components/custom-registry/Custom-Accordian.tsx \
  apps/canvas-v2/src/components/custom-registry/Custom-Category.tsx \
  apps/canvas-v2/src/components/custom-registry/Custom-Gallery.tsx \
  apps/canvas-v2/src/components/custom-registry/CustomHtml.tsx \
  apps/canvas-v2/src/components/custom-registry/CustomSlider.tsx \
  apps/canvas-v2/src/components/custom-registry/CusotmCarousel.tsx \
  apps/canvas-v2/src/components/custom-registry/ImageCarousel.tsx \
  apps/canvas-v2/src/components/custom-registry/ListBlock.tsx \
  apps/canvas-v2/src/components/custom-registry/ListDetails.tsx \
  apps/canvas-v2/src/components/custom-box.tsx \
  apps/canvas-v2/src/components/custom-quotes.tsx \
  apps/canvas-v2/src/components/custom-sequence.tsx \
  apps/canvas-v2/src/components/custom-step.tsx \
  apps/canvas-v2/src/components/custom-video.tsx
```

**Step 2: Update `ELEMENTS` map in `scripts/elements-generate.ts`**

For each mismatch, update the `componentExport` field to the actual name from the source file.

Note: If a component is not exported (only the `Def` is exported), add `export` to the component const in the source file. Example — for `CountdownComponent` in `Countdown.tsx`:
```typescript
// Change:
const CountdownComponent: React.FC<...> = ...
// To:
export const CountdownComponent: React.FC<...> = ...
```

Do this for any component that needs to be accessible to the adapter.

**Step 3: Run the script again**

```bash
tsx scripts/elements-generate.ts
```

Expected output:
```
✓ countdown.js  (aliases: countdown)
✓ marquee.js  (aliases: marquee, marquee_slider)
✓ accordion.js  (aliases: accordion)
... (one line per element)
✓ registry.ts  (N aliases)
```

If esbuild fails with import errors, the component export name is still wrong — fix and re-run.

**Step 4: Commit export additions**

```bash
git add apps/canvas-v2/src/components/custom-registry/*.tsx apps/canvas-v2/src/components/custom-*.tsx
git commit -m "fix: export component fns from custom element files for elements-generate"
```

---

## Task 4: Verify generated output and commit it

**Step 1: Check generated files exist**

Run:
```bash
ls packages/renderer/src/elements/
```
Expected: `countdown.js`, `marquee.js`, `accordion.js`, ... , `registry.ts`

**Step 2: Spot-check registry.ts**

Run:
```bash
cat packages/renderer/src/elements/registry.ts
```
Expected: Contains all aliases from CUSTOM_BLOCKS (countdown, marquee, accordion, carousel, etc.)

**Step 3: Spot-check a bundle**

Run:
```bash
head -5 packages/renderer/src/elements/countdown.js
```
Expected: valid ESM JS, starts with `import React from 'react'` or similar. Should NOT contain `onUpdate` function code (esbuild dead-code eliminates it since `isPreview=true` branch is constant).

**Step 4: Commit generated output**

```bash
git add packages/renderer/src/elements/
git commit -m "feat: generated custom element bundles and registry"
```

---

## Task 5: Add Makefile target

**Files:**
- Modify: `Makefile` (monorepo root)

**Step 1: Add elements-generate target**

Open `Makefile`. After the `stdb-generate` block, add:

```makefile
elements-generate:
	tsx scripts/elements-generate.ts
	@echo "✓ Custom element bundles written to packages/renderer/src/elements/"
```

Also add `elements-generate` to the `.PHONY` line at the top.

**Step 2: Test it**

```bash
make elements-generate
```

Expected: same output as running `tsx scripts/elements-generate.ts` directly.

**Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add elements-generate make target"
```

---

## Task 6: Update PageRenderer to handle customType nodes

**Files:**
- Modify: `packages/renderer/src/PageRenderer.tsx`

**Context:**
- `RenderComponent` currently: if `node.url` is set → dynamic CDN import; if not → gray placeholder
- New branch needed: if `node.settings?.customType` is set → use `CUSTOM_ELEMENT_REGISTRY`
- `node.settings` is the full settings object from STDB: `{ customType: 'countdown', data: { duration: '24h', ... } }`

**Step 1: Write the test first**

Create `packages/renderer/src/__tests__/custom-elements.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
```

**Step 2: Run tests (should fail)**

```bash
cd packages/renderer
npx vitest run src/__tests__/custom-elements.test.tsx
```

Expected: FAIL — `RenderComponent` doesn't handle `customType` yet.

**Step 3: Update `PageRenderer.tsx`**

Add import at the top:
```typescript
import { CUSTOM_ELEMENT_REGISTRY } from './elements/registry';
```

Replace the `RenderComponent` function (currently at lines 82–100):

```typescript
function RenderComponent({ node, styles, data }: any) {
  const customType: string | undefined = node.settings?.customType;

  // Branch A: built-in custom element from generated registry
  if (customType) {
    return <RenderCustomElement customType={customType} data={node.settings?.data ?? {}} styles={styles} />;
  }

  // Branch B: CDN-hosted ESM component (existing behaviour)
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
    if (!loader) return;
    loader()
      .then(m => { CUSTOM_ELEMENT_CACHE.set(customType, m.default); setComp(() => m.default); })
      .catch(() => null);
  }, [customType]);

  if (!Comp) return <div style={{ ...styles, minHeight: 60 }} />;
  return <div style={styles}><Comp data={data} /></div>;
}
```

**Important:** The hooks (`useState`, `useEffect`) in `RenderComponent` must only run when the CDN branch is taken. Since React hooks can't be conditional, split into two separate components as shown above — this is the correct approach.

**Step 4: Run tests again**

```bash
cd packages/renderer
npx vitest run src/__tests__/custom-elements.test.tsx
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add packages/renderer/src/PageRenderer.tsx packages/renderer/src/__tests__/custom-elements.test.tsx
git commit -m "feat: renderer handles customType nodes via generated element registry"
```

---

## Task 7: End-to-end smoke test

**Context:** Verify a custom element node actually renders in the storefront/preview. You'll need a canvas page that has a custom element node in STDB.

**Step 1: Confirm test page has a custom element**

If there isn't one, add a countdown node via the canvas editor — drag a Countdown element onto the canvas and save. Note the `page_id`.

**Step 2: Start preview server and open the page**

```bash
npm run dev --workspace=apps/preview-server
```

Open `http://localhost:3004/<page-id>` in the browser.

Expected: The countdown timer renders (showing days/hours/minutes/seconds), NOT the gray "Component URL missing" placeholder.

**Step 3: Check storefront**

```bash
# First publish the page via backend API
curl -X POST http://localhost:3001/api/pages/<page-id>/publish \
  -H 'x-tenant-id: store_001'

# Then open storefront
# Start storefront if not running
npm run dev --workspace=apps/storefront
```

Open `http://localhost:3003/<tenant-id>/<slug>` in the browser.

Expected: Same countdown renders on the published storefront page.

---

## Task 8: Add CI / stale-check note to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (monorepo root)

**Step 1: Add elements-generate to Dev Commands section**

In `CLAUDE.md`, under `## Dev Commands`, add:
```markdown
make elements-generate     # Regenerate custom element bundles (run after adding/modifying custom elements)
```

And add a rule under `## Non-Negotiable Rules`:
```markdown
8. **`make elements-generate` after every custom element change** — regenerates bundles in packages/renderer/src/elements/
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document elements-generate in CLAUDE.md"
```

---

## Done

After all tasks, verify all renderer tests still pass:

```bash
cd packages/renderer
npx vitest run
```

Expected: all tests pass including the 3 new custom-element tests.
