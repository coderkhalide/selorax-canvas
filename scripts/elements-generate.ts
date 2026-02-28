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
    componentExport: 'GalleryComponent',
    aliases: ['gallery', 'image_gallery', 'imageGallery', 'product_gallery', 'productGallery'],
  },
  html: {
    importPath: './custom-registry/CustomHtml',
    componentExport: 'CustomHtmlComponent',
    aliases: ['html', 'custom_html'],
  },
  hero_slider: {
    importPath: './custom-registry/CustomSlider',
    componentExport: 'HeroSliderComponent',
    aliases: ['hero_slider', 'hero'],
  },
  custom_carousel: {
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
    componentExport: 'ListWithDetailsComponent',
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

      // Bundle with esbuild — write:false so we can strip machine-specific path comments
      const outFile = path.join(OUT_DIR, `${slug}.js`);
      const result = await build({
        entryPoints: [adapterPath],
        bundle: true,
        format: 'esm',
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        write: false,
        // Suppress warnings about browser APIs (window.innerWidth etc.)
        platform: 'browser',
        target: 'es2020',
        // Silence "use client" directive warnings
        logOverride: { 'ignored-bare-import': 'silent' },
        legalComments: 'none',   // removes license/source comments
        banner: {},               // no extra banners
      });

      // Strip esbuild's file-path annotation comments (// /path/to/file.tsx lines)
      // These contain machine-specific temp directory paths and cause non-deterministic output.
      const rawJs = result.outputFiles[0].text;
      const cleanJs = rawJs
        .split('\n')
        .filter(line => !/^\/\/ .*\.(tsx?|jsx?|js)$/.test(line.trim()))
        .join('\n');
      fs.writeFileSync(outFile, cleanJs);

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
