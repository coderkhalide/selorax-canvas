#!/usr/bin/env tsx
/**
 * Migrates 14 custom components from static registry to MySQL Component table.
 * Usage: cd apps/canvas-v2 && npx tsx scripts/migrate-components.ts
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const TENANT_ID = process.env.TENANT_ID ?? "store_001";

const COMPONENTS = [
  { key: "boxes", name: "Boxes Grid", category: "Layout" },
  { key: "quotes", name: "Testimonial Quotes", category: "Social Proof" },
  { key: "sequence", name: "Steps Sequence", category: "Content" },
  { key: "steps", name: "Numbered Steps", category: "Content" },
  { key: "video-card", name: "Video Card", category: "Media" },
  { key: "list", name: "Feature List", category: "Content" },
  { key: "carousel", name: "Image Carousel", category: "Media" },
  { key: "countdown", name: "Countdown Timer", category: "Marketing" },
  { key: "slider", name: "Custom Slider", category: "Media" },
  { key: "marquee", name: "Scrolling Marquee", category: "Marketing" },
  { key: "category", name: "Category Grid", category: "E-commerce" },
  { key: "gallery", name: "Image Gallery", category: "Media" },
  { key: "accordion", name: "Accordion FAQ", category: "Content" },
  { key: "html", name: "Custom HTML", category: "Advanced" },
];

async function migrateComponent(comp: (typeof COMPONENTS)[0]) {
  console.log(`Migrating: ${comp.name}...`);
  const res = await fetch(`${BACKEND_URL}/api/components`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": TENANT_ID,
    },
    body: JSON.stringify({
      name: comp.name,
      category: comp.category,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Failed to register ${comp.name}:`, err);
    return;
  }

  const data = await res.json();
  const id = data.id ?? data.component?.id;
  console.log(`  Registered: ${comp.name} (id: ${id})`);
}

async function main() {
  console.log(
    `Starting component migration → ${BACKEND_URL} (tenant: ${TENANT_ID})`
  );
  for (const comp of COMPONENTS) {
    await migrateComponent(comp);
  }
  console.log("Done!");
}

main().catch(console.error);
