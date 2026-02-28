import { GoogleGenAI } from "@google/genai";
import { CUSTOM_BLOCKS } from "../components/custom-registry";
import { SettingSchema, FunnelElement } from "../types";
import { getRuntimeApiKey } from "./runtimeApiKey";
import { generateElementName, resetNamingSession } from "../utils/elementNaming";

const getClient = () => {
  const apiKey = getRuntimeApiKey("gemini");
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local or enter it in the editor header.",
    );
  }
  return new GoogleGenAI({ apiKey });
};

// Retry utility function with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isRetryableError =
        error?.status === "UNAVAILABLE" ||
        error?.message?.includes("overloaded") ||
        error?.message?.includes("503");

      if (isLastAttempt || !isRetryableError) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(
        `API request failed (attempt ${
          attempt + 1
        }/${maxRetries}), retrying in ${delay}ms...`,
        error?.message || error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
};

// Helper to generate TS types from our SettingSchema
const getTsType = (schema: SettingSchema): string => {
  if (["text", "textarea", "select", "color", "icon"].includes(schema.type))
    return "string";
  if (schema.type === "number_slider") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array")
    return `${schema.itemType === "number_slider" ? "number" : "string"}[]`;
  if (schema.type === "array_object" && schema.itemSchema) {
    const props = Object.entries(schema.itemSchema)
      .map(([k, s]) => `${k}: ${getTsType(s)}`)
      .join("; ");
    return `{ ${props} }[]`;
  }
  return "any";
};

const generateCustomComponentSchemas = () => {
  const entries = Object.entries(CUSTOM_BLOCKS);

  return entries
    .map(([key, def], i) => {
      const props = Object.entries(def.settings)
        .map(([k, s]) => {
          return `     ${k}: ${getTsType(s)}; // ${s.description || s.label}`;
        })
        .join("\n");
      return `${i + 1}. ${
        def.name
      } (customType: '${key}')\n   data: {\n${props}\n   }`;
    })
    .join("\n\n");
};

const SCHEMA_DEF = `
DATA MODEL DEFINITION:

type ElementType = 'section' | 'wrapper' | 'row' | 'col' | 'headline' | 'paragraph' | 'button' | 'image' | 'video' | 'input' | 'icon' | 'custom';

interface FunnelElement {
  id: string; // ⚠️ MANDATORY - EVERY element MUST have a UNIQUE id!
  type: ElementType;
  name: string;
  content?: string;
  src?: string;
  placeholder?: string;
  style: React.CSSProperties;
  tabletStyle?: React.CSSProperties;
  mobileStyle?: React.CSSProperties;
  className?: string;
  children?: FunnelElement[];

  // FOR CUSTOM COMPONENTS
  customType?: string;
  data?: any;
}

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: UNIQUE ID REQUIREMENT - ABSOLUTELY MANDATORY FOR EVERY ELEMENT
═══════════════════════════════════════════════════════════════════════════════

EVERY SINGLE ELEMENT (including children) MUST have a unique "id" field.
This is NON-NEGOTIABLE and CANNOT be skipped.

WHY IDs ARE CRITICAL:
- The theme builder uses IDs to target and update specific elements
- All editing tools (updateElement, deleteElement, editElementById) require valid IDs
- Element selection, screenshots, and verification depend on unique IDs
- Duplicate or missing IDs will cause the entire editor to malfunction

ID GENERATION RULES:
1. Use descriptive kebab-case: "hero-section", "features-row-1", "cta-button"
2. Add numeric suffixes for similar elements: "feature-card-1", "feature-card-2", "feature-card-3"
3. IDs must be UNIQUE across the ENTIRE page - absolutely NO duplicates
4. Format recommendation: [section]-[element-type]-[number]

EXAMPLES OF CORRECT IDs:
- Sections: "hero-section", "features-section", "testimonials-section", "cta-section"
- Headlines: "hero-headline", "features-title", "cta-headline", "feature-title-1"
- Paragraphs: "hero-description", "feature-desc-1", "feature-desc-2", "cta-subtext"
- Buttons: "hero-cta-btn", "secondary-btn", "pricing-btn-1", "pricing-btn-2"
- Icons: "feature-icon-1", "feature-icon-2", "trust-icon-1", "badge-icon"
- Rows/Cols: "hero-row", "features-row", "hero-left-col", "hero-right-col", "feature-col-1"
- Wrappers: "hero-wrapper", "card-wrapper-1", "content-wrapper"
- Custom: "features-grid", "testimonials-carousel", "countdown-timer", "pricing-table"

⚠️ VALIDATION: Any element missing an "id" field makes the output INVALID.

CUSTOM COMPONENT DATA SCHEMAS:
${generateCustomComponentSchemas()}

 When user give you prompt to build a landing page then you must follow the following guidelines and also we have some custom components that you can use to build the landing page. Strongly prefer using the custom components when they fit the content, but you may also use basic section/row/col layouts if that creates a better, more unique design from the user's content.

AVAILABLE CUSTOM COMPONENTS (Quick Reference):
- list: Simple List (bullets/checkmarks)
- detail_list: Detail List (feature cards with descriptions)
- boxes: Boxed cards grid/list (benefits, USPs, highlights)
- carousel: Image Carousel for product or UI screenshots
- gallery: Visual gallery section (lifestyle or product shots)
- quotes: Testimonials/quotes with grid/carousel layouts
- sequence: Number/icon + text steps (vertical/grid)
- step: Text-only step rows (pyramid/flat stripes)
- countdown: Countdown Timer

AVAILABLE CSS PROPERTIES:
- Layout: display (flex/grid), flexDirection, justifyContent, alignItems, gap, gridTemplateColumns.
- Sizing: width, height, min/max, flexGrow.
- Spacing: padding, margin.
- Typography: fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, color, textAlign.
- Appearance: backgroundColor, opacity, border, borderRadius, boxShadow.
- Transforms: transform.
- Positioning: position (relative/absolute/sticky), top/right/bottom/left, zIndex.
`;

const DESIGN_GUIDELINES = `
DESIGN GUIDELINES v2 (EXTENDED + STRICT):

0. AI-POWERED THEME COLOR GENERATION (NEW - CRITICAL):
   - When user provides CONTENT + THEME COLOR together:
       * FIRST: Extract the theme color from user input (hex, rgb, or color name)
       * SECOND: Use that color as the PRIMARY color for the landing page
       * THIRD: Generate a complete, harmonious color palette based on that primary color:
           - Primary color (user provided)
           - Primary hover (darker shade - 12% darker)
           - Heading color (45% darker, 10% more saturated)
           - Text color (60% darker, 20% less saturated)
           - Background (85% lighter, 50% less saturated)
           - Border (80% lighter, 60% less saturated)
           - Secondary/accent colors (complementary hues)
       * FOURTH: Return both the generated THEME and the LANDING PAGE COMPONENTS
   - Think like a professional brand designer - ensure:
       * High contrast for readability (WCAG AA minimum)
       * Emotional alignment (e.g., blue for trust, orange for energy, green for health)
       * Consistent color hierarchy throughout the page
   - Example: If user says "Create landing page for fitness coaching with green theme"
       * Extract: green → Convert to hex (e.g., #10B981)
       * Generate palette: primary #10B981, heading #065f46, text #064e3b, bg #ecfdf5, etc.
       * Build landing page using this generated theme

0.1 BRAND CONSISTENCY & THEMING (CRITICAL):
   - IF the user provides a specific color (hex/name) in the prompt:
       * Use that as the PRIMARY color.
       * Generate a complementary palette as described above.
   - IF NO color is provided:
       * YOU MUST USE CSS VARIABLES from the current theme.
       * Primary Color: var(--color-primary)
       * Background: var(--color-background)
       * Text: var(--color-foreground)
       * Heading: var(--color-foreground-heading)
       * Border: var(--color-border)
       * Buttons: var(--color-primary-button-background) & var(--color-primary-button-text)
       * Inputs: var(--color-input-background) & var(--color-input-text-color)
   - DO NOT hardcode colors (like #000000, #ffffff) unless specifically requested or for neutral shades (white/black overlays).
   - ALWAYS prefer CSS variables to ensure the design adapts to the user's active theme.

0.1. IMAGE CONSISTENCY (CRITICAL):
   - If the user provides an image → YOU MUST USE IT.
   - You MUST optimize the design for proper image presentation:
        * Maintain correct aspect ratio.
        * Use object-fit: "cover".
        * Apply rounded corners + soft shadow.
        * Ensure image never stretches horizontally or vertically.
   - NEVER place an image inside a container that causes distortion.
   - Make sure images never exceed their parent container width.

0.2. IMAGE SIZE RULES:
   - ALWAYS wrap images inside a container with:
        width: "100%";
        maxWidth: "600px";
        borderRadius: "1rem";
        overflow: "hidden";
   - Use objectFit ONLY as:
        objectFit: "cover";
   - Do NOT use fixed height unless explicitly required.
   - If height must be fixed → maintain aspect ratio.

1. STYLE REFERENCE:
  - Aesthetic: Premium, high-end, conversion-focused landing pages.
  - Big bold typography (Inter, Poppins, Roboto — weight 700–900).
  - High contrast CTAs.
  - Large sectional padding (min 4rem top & bottom).
  - Controlled whitespace to avoid crowding and create an editorial feel.

1.1. PREMIUM VISUAL TOKENS (GLOBAL):
  - Overall vibe: premium, high-end, clean, not cheap or cluttered.
  - Surfaces:
      * Base surface: var(--color-background)
      * Elevated surface: "rgba(15,23,42,0.03)" with border: "1px solid var(--color-border)"
  - Cards and boxes:
      * borderRadius: "1.5rem";
      * padding: "2rem";
      * boxShadow: "0 24px 60px rgba(15,23,42,0.20)";
  - Use consistent spacing tokens between sections (2–4rem vertical gaps).
  - Shadow presets:
      * Soft card: "0 18px 45px rgba(15,23,42,0.16)";
      * Floating card: "0 26px 70px rgba(15,23,42,0.26)";
      * Subtle inset: "inset 0 0 0 1px rgba(148,163,184,0.35)";
  - Grid behavior:
      * Use 2–4 columns on desktop and 1 column on mobile for cards and feature grids.
      * Keep equal card heights inside the same row to feel orderly and luxurious.
      * Use generous gaps between cards (gap: 24–32) so design can breathe.
  - Luxury overlay shapes:
      * Use soft blurred gradient circles or ovals behind hero, feature, or CTA sections.
      * Derive colors from the active theme (primary or accent), then lower opacity.
      * Position shapes with position: "absolute" inside a containing element, never causing horizontal scrollbars.
      * Never overlap or reduce readability of main headlines, body text, or buttons.

2. PAGE STRUCTURE RULES:
   - Build everything using:
        section → row → col
   - Each “section” MUST have:
        width: "100%";
        maxWidth: "1200px";
        margin: "0 auto";
        padding: "2rem 1rem";
   - Alternate backgrounds every section:
        * White
        * Light Gray (#f7f7f7)
        * Brand-light tint (#brandColor15%)
   
   MANDATORY SECTIONS FOR ALL LANDING PAGES:
   1. Hero Section (headline + CTA + image)
   2. Features/Benefits Section (use detail_list component)
   3. PROCESS/HOW IT WORKS Section (MUST use 'circle' or 'step' component)
      - For consulting/services → USE circle (customType: 'circle')
      - For products/SaaS → USE step (customType: 'step')
      - This is NOT optional - ALWAYS include this section
   4. Testimonials/Social Proof Section (optional but recommended)
   5. CTA Section (with countdown if applicable)
   
   CRITICAL: Every landing page MUST include at least ONE custom component from:
   - circle (for cyclical/methodological processes)
   - countdown (for limited offers)
   - detail_list (for feature showcases)

3. COMPONENT USAGE:
   - Use Custom Components based on content intent:
       * list → simple bullet/checkmark lists, pricing features
       * detail_list → feature cards with icons and descriptions
       * boxes → compact card boxes for benefits/features/highlights; use grid with 2–4 columns on desktop, 1 column on mobile
       * quotes → testimonials/quotes; use carousel on mobile if multiple items, grid on desktop; include author when available
       * sequence → numbered/icon steps with descriptive text; ideal for "Step 1..5" type flows; supports vertical and grid variants; use when numbering or icons are provided
       * step → text-only steps/points in striped rows (pyramid-left/right or flat); ideal for longer Bengali content lines without icons; adjust mobile/desktop padding and text size
       * carousel → image galleries, testimonials slider
       * circle → cyclical/interconnected flows; "Service Cycle", "Methodology"; layouts: circle-classic, half-arc, cards-center, staircase, honeycomb
       * countdown → urgency timers for limited-time offers; add when prompt mentions deadline/offer/limited/আজই/মাত্র X দিন
   
   MAXIMIZE UNIQUENESS & THEME INTEGRATION (ATOMIC DESIGN FIRST):
   - Your PRIMARY goal is to create TRULY UNIQUE, BRAND-ALIGNED landing pages using ATOMIC ELEMENTS.
   - STOP relying on "custom components" for basic layout.
   - INSTEAD, compose layouts using the atomic building blocks:
     * STRUCTURE: Section > Wrapper > Row/Columns
     * CONTENT: Headline, Paragraph, Button, Image, Icon
     * STYLING: Use 'box' wrappers with shadows, borders, and padding to create cards.

   - WHEN TO USE CUSTOM COMPONENTS:
     * Use them ONLY for complex interactivity or specialized visualizations that are hard to build manually.
     * ALLOWED Custom Components: 'carousel' (sliders), 'countdown' (timers), 'circle' (complex diagrams), 'sequence' (complex steps).
     * AVOID Custom Components for simple grids (features, testimonials) - build them with atomic Rows/Cols instead!

   - THEME BUILDER POWER:
     * EVERY element must use CSS variables from the theme.
     * Primary: var(--color-primary)
     * Background: var(--color-background)
     * Surface/Card: var(--color-input-background) or lighter opacity of primary.

   MANDATORY USAGE:
   - EVERY landing page MUST include a "How It Works" or "Our Process" section.
   - TRY to build this using atomic elements (Rows/Cols) for a unique look first. 
   - ONLY use 'circle' components if the process is too complex to build manually.
   - If page has limited-time offer → MUST include countdown component.

   3.2. ATOMIC DESIGN EXAMPLES (PREFERRED):

   Example A: Hero Section (Atomic - SaaS Style)
   {
     "type": "section",
     "styles": { "padding": "80px 0", "backgroundColor": "var(--color-background)" },
     "children": [
       {
         "type": "wrapper",
         "styles": { "maxWidth": "1200px", "margin": "0 auto" },
         "children": [
           {
             "type": "2-columns",
             "props": { "gap": "40px", "alignItems": "center" },
             "children": [
               {
                 "type": "wrapper", 
                 "styles": { "display": "flex", "flexDirection": "column", "gap": "20px" },
                 "children": [
                    { "type": "headline", "props": { "tag": "h1", "text": "Transform Your Business" }, "styles": { "color": "var(--color-foreground-heading)", "fontSize": "48px" } },
                    { "type": "paragraph", "props": { "text": "We help you grow..." }, "styles": { "color": "var(--color-foreground)", "fontSize": "18px" } },
                    { "type": "button", "props": { "text": "Get Started", "variant": "primary" } }
                 ]
               },
               {
                 "type": "image",
                 "props": { "src": "hero-image.png", "alt": "Hero" },
                 "styles": { "borderRadius": "16px", "boxShadow": "0 20px 40px rgba(0,0,0,0.1)" }
               }
             ]
           }
         ]
       }
     ]
   }

   Example B: Hero Section (Funnel / Direct Response - "Bonaji" Style)
   {
     "type": "section",
     "styles": { "padding": "60px 0", "backgroundColor": "var(--color-background)", "textAlign": "center" },
     "children": [
       {
         "type": "wrapper",
         "styles": { "maxWidth": "900px", "margin": "0 auto", "display": "flex", "flexDirection": "column", "alignItems": "center", "gap": "30px" },
         "children": [
            { "type": "headline", "props": { "tag": "h2", "text": "⚠️ গ্যাস্ট্রিকের সমস্যায় ভুগছেন?" }, "styles": { "color": "#ef4444", "fontSize": "24px", "fontWeight": "bold" } },
            { "type": "headline", "props": { "tag": "h1", "text": "আর নয় ওষুধ! প্রাকৃতিকভাবে গ্যাস্ট্রিক কমান ১ দিনেই" }, "styles": { "color": "var(--color-foreground-heading)", "fontSize": "42px", "lineHeight": "1.2" } },
            {
              "type": "wrapper",
              "styles": { "border": "4px solid var(--color-primary)", "borderRadius": "20px", "overflow": "hidden", "boxShadow": "0 20px 50px rgba(0,0,0,0.2)" },
              "children": [
                { "type": "image", "props": { "src": "product-hero.png" }, "styles": { "width": "100%", "maxWidth": "800px" } }
              ]
            },
            { "type": "button", "props": { "text": "অর্ডার করতে চাই - Order Now", "variant": "primary" }, "styles": { "fontSize": "24px", "padding": "20px 60px", "animation": "pulse 2s infinite" } },
            { "type": "paragraph", "props": { "text": "⭐⭐⭐⭐⭐ ৫০০০+ মানুষ এটি ব্যবহার করছেন" }, "styles": { "color": "var(--color-foreground-muted)" } }
         ]
       }
     ]
   }

   Example C: Feature Grid (Atomic - Better than 'boxes' component)
   {
     "type": "section",
     "children": [
       {
         "type": "wrapper",
         "children": [
           { "type": "headline", "props": { "text": "Our Features", "align": "center" } },
           {
             "type": "3-columns",
             "props": { "gap": "30px" },
             "children": [
               {
                 "type": "wrapper",
                 "styles": { "padding": "30px", "backgroundColor": "var(--color-input-background)", "borderRadius": "12px", "border": "1px solid var(--color-border)" },
                 "children": [
                   { "type": "icon", "props": { "name": "Zap", "size": 32, "color": "var(--color-primary)" } },
                   { "type": "headline", "props": { "tag": "h3", "text": "Fast Performance" } },
                   { "type": "paragraph", "props": { "text": "Optimized for speed..." } }
                 ]
               },
               { "type": "wrapper", "styles": { "padding": "30px", "backgroundColor": "var(--color-input-background)", "borderRadius": "12px", "border": "1px solid var(--color-border)" }, "children": [...] },
               { "type": "wrapper", "styles": { "padding": "30px", "backgroundColor": "var(--color-input-background)", "borderRadius": "12px", "border": "1px solid var(--color-border)" }, "children": [...] }
             ]
           }
         ]
       }
     ]
   }

   Example D: Product Breakdown (Funnel Style - Atomic)
   {
     "type": "section",
     "styles": { "padding": "60px 0", "backgroundColor": "#fff" },
     "children": [
       {
         "type": "wrapper",
         "styles": { "maxWidth": "1000px", "margin": "0 auto" },
         "children": [
           { "type": "headline", "props": { "text": "কেন এই পণ্যটি আপনার জন্য সেরা?", "align": "center" }, "styles": { "color": "var(--color-foreground-heading)", "marginBottom": "40px" } },
           {
             "type": "2-columns",
             "props": { "gap": "40px", "alignItems": "center" },
             "children": [
               {
                 "type": "image",
                 "props": { "src": "product-detail.png" },
                 "styles": { "borderRadius": "12px", "border": "2px solid var(--color-border)" }
               },
               {
                 "type": "wrapper",
                 "styles": { "display": "flex", "flexDirection": "column", "gap": "20px" },
                 "children": [
                   {
                      "type": "wrapper",
                      "styles": { "padding": "20px", "backgroundColor": "var(--color-input-background)", "borderRadius": "10px", "borderLeft": "4px solid var(--color-primary)" },
                      "children": [
                        { "type": "headline", "props": { "tag": "h4", "text": "✅ ১০০% প্রাকৃতিক উপাদান" } },
                        { "type": "paragraph", "props": { "text": "কোনো কেমিক্যাল নেই, তাই পার্শ্বপ্রতিক্রিয়া মুক্ত।" } }
                      ]
                   },
                   {
                      "type": "wrapper",
                      "styles": { "padding": "20px", "backgroundColor": "var(--color-input-background)", "borderRadius": "10px", "borderLeft": "4px solid var(--color-primary)" },
                      "children": [
                        { "type": "headline", "props": { "tag": "h4", "text": "✅ দ্রুত ফলাফল" } },
                        { "type": "paragraph", "props": { "text": "মাত্র ৭ দিনেই পরিবর্তন লক্ষ্য করতে পারবেন।" } }
                      ]
                   }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }

   3.3. CUSTOM COMPONENT EXAMPLES (ONLY WHEN NEEDED):

   Circle Component Example:
   {
     "type": "custom",
     "customType": "circle",
     "name": "Process Circle",
     "style": { "width": "100%", "padding": "20px" },
     "data": {
       "layout": "circle-classic",
       "items": [
         { "text": "Analysis phase" },
         { "text": "Planning phase" },
         { "text": "Execution phase" },
         { "text": "Review phase" },
         { "text": "Optimize phase" }
       ],
       "circleColor": "#10b981",
       "textColor": "#111827",
       "circleSize": 450
     }
   }

   Carousel Component Example:
   {
     "type": "custom",
     "customType": "carousel",
     "name": "Product Image Carousel",
     "style": { "width": "100%" },
     "data": {
       "images": [
         { "image": "https://picsum.photos/600/600?1" },
         { "image": "https://picsum.photos/600/600?2" },
         { "image": "https://picsum.photos/600/600?3" }
       ],
       "image_fit": "cover",
       "image_gap": 16,
       "desktop_items": 3,
       "mobile_items": 1,
       "enableAutoplay": true,
       "autoplayInterval": 3000
     }
   }

   Gallery Component Example:
   {
     "type": "custom",
     "customType": "gallery",
     "name": "Lifestyle Gallery",
     "style": { "width": "100%" },
     "data": {
       "gap": 16,
       "borderRadius": 16,
       "hoverEffect": "zoom",
       "items": [
         { "image": "https://picsum.photos/600/600?tea1", "size": "normal" },
         { "image": "https://picsum.photos/600/600?tea2", "size": "wide" },
         { "image": "https://picsum.photos/600/600?tea3", "size": "tall" }
       ]
     }
   }

   Feature Grid Component Example:
   {
     "type": "custom",
     "customType": "boxes",
     "name": "Key Benefits",
     "style": { "width": "100%" },
     "data": {
       "variant": "neon",
       "gap": 24,
       "items": [
         { "title": "দ্রুত ডেলিভারি", "description": "২৪ ঘন্টার মধ্যে ডেলিভারি", "icon": "Truck" },
         { "title": "খাঁটি মান", "description": "কোনো ভেজাল বা কৃত্রিম উপাদান নয়", "icon": "ShieldCheck" },
         { "title": "সহজ রিটার্ন", "description": "৭ দিনের ঝামেলাহীন রিটার্ন", "icon": "Undo2" }
       ]
     }
   }

3.3. QUICK DECISION MATRIX:

   Landing Page Type → Components to Include:
   
   Consulting/Agency:
   ✓ ATOMIC: Hero, Services Grid, Team, Testimonials
   ✓ CUSTOM (Optional): circle (methodology)
   
   SaaS/Software:
   ✓ ATOMIC: Hero, Feature Grid, Pricing Table
   ✓ CUSTOM (Optional): sequence (how it works), countdown (offer)
   
   E-commerce:
   ✓ ATOMIC: Product Showcase, Benefits Grid, Reviews
   ✓ CUSTOM (Optional): carousel (gallery), countdown (sale)
   
   ANY Landing Page:
   - PRIMARY: Use Atomic Elements (Sections, Wrappers, Rows, Cols)
   - SECONDARY: Use Custom Components ONLY for complex features (Timers, Sliders, Diagrams)

ECOMMERCE PRIORITY MODE (ATOMIC):
- Trigger: if the user mentions "ecommerce", "e‑commerce", "product", "shop", or "store".
- Strategy: Build unique product layouts using atomic elements.
- Required sections:
  1) Hero → Atomic (Headline + Image + CTA)
  2) USP Highlights → Atomic Grid (Icons + Text)
  3) Feature Details → Atomic Grid
  4) How to Use → Atomic Steps OR 'sequence' component (only if complex)
  5) Gallery → 'carousel' component (Allowed)
  6) Reviews → Atomic Testimonial Cards
  7) Final Offer → Atomic CTA + 'countdown' component

4. VISUAL POLISH (STRICT):
  - Overall style: premium, minimal, high-trust; no cheap or cluttered look.
  - Shadows: multi-layer soft shadows (no harsh edges).
  - Border Radius: minimum 1rem for modern softness (1.5rem on cards/boxes).
  - Gradients: allowed but subtle (no neon, no harsh transitions).
  - Spacing: always maintain *consistent vertical rhythm* (2–4rem gaps).
  - Alignment:
       * Use flex or grid to align content perfectly on both desktop and mobile.
       * Vertically center content within hero rows and key sections.
       * Align text baselines and card titles wherever possible for a clean grid.

5. TYPOGRAPHY RULES:
   - Headlines (H1/H2):
        fontWeight: 800;
        lineHeight: 1.1;
   - Body Text:
        fontSize: "1.1rem";
        lineHeight: 1.6;
        maxWidth: "650px";
   - List / Feature Items:
        iconLeft + short text; no long paragraphs.

6. COLOR PALETTE (If user gives no color):
   - Tech/SaaS: #4F46E5 (deep purple)
   - Marketing/Hype: #F97316 (bright orange)
   - Health/Wellness: #10B981 (green/teal)
   - Luxury: Black + Gold (#D97706)
   - Keep background contrast WCAG-accessible.

7. RESPONSIVE RULES (CRITICAL):
   - Mobile first.
   - Columns stack vertically when screen < 768px.
   - Image containers MUST auto-resize:
        width: "100%";
        maxWidth: "100%";
   - Text should remain center-aligned for mobile.
   - Buttons full-width on mobile → fixed size on desktop.

8. HERO SECTION RULES:
   - Use a MAX width constraint for text.
   - NEVER stretch hero images.
   - CTA must be visible without scrolling.

9. FIXED HEIGHT BAN:
   - Do NOT use any fixed height (450px, 600px) unless the user specifically asks for “full-screen hero.”
   - All sections must adjust height based on content.

10. LAYOUT STABILITY (IMPORTANT):
   - Prevent broken or misaligned elements:
     * No overlapping elements.
     * No clipped text.
     * No floating elements outside container.
   - Images must ALWAYS align within their column.
   - Prevent horizontal scrollbars at all costs.

11. PIC Fallback System:
   - If user provides no images:
       Use https://picsum.photos/seed/{keyword}/800/600
       Keywords must match the actual product or service context, not random city or street scenes.
       For example:
         * Honey or food products → "honey", "bees", "honey-jar", "flowers", "nature-warm"
         * Tech/SaaS → "dashboard", "app-ui", "laptop", "team-collaboration"
         * Consulting/agency → "meeting", "team", "office", "strategy"
         * Health/fitness → "fitness", "wellness", "yoga", "running"
   - Ensure random seeds are consistent in one page.

12. CTA / BUTTON RULES:
   - Always use brand primary.
   - Button styling:
        padding: "1rem 2rem";
        borderRadius: "0.75rem";
        fontWeight: 700;
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)";
   - Hover:
        transform: "translateY(-3px)";
       boxShadow: "0 8px 20px rgba(0,0,0,0.25)";
       transition: "transform 180ms ease-out, box-shadow 180ms ease-out";

13. ANTI-BROKEN IMAGE RULE:
  - Images must NEVER:
       * Stretch
       * Pixelate
       * Overflow container
       * Lose aspect ratio
  - Apply:
       width: "100%";
       height: "auto";

14. SECTION BALANCE:
  - Every section MUST have:
       * A clear headline
       * Supporting text
       * A visual element (image/icon)
       * Good whitespace
   - Section title styling:
        * Place section titles inside the section container, centered horizontally by default.
        * Allow left-aligned titles when it matches the brand tone, but keep consistent alignment across similar sections.
        * Add a subtle underline, pill or small accent shape behind the section label to visually separate sections.
        * Maintain consistent top spacing above titles (e.g., 0.5–1rem) and bottom spacing below titles (1–1.5rem) for a clean rhythm.

15. PREMIUM BASE ELEMENT STYLING (BUTTON, SECTION, TEXT, ICON):
  - Sections:
       * Use generous padding: "4rem 1.5rem" (hero can use "5rem 1.5rem").
       * Keep width: "100%", maxWidth: "1200px", margin: "0 auto".
       * Alternate subtle backgrounds to create depth (use theme variables, not random colors).
  - Headlines (headline type):
       * Use fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em".
       * Keep maxWidth: "700px" and marginBottom: "1.5rem".
  - Paragraphs (paragraph type):
       * Use fontSize: "1.05rem"–"1.15rem", lineHeight: 1.7.
       * Max width: "650px" and color: var(--color-foreground).
  - Buttons (button type):
       * Use primary brand background or premium gradient:
            background: "linear-gradient(135deg, var(--color-primary), rgba(15,23,42,1))";
       * Add subtle border: "1px solid rgba(15,23,42,0.18)".
       * Add icon on main CTA (iconRight: 'ArrowRight' or similar Lucide icon).
  - Icons (icon type and icons inside custom components):
       * Use Lucide React icons only, in PascalCase.
       * Keep size consistent (20–28px) with strokeWidth around 1.5.
       * Place icons inside soft circles or rounded squares for a premium feel when highlighting features.
   - Card animations (for components that support hover states):
        * Use very subtle scale and lift on hover (e.g., scale up to 1.02–1.04).
        * Pair scale with slightly stronger shadow to create a floating effect.
        * Use smooth transitions (150–220ms ease-out) for transform and box-shadow.

16. UNIQUE VISUAL LAYOUTS (EYE-CATCHING):
  - Alternate different section layouts down the page:
       * Split layout: text left, image/custom component right; next section reversed.
       * Full-width band: centered content with strong background and large padding.
       * Card grids: 2–4 cards with equal width and consistent height.
  - Use controlled overlaps to create depth:
       * Allow cards to slightly overlap hero background shapes or images using transform.
       * Never clip important content or cause horizontal scrollbars.
  - Use accent shapes and subtle patterns:
       * Soft blurred gradient circles behind hero content or feature cards.
       * Thin outline boxes with subtle glow to highlight key elements.
  - Always keep structure clean:
       * One primary focal point per section.
       * Do not overload with random shapes; every accent must support the message.
   - Overlay shape alignment:
        * Position overlay shapes relative to section containers, not the whole page.
        * Keep shapes anchored to corners or behind focal elements, not randomly placed.
        * Use zIndex so shapes stay behind text and CTAs but above the base background.

17. HERO VISUAL COMPOSITION (EYE-CATCHING):
  - Hero section must combine:
       * A small badge/pill above the headline (offer, category, or benefit).
       * A bold main headline and short supporting paragraph.
       * A primary CTA button with icon + secondary ghost/outline button.
       * A strong visual: product mockup, app UI, or lifestyle image, optionally combined with a custom component (detail_list, boxes).
  - Layout:
       * Use 2-column layout on desktop; stack to 1 column on mobile.
       * Keep text column slightly narrower than visual column for balance.
  - Background:
       * Use subtle gradient or tinted background behind the hero only.
       * Optionally add a soft glow or radial gradient behind the main image.
  - Social proof:
       * Add trust row under CTAs when possible (logos, star rating, short text).

18. UNIQUE DESIGN PER REQUEST (GLOBAL RULE):
  - Treat every new user request as a new brand and page:
       * Do NOT reuse the exact same section order, layout, and component mix from previous outputs.
       * Vary hero composition (image placement, component on left/right, background accents).
       * Vary which custom components are used where (detail_list vs boxes, etc.).
  - Layout variation strategy between requests:
       * Randomly choose between 2–3 valid layout patterns for each main section type.
       * Ensure the overall page silhouette (hero + mid sections + CTA) feels different across requests.
  - Visual variation:
       * Slightly adjust gradients, overlay shapes, and card shadows per request while staying on brand.
       * Use different Lucide icons for similar concepts when possible (e.g., Award vs BadgeCheck vs ShieldCheck).
  - Image variation:
       * When using fallback images, derive the seed from the specific request/topic so different prompts create different but internally consistent image sets.
  - Consistency within a single page:
       * Inside ONE page, keep spacing, typography, and color palette consistent.
       * Variation happens between different user prompts, not inside the same page.

8. ELEMENT NAMING (REQUIRED - CRITICAL):
   Every element MUST have a descriptive "name" field for the Layers panel. Names must be unique and descriptive.

   NAMING CONVENTIONS BY TYPE:
   - Sections: "Hero Section", "Features Section", "CTA Section", "Testimonials Section", "FAQ Section", "Pricing Section", "Footer Section"
   - Headlines: "Main Headline", "Section Title", "Subheadline", "Feature Title", "Card Title"
   - Paragraphs: "Description", "Body Text", "Sub-text", "Feature Description", "Card Description"
   - Buttons: "CTA Button", "Primary Button", "Secondary Button", "Action Button"
   - Images: "Hero Image", "Feature Image", "Product Image", "Background Image"
   - Rows: "Content Row", "Feature Row", "Hero Row", "Card Row"
   - Columns: "Left Column", "Right Column", "Center Column", "Content Column"
   - Icons: "Feature Icon", "Trust Badge", "Social Icon"
   - Custom Components: "Features", "Benefits", "Testimonials", "Pricing Table", "FAQ Accordion"

   RULES:
   - NEVER leave the "name" field empty or undefined
   - NEVER use generic names like "AI Generated", "Element", or just the type name
   - Each name should describe what the element IS or DOES
   - Use numbered suffixes for duplicates: "Feature 1", "Feature 2", "CTA Button 2"
   - Parent elements should have broader names, children should have specific names

   EXAMPLE:
   {
     "type": "section",
     "name": "Hero Section",  // REQUIRED - descriptive name
     "children": [
       { "type": "headline", "name": "Main Headline", "content": "..." },
       { "type": "paragraph", "name": "Hero Description", "content": "..." },
       { "type": "button", "name": "CTA Button", "content": "Get Started" }
     ]
   }

`;

const CONTENT_GUIDELINES = `
CONTENT WRITING GUIDELINES:
1. ROLE: You are an Expert Copywriter & Sales Funnel Strategist (like Russell Brunson or David Ogilvy).
2. EXPAND & PERSUADE:
   - If the user provides minimal info (e.g., "sell a coffee maker"), YOU MUST FILL IN THE GAPS.
   - Invent plausible features, benefits, testimonials, and guarantees.
   - Focus on "What's in it for them?" (Benefits > Features).
   - Use persuasive triggers: Scarcity, Urgency, Social Proof, Authority.
3. STRICT ADHERENCE (Override):
   - IF the user explicitly says "Use this exact text" or puts text in quotes, YOU MUST USE IT EXACTLY. Do not change it.
4. STRUCTURE:
   - Headlines: Punchy, curiosity-inducing, benefit-rich.
   - Body: Short paragraphs, bullet points, easy to scan.
   - CTAs: Action-oriented (e.g., "Yes! I Want This Upgrade", "Start My Free Trial").
`;

const ICON_GUIDELINES = `
ICON USAGE GUIDELINES (ABSOLUTELY CRITICAL - MUST FOLLOW):

=== EMOJIS ARE STRICTLY FORBIDDEN ===
- NEVER use emojis anywhere in the output
- FORBIDDEN characters: ⚡ 🚀 ✅ 🎨 📊 ❤️ 🔥 💡 ⭐ 💰 🎯 👥 📈 🛡️ etc.
- If you want to show an icon, use the "icon" element type with Lucide icons
- Any output containing emojis is INVALID and will be rejected

1. SOURCE: You MUST use icons from the 'Lucide React' library ONLY.
   - Icons are rendered via our "icon" element type
   - The "icon" property takes the Lucide icon name in PascalCase

2. FORMAT: Icon names MUST be in PascalCase format:
   CORRECT: "Zap", "Rocket", "Star", "CheckCircle", "BarChart3", "Palette", "Sparkles"
   WRONG: "zap", "rocket-icon", "check_circle", "bar-chart"

3. ICON ELEMENT STRUCTURE:
   {
     "type": "icon",
     "name": "Feature Icon",
     "content": "Zap",
     "style": { "color": "var(--color-primary)", "width": "24px", "height": "24px" }
   }

   IMPORTANT: For icon elements, the icon name goes in "content", NOT "icon"!

4. EMOJI TO LUCIDE ICON MAPPING (USE THESE):
   Instead of ⚡ use content: "Zap"
   Instead of 🚀 use content: "Rocket"
   Instead of 🎨 use content: "Palette"
   Instead of 📊 use content: "BarChart3"
   Instead of ✅ use content: "CheckCircle"
   Instead of ⭐ use content: "Star"
   Instead of 🔥 use content: "Flame"
   Instead of 💡 use content: "Lightbulb"
   Instead of 🛡️ use content: "Shield"
   Instead of 👥 use content: "Users"
   Instead of 📈 use content: "TrendingUp"
   Instead of 🎯 use content: "Target"
   Instead of 💰 use content: "DollarSign"
   Instead of ❤️ use content: "Heart"

5. CONTENT-SPECIFIC ICON SELECTION (CRITICAL - NEVER USE GENERIC ICONS):

   RULE: The icon MUST match the MEANING of the adjacent text/title. NEVER use "Star" as a default!

   DELIVERY/SHIPPING related text → "Truck", "Package", "Timer", "Clock"
   QUALITY/AUTHENTICITY related text → "BadgeCheck", "ShieldCheck", "Award", "CheckCircle"
   RETURN/REFUND related text → "Undo2", "RefreshCw", "RotateCcw"
   SPEED/FAST related text → "Zap", "Rocket", "Timer", "Gauge"
   SECURITY/SAFE related text → "Shield", "Lock", "ShieldCheck", "KeyRound"
   MONEY/PRICE related text → "DollarSign", "Wallet", "CreditCard", "Percent"
   SUPPORT/HELP related text → "Headphones", "MessageCircle", "LifeBuoy", "HelpCircle"
   GROWTH/SUCCESS related text → "TrendingUp", "ArrowUpRight", "Target", "Award"
   DESIGN/CREATIVE related text → "Palette", "Brush", "Layers", "Sparkles"
   ANALYTICS/DATA related text → "BarChart3", "LineChart", "PieChart", "Activity"
   AI/SMART related text → "Sparkles", "Brain", "Wand2", "Cpu"
   USER/COMMUNITY related text → "Users", "UserPlus", "Heart", "HeartHandshake"
   TIME/SCHEDULE related text → "Clock", "Calendar", "Timer", "Hourglass"
   DOCUMENT/FILE related text → "FileText", "ClipboardList", "Folder", "BookOpen"
   FEATURES/BENEFITS related text → Choose based on SPECIFIC feature, NOT generic "Star"

   EXAMPLES OF CORRECT ICON MATCHING:
   - "Fast Delivery" → icon: "Truck"
   - "100% Authentic" → icon: "BadgeCheck"
   - "Easy Returns" → icon: "Undo2"
   - "24/7 Support" → icon: "Headphones"
   - "Secure Payment" → icon: "Lock"
   - "Free Shipping" → icon: "Package"
   - "Money Back Guarantee" → icon: "Wallet"
   - "Premium Quality" → icon: "Award"
   - "Lightning Fast" → icon: "Zap"
   - "AI Powered" → icon: "Sparkles"

   WHEN TO USE "Star": ONLY for ratings, reviews, or explicitly star-related content (e.g., "5-Star Rating")

FINAL RULE: Text content like "Lightning Fast" should NOT have emojis prepended.
Use a wrapper with icon element + text element instead.
`;

const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  // Find the first occurrence of '{' or '['
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  let startIndex = 0;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  cleaned = cleaned.substring(startIndex);

  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);

  // Find the last occurrence of '}' or ']'
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");

  let endIndex = cleaned.length;
  if (lastBrace !== -1 && lastBracket !== -1) {
    endIndex = Math.max(lastBrace, lastBracket) + 1;
  } else if (lastBrace !== -1) {
    endIndex = lastBrace + 1;
  } else if (lastBracket !== -1) {
    endIndex = lastBracket + 1;
  }

  cleaned = cleaned.substring(0, endIndex);

  return cleaned.trim();
};

const stripJsonComments = (json: string): string => {
  let out = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    const next = json[i + 1];

    if (inString) {
      if (char === '"' && !isEscaped) {
        inString = false;
      } else if (char === "\\" && !isEscaped) {
        isEscaped = true;
      } else {
        isEscaped = false;
      }
      out += char;
      continue;
    }

    // Not in string
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    // Check for comments
    if (char === "/" && next === "/") {
      // Single line comment, skip until newline
      while (i < json.length && json[i] !== "\n") {
        i++;
      }
      // Keep the newline
      if (i < json.length) out += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      // Multi line comment, skip until */
      i += 2;
      while (i < json.length - 1 && !(json[i] === "*" && json[i + 1] === "/")) {
        i++;
      }
      i++; // Skip /
      continue;
    }

    out += char;
  }
  return out;
};

export const smartParsePartialJson = (
  json: string,
  isArray: boolean = true,
): any => {
  let cleaned = cleanJsonOutput(json);
  cleaned = stripJsonComments(cleaned);

  // Try parsing as is first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to fix
  }

  // Simple state machine to track context
  let inString = false;
  let isEscaped = false;
  const stack: ("OBJECT" | "ARRAY")[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") stack.push("OBJECT");
      else if (char === "[") stack.push("ARRAY");
      else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "OBJECT")
          stack.pop();
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "ARRAY")
          stack.pop();
      }
    }
  }

  let attempt = cleaned;

  // 1. Close string if open
  if (inString) {
    attempt += '"';
  }

  // 2. Close structures
  // A simpler heuristic:
  // If the last non-whitespace char is ':', we need a value. Append "null" or "\"\"".
  // If the last non-whitespace char is ',', we might remove it or append null.

  const trimmed = attempt.trim();
  if (trimmed.endsWith(",")) {
    attempt = trimmed.substring(0, trimmed.length - 1);
  } else if (trimmed.endsWith(":")) {
    attempt += " null";
  }

  // Now close the stack
  for (let i = stack.length - 1; i >= 0; i--) {
    const type = stack[i];
    if (type === "OBJECT") attempt += "}";
    else if (type === "ARRAY") attempt += "]";
  }

  try {
    return JSON.parse(attempt);
  } catch (e) {
    return null;
  }
};

export const generateCopy = async (
  prompt: string,
  context?: string,
): Promise<string> => {
  try {
    const fullPrompt = `
        Role: Expert Copywriter.
        Task: ${prompt}
        Current Content: "${context || ""}"
        
        Guidelines:
        1. EXPAND and ELABORATE on the existing ideas. Make the content longer and more detailed.
        2. Keep the expansion STRICTLY RELEVANT to the original topic. Do not drift into unrelated topics.
        3. Use persuasive language to enhance the points already present.
        4. Do NOT add completely new sections (like testimonials or pricing) unless the text is already about that.
        5. Focus on depth and clarity.
        6. If content naturally fits testimonials/quotes → prefer 'quotes' component with author names where present.
        7. If content is sequential/numbered → prefer 'sequence' based on complexity; use 'step' for longer text-only lines.
        8. If content lists short benefits/features → prefer 'boxes' or 'detail_list' depending on richness.
        9. If there is urgency/deadline/limited offer → include 'countdown' timer component.
        
        Output: Return ONLY the updated text content. If the input was HTML, return HTML. Do not wrap in markdown or quotes.
        `;
    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });
    return response.text || "";
  } catch (e) {
    return "Error generating copy.";
  }
};

export const generateCopyStream = async function* (
  prompt: string,
  context?: string,
) {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(
        `STARTING COPY STREAM (attempt ${retryCount + 1}/${maxRetries})`,
      );
      const fullPrompt = `
        Role: Expert Copywriter.
        Task: ${prompt}
        Current Content: "${context || ""}"
        
        Guidelines:
        1. EXPAND and ELABORATE on the existing ideas. Make the content longer and more detailed.
        2. Keep the expansion STRICTLY RELEVANT to the original topic. Do not drift into unrelated topics.
        3. Use persuasive language to enhance the points already present.
        4. DO NOT add completely new sections (like testimonials or pricing) unless the text is already about that.
        5. Focus on depth and clarity.
        
        Output: Return ONLY the updated text content. If the input was HTML, return HTML. Do not wrap in markdown or quotes.
        `;

      const response = await retryWithBackoff(
        () => {
          const client = getClient();
          return client.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
          });
        },
        1,
        1000,
      );

      for await (const chunk of response) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      console.log("ENDING COPY STREAM - SUCCESS");
      return;
    } catch (e: any) {
      console.error(
        `COPY STREAM ERROR (attempt ${retryCount + 1}/${maxRetries})`,
        e,
      );
      retryCount++;

      if (retryCount >= maxRetries) {
        const errorMsg = e?.message || "Unknown error";
        throw new Error(
          `Failed to generate copy after ${maxRetries} attempts. ${
            errorMsg.includes("overloaded")
              ? "The AI service is currently busy. Please try again shortly."
              : errorMsg
          }`,
        );
      }

      const delay = 2000 * Math.pow(2, retryCount - 1);
      console.warn(`Retrying copy generation in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const optimizeLayout = async (
  elementsJSON: string,
  userPrompt: string = "",
): Promise<any> => {
  try {
    const fullPrompt = `System: You are a CRO Expert and World-Class UI Designer.\n${SCHEMA_DEF}\n${DESIGN_GUIDELINES}\n${CONTENT_GUIDELINES}\n${ICON_GUIDELINES}\nUser: ${userPrompt}\nInput: ${elementsJSON}`;
    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.9,
        topP: 0.95,
      },
    });
    return JSON.parse(cleanJsonOutput(response.text || "[]"));
  } catch (e) {
    return null;
  }
};

export const optimizeLayoutStream = async function* (
  elementsJSON: string,
  userPrompt: string = "",
) {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(
        `STARTING LAYOUT STREAM (attempt ${retryCount + 1}/${maxRetries})`,
      );
      const fullPrompt = `System: You are a CRO Expert and World-Class UI Designer.\\n${SCHEMA_DEF}\\n${DESIGN_GUIDELINES}\\n${CONTENT_GUIDELINES}\\n${ICON_GUIDELINES}\\nUser: ${userPrompt}\\nInput: ${elementsJSON}\\nOutput strict JSON array.`;

      const response = await retryWithBackoff(
        () => {
          const client = getClient();
          return client.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.9,
              topP: 0.95,
            },
          });
        },
        1,
        1000,
      );

      for await (const chunk of response) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      console.log("ENDING LAYOUT STREAM - SUCCESS");
      return; // Successful, exit
    } catch (e: any) {
      console.error(
        `STREAM ERROR (attempt ${retryCount + 1}/${maxRetries})`,
        e,
      );
      retryCount++;

      if (retryCount >= maxRetries) {
        // Final attempt failed
        const errorMsg = e?.message || "Unknown error";
        throw new Error(
          `Failed to generate content after ${maxRetries} attempts. ${
            errorMsg.includes("overloaded")
              ? "The AI service is currently overloaded. Please try again in a few moments."
              : errorMsg
          }`,
        );
      }

      // Wait before retry with exponential backoff
      const delay = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s
      console.warn(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const editComponent = async (
  elementJSON: any,
  userPrompt: string,
): Promise<any> => {
  try {
    console.log("STARTING EDIT", userPrompt);
    const fullPrompt = `System: UI Designer.\n${SCHEMA_DEF}\n${DESIGN_GUIDELINES}\n${CONTENT_GUIDELINES}\n${ICON_GUIDELINES}\nUser: ${userPrompt}\nComponent: ${JSON.stringify(
      elementJSON,
    )}`;
    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.9,
        topP: 0.95,
      },
    });
    return JSON.parse(cleanJsonOutput(response.text || "{}"));
  } catch (e) {
    return null;
  }
};

export const generateComponent = async (
  prompt: string,
  styleHint?: string,
): Promise<any> => {
  try {
    const fullPrompt = `System: You are a UI Designer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User Request: ${prompt}
${styleHint ? `Style Preference: ${styleHint}` : ""}

Task: Create a single FunnelElement component (can be a section, wrapper, row, or preferably a CUSTOM COMPONENT from the registry) that fulfills the request.

If the user request mentions a specific color theme (e.g., "green landing page", "dark blue theme"), please identify the base hex color.

Output Format:
Return a JSON object with this structure:
{
  "component": { ... the FunnelElement JSON ... },
  "themeColor": "#hexcode" // Optional: Only if a color theme is clearly requested
}

- Return ONLY the JSON object.
- Ensure ID is generated for the component.
- PREFER CUSTOM COMPONENTS (list, detail_list, boxes, step, carousel, sequence, etc) over basic HTML tags if appropriate.
`;
    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: { responseMimeType: "application/json" },
    });
    const result = JSON.parse(cleanJsonOutput(response.text || "{}"));

    // Handle legacy/fallback case where AI might return just the component
    if (result.type || result.id) {
      return { component: result };
    }
    return result;
  } catch (e) {
    console.error("Error generating component:", e);
    return null;
  }
};

export const editComponentStream = async function* (
  elementJSON: any,
  userPrompt: string,
) {
  try {
    console.log("STARTING EDIT STREAM", userPrompt);
    const fullPrompt = `System: You are a UI Designer and Developer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User Request: ${userPrompt}
Current Component State: ${JSON.stringify(elementJSON)}

Task: Update the component based on the User Request.
- If the user asks to change text/content, update the 'content' field.
- If the user asks to change style/design, update the 'style' object.
- If the user asks to change structure, update 'children' or properties as needed.

CRITICAL OUTPUT RULES:
1. Return ONLY the valid JSON object for the updated component.
2. You MUST include the 'type' field (e.g., "type": "headline") in the output.
3. Keep the same 'id' if possible, or let the system handle it.
4. Do not wrap in markdown code blocks.
5. Ensure the JSON is complete and valid.

Output strict JSON object:`;

    const client = getClient();
    const response = await client.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: { responseMimeType: "application/json" },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
    console.log("ENDING EDIT STREAM");
  } catch (e) {
    console.error("STREAM ERROR", e);
    // Yield error message so callers can handle it
    yield JSON.stringify({ error: e instanceof Error ? e.message : "Stream error occurred" });
    throw e; // Re-throw so callers know there was an error
  }
};

export const generateComponentFromImage = async (
  imageBase64: string,
  userPrompt: string = "",
): Promise<any> => {
  try {
    const fullPrompt = `System: You are an expert UI Engineer and Builder.
Task: Analyze the provided image and recreate it as a functional component using our schema.

${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User Instruction: ${userPrompt}

Output: Return ONLY the valid JSON object for the component (start with {).
`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png",
      },
    };

    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }, imagePart],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    return JSON.parse(cleanJsonOutput(response.text || "{}"));
  } catch (e) {
    console.error("Image Gen Error:", e);
    return null;
  }
};

export const fixComponentWithImage = async (
  elementJSON: any,
  imageBase64: string,
  userPrompt: string,
): Promise<any> => {
  try {
    console.log("STARTING FIX WITH IMAGE", userPrompt);
    const fullPrompt = `System: You are an expert UI Engineer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}

User Request: ${userPrompt}
Current Component State: ${JSON.stringify(elementJSON)}
Task: precise visual refinement based on the attached reference image.

Output: Return ONLY the valid JSON object for the updated component.
`;
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png",
      },
    };

    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }, imagePart],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    return JSON.parse(cleanJsonOutput(response.text || "{}"));
  } catch (e) {
    console.error("Fix With Image Error", e);
    return null;
  }
};

export const fixComponentWithImageStream = async function* (
  elementJSON: any,
  imageBase64: string,
  userPrompt: string,
) {
  try {
    console.log("STARTING FIX WITH IMAGE STREAM", userPrompt);
    const fullPrompt = `System: You are an expert UI Engineer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}

User Request: ${userPrompt}
Current Component State: ${JSON.stringify(elementJSON)}
Task: precise visual refinement based on the attached reference image.

Output: Return ONLY the valid JSON object for the updated component.
`;
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png",
      },
    };

    const client = getClient();
    const response = await client.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }, imagePart],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
    console.log("ENDING FIX WITH IMAGE STREAM");
  } catch (e) {
    console.error("FIX WITH IMAGE STREAM ERROR", e);
    // Yield error message so callers can handle it
    yield JSON.stringify({ error: e instanceof Error ? e.message : "Image stream error occurred" });
    throw e; // Re-throw so callers know there was an error
  }
};

export const sanitizeAndMerge = (
  newElements: any[],
  originalElements: any[] = [],
  isRootCall: boolean = true,
): any[] => {
  // Reset naming session at root call to ensure unique names
  if (isRootCall) {
    resetNamingSession();
  }

  const validTypes = new Set([
    "section",
    "wrapper",
    "row",
    "col",
    "headline",
    "paragraph",
    "button",
    "image",
    "video",
    "input",
    "icon",
    "custom",
  ]);

  const validCustomTypes = new Set(Object.keys(CUSTOM_BLOCKS));

  const normalizeType = (el: any): string => {
    const rawType = typeof el?.type === "string" ? el.type : "";
    if (rawType && validTypes.has(rawType)) return rawType;
    if (el?.customType) return "custom";
    return "section";
  };

  return newElements.map((el, index) => {
    const existing = originalElements[index];
    const safeCustomType =
      el?.customType && validCustomTypes.has(el.customType)
        ? el.customType
        : undefined;
    const normalizedType = normalizeType({
      ...el,
      customType: safeCustomType,
    });
    const safeChildren = Array.isArray(el?.children)
      ? sanitizeAndMerge(
          el.children,
          existing && Array.isArray(existing.children) ? existing.children : [],
          false, // Not root call for children
        )
      : [];

    // Generate smart element name based on type
    const elementName = generateElementName(
      safeCustomType || normalizedType,
      el.name,
      { content: el.content }
    );

    const safeEl: any = {
      ...el,
      customType: safeCustomType,
      id:
        existing && existing.type === normalizedType
          ? existing.id
          : el.id || `gen-${Math.random().toString(36).substr(2, 9)}`,
      type: normalizedType,
      name: elementName,
      style: el.style || {},
      children: safeChildren,
    };

    if (safeEl.type === "custom" && !safeEl.customType) {
      safeEl.type = "wrapper";
      safeEl.name = generateElementName("wrapper", el.name);
    }

    return safeEl;
  });
};

/**
 * AI-POWERED THEME-AWARE LANDING PAGE GENERATOR
 *
 * This function takes user content and a theme color, then:
 * 1. Analyzes the content to understand the business/product/service
 * 2. Extracts and validates the theme color
 * 3. Generates a complete, professional landing page with proper components
 * 4. Returns both the theme color (for theme generation) and landing page elements
 *
 * @param content - The user's content (product/service description, brand message, etc.)
 * @param themeColor - Primary theme color (hex, rgb, or color name like "blue", "coral")
 * @returns Promise with { themeColor: string, elements: FunnelElement[], themeName: string }
 */
export const generateLandingPageWithTheme = async (
  content: string,
  themeColor: string,
): Promise<{
  themeColor: string;
  elements: FunnelElement[];
  themeName: string;
} | null> => {
  try {
    const layoutSeed = Math.random().toString(36).slice(2, 10);
    const fullPrompt = `You are an expert UI/UX designer and landing page strategist.

TASK:
The user has provided:
1. Content/Description: "${content}"
2. Primary Theme Color: "${themeColor}"
3. Layout variation seed: "${layoutSeed}" (use this to choose a different valid layout and component mix when generating pages for similar content)

YOUR JOB:
1. Extract and convert the theme color to a valid hex code (e.g., "blue" → "#3B82F6", "coral" → "#FF7F50")
2. Analyze the content to understand:
   - What product/service is being promoted
   - Target audience
   - Key benefits and features
   - Emotional tone (professional, fun, urgent, luxurious, etc.)
3. Create a COMPLETE landing page with appropriate sections and components
4. Use CSS variables for ALL colors to ensure theme switchability (e.g., var(--color-primary), var(--color-background))

${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

CRITICAL: THEME SWITCHING COMPATIBILITY
The generated elements MUST work with ANY theme. To achieve this:
1. DO NOT use hardcoded hex codes (like #1E95F5) in the 'elements' JSON, except for neutral colors (white/black) or specific brand assets.
2. ALWAYS use these CSS variables:
   - Primary: var(--color-primary)
   - Background: var(--color-background)
   - Text: var(--color-foreground)
   - Heading: var(--color-foreground-heading)
   - Border: var(--color-border)
   - Buttons: var(--color-primary-button-background), var(--color-primary-button-text)
3. The 'themeColor' field in the output will be used to generate the INITIAL theme, but the elements must remain dynamic.

CRITICAL OUTPUT FORMAT:
You MUST return a JSON object with this exact structure:
{
  "themeColor": "#hexcode",  // The extracted/converted primary color
  "themeName": "Name based on content",  // e.g., "Fitness Coaching Theme", "Tech Startup Theme"
  "elements": [ ... ]  // Array of FunnelElement components for the landing page
}

LANDING PAGE REQUIREMENTS:
- IMPORTANT: If the content contains "===== LAYOUT SPECIFICATION =====" section, follow those EXACT layouts
- If no layout specification provided, use standard AIDA framework: Hero → Features → Social Proof → CTA
- Required sections: Hero + CTA (minimum)
- Middle sections: Choose 2-4 based on content type (features, testimonials, process, benefits)
- Build atomically: section > wrapper > row > col structure
- Use CSS variables for all colors: var(--color-primary), var(--color-background), etc.
- Every element MUST have a unique id in kebab-case (hero-section, feature-card-1, cta-btn)
- Match the tone and style to the content provided
- Ensure mobile responsiveness
- Use professional, conversion-focused copy based on the user's content

Return ONLY the JSON object, no markdown formatting.`;

    const client = getClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: { responseMimeType: "application/json" },
    });

    // Use smart parsing to handle potential truncation or formatting issues
    const result = smartParsePartialJson(response.text || "{}", false);

    if (
      !result ||
      !result.themeColor ||
      !result.elements ||
      !Array.isArray(result.elements)
    ) {
      console.error("Invalid response format from AI:", result);
      return null;
    }

    // Validate and sanitize the elements
    const sanitizedElements = sanitizeAndMerge(result.elements);

    return {
      themeColor: result.themeColor,
      themeName: result.themeName || "Custom Theme",
      elements: sanitizedElements,
    };
  } catch (e) {
    console.error("Error generating theme-aware landing page:", e);
    return null;
  }
};

/**
 * STREAMING VERSION - AI-POWERED THEME-AWARE LANDING PAGE GENERATOR
 *
 * Same as generateLandingPageWithTheme but streams the response for real-time UI updates
 */
export const generateLandingPageWithThemeStream = async function* (
  content: string,
  themeColor: string,
) {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(
        `STARTING THEME-AWARE PAGE GENERATION (attempt ${
          retryCount + 1
        }/${maxRetries})`,
      );

      const layoutSeed = Math.random().toString(36).slice(2, 10);
      const fullPrompt = `You are an expert UI/UX designer and landing page strategist.

TASK:
The user has provided:
1. Content/Description: "${content}"
2. Primary Theme Color: "${themeColor}"
3. Layout variation seed: "${layoutSeed}" (use this to choose a different valid layout and component mix when generating pages for similar content)

YOUR JOB:
1. Extract and convert the theme color to a valid hex code (e.g., "blue" → "#3B82F6", "coral" → "#FF7F50")
2. Analyze the content to understand:
   - What product/service is being promoted
   - Target audience
   - Key benefits and features
   - Emotional tone (professional, fun, urgent, luxurious, etc.)
3. Create a COMPLETE landing page with appropriate sections and components
4. Use CSS variables for ALL colors to ensure theme switchability (e.g., var(--color-primary), var(--color-background))

${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

CRITICAL: THEME SWITCHING COMPATIBILITY
The generated elements MUST work with ANY theme. To achieve this:
1. DO NOT use hardcoded hex codes (like #1E95F5) in the 'elements' JSON, except for neutral colors (white/black) or specific brand assets.
2. ALWAYS use these CSS variables:
   - Primary: var(--color-primary)
   - Background: var(--color-background)
   - Text: var(--color-foreground)
   - Heading: var(--color-foreground-heading)
   - Border: var(--color-border)
   - Buttons: var(--color-primary-button-background), var(--color-primary-button-text)
3. The 'themeColor' field in the output will be used to generate the INITIAL theme, but the elements must remain dynamic.

CRITICAL OUTPUT FORMAT:
You MUST return a JSON object with this exact structure:
{
  "themeColor": "#hexcode",  // The extracted/converted primary color
  "themeName": "Name based on content",  // e.g., "Fitness Coaching Theme", "Tech Startup Theme"
  "elements": [ ... ]  // Array of FunnelElement components for the landing page
}

LANDING PAGE REQUIREMENTS:
- IMPORTANT: If the content contains "===== LAYOUT SPECIFICATION =====" section, follow those EXACT layouts
- If no layout specification provided, use standard AIDA framework: Hero → Features → Social Proof → CTA
- Required sections: Hero + CTA (minimum)
- Middle sections: Choose 2-4 based on content type (features, testimonials, process, benefits)
- Build atomically: section > wrapper > row > col structure
- Use CSS variables for all colors: var(--color-primary), var(--color-background), etc.
- Every element MUST have a unique id in kebab-case (hero-section, feature-card-1, cta-btn)
- Match the tone and style to the content provided
- Ensure mobile responsiveness
- Use professional, conversion-focused copy based on the user's content

Output strict JSON object.`;

      const response = await retryWithBackoff(
        () => {
          const client = getClient();
          return client.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.9,
              topP: 0.95,
            },
          });
        },
        1,
        1000,
      );

      for await (const chunk of response) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      console.log("ENDING THEME-AWARE PAGE GENERATION - SUCCESS");
      return;
    } catch (e: any) {
      console.error(
        `THEME-AWARE GENERATION ERROR (attempt ${
          retryCount + 1
        }/${maxRetries})`,
        e,
      );
      retryCount++;

      if (retryCount >= maxRetries) {
        const errorMsg = e?.message || "Unknown error";
        throw new Error(
          `Failed to generate landing page after ${maxRetries} attempts. ${
            errorMsg.includes("overloaded")
              ? "The AI service is currently busy. Please try again shortly."
              : errorMsg
          }`,
        );
      }

      const delay = 2000 * Math.pow(2, retryCount - 1);
      console.warn(`Retrying generation in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export function buildEcommerceLandingElements(
  brandColor: string = "#4F46E5",
): FunnelElement[] {
  const primary = brandColor;
  const textDark = "#111827";
  const textMuted = "#4b5563";
  const bgLight = "#f7f7f7";

  const hero: FunnelElement = {
    id: "ec-hero",
    type: "section",
    name: "Hero",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
    },
    mobileStyle: { padding: "2rem 1rem" },
    children: [
      {
        id: "ec-hero-row",
        type: "row",
        name: "Row",
        style: { display: "flex", gap: "2rem", alignItems: "center" },
        mobileStyle: { flexDirection: "column" },
        children: [
          {
            id: "ec-hero-left",
            type: "col",
            name: "Col",
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            },
            children: [
              {
                id: "ec-hero-h1",
                type: "headline",
                name: "Headline",
                content: "আপনার পণ্যকে আলাদা করে তুলুন — আজই কিনুন!",
                style: {
                  fontSize: "3rem",
                  fontWeight: 800,
                  color: textDark,
                  lineHeight: "1.1",
                },
                mobileStyle: { fontSize: "2rem", textAlign: "center" },
              },
              {
                id: "ec-hero-sub",
                type: "paragraph",
                name: "Subheadline",
                content:
                  "উচ্চমানের, নির্ভরযোগ্য এবং আকর্ষণীয় — আপনার প্রয়োজনের পারফেক্ট সমাধান।",
                style: {
                  fontSize: "1.125rem",
                  color: textMuted,
                  maxWidth: "650px",
                },
                mobileStyle: { textAlign: "center" },
              },
              {
                id: "ec-hero-cta",
                type: "button",
                name: "CTA",
                content: "এখনই অর্ডার করুন",
                style: {
                  backgroundColor: primary,
                  color: "#ffffff",
                  padding: "1rem 2rem",
                  borderRadius: "0.75rem",
                  fontWeight: 700,
                  border: "none",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                },
                mobileStyle: { width: "100%" },
              },
            ],
          },
          {
            id: "ec-hero-right",
            type: "col",
            name: "Col",
            style: { flex: 1, display: "flex", justifyContent: "center" },
            children: [
              {
                id: "ec-hero-img",
                type: "image",
                name: "Product Image",
                src: "https://picsum.photos/seed/product/800/600",
                style: {
                  width: "100%",
                  maxWidth: "600px",
                  borderRadius: "1rem",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  const uspBoxes: FunnelElement = {
    id: "ec-usp",
    type: "section",
    name: "USP Highlights",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
      backgroundColor: bgLight,
    },
    children: [
      {
        id: "ec-usp-grid",
        type: "custom",
        customType: "boxes",
        name: "Highlights",
        style: { width: "100%" },
        data: {
          layout: "grid-3",
          cardStyle: "outline",
          items: [
            {
              title: "প্রিমিয়াম মান",
              description: "টেকসই ও নান্দনিক ডিজাইন",
              icon: "Shield",
            },
            {
              title: "দ্রুত ডেলিভারি",
              description: "২৪–৪৮ ঘণ্টার ভিতরে",
              icon: "Truck",
            },
            {
              title: "সহজ রিটার্ন",
              description: "নির্ভার কেনাকাটার নিশ্চয়তা",
              icon: "Undo2",
            },
          ],
          accentColor: primary,
          gap: 24,
          columns: 3,
          mobileColumns: 1,
        },
      },
    ],
  };

  const featuresDetail: FunnelElement = {
    id: "ec-features",
    type: "section",
    name: "Features",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
    },
    children: [
      {
        id: "ec-features-title",
        type: "headline",
        name: "Headline",
        content: "কেন এটি সেরা পছন্দ",
        style: {
          fontSize: "2rem",
          fontWeight: 800,
          color: textDark,
          textAlign: "center",
        },
      },
      {
        id: "ec-feature-list",
        type: "custom",
        customType: "detail_list",
        name: "Feature Cards",
        style: { width: "100%" },
        data: {
          items: [
            {
              title: "আরামদায়ক ব্যবহার",
              description: "দৈনন্দিন ব্যবহারে সহায়ক",
              icon: "Smile",
              color: primary,
              iconSize: 24,
            },
            {
              title: "নান্দনিক ডিজাইন",
              description: "আকর্ষণীয় ও আধুনিক",
              icon: "Sparkles",
              color: primary,
              iconSize: 24,
            },
            {
              title: "দীর্ঘস্থায়ী",
              description: "অসাধারণ টেকসই মান",
              icon: "CircleCheck",
              color: primary,
              iconSize: 24,
            },
          ],
        },
      },
    ],
  };

  const sequenceSection: FunnelElement = {
    id: "ec-sequence",
    type: "section",
    name: "Product Benefits",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
    },
    children: [
      {
        id: "ec-sequence-custom",
        type: "custom",
        customType: "sequence",
        name: "Benefit Sequence",
        style: { width: "100%" },
        data: {
          layout: "vertical-boxes",
          items: [
            { text: "আরামদায়ক ব্যবহার", number: "1" },
            { text: "নান্দনিক ডিজাইন", number: "2" },
            { text: "দীর্ঘস্থায়ী", number: "3" },
          ],
          pyramidColor: "#edeae4",
          textColor: textDark,
          numberColor: primary,
          lineColor: "#d6d3d1",
          gap: 24,
          mobileGap: 16,
        },
      },
    ],
  };

  const usageSequence: FunnelElement = {
    id: "ec-usage",
    type: "section",
    name: "How To Use",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
      backgroundColor: bgLight,
    },
    children: [
      {
        id: "ec-usage-sequence",
        type: "custom",
        customType: "sequence",
        name: "Usage Steps",
        style: { width: "100%" },
        data: {
          layout: "horizontal-cards",
          items: [
            { title: "আনবক্স করুন", description: "সতর্কভাবে প্যাকেজ খুলুন" },
            {
              title: "সেটআপ করুন",
              description: "দ্রুত নির্দেশিকা অনুসরণ করুন",
            },
            {
              title: "ব্যবহার শুরু করুন",
              description: "প্রতিদিনের কাজে প্রয়োগ করুন",
            },
          ],
          lineColor: primary,
          dotColor: primary,
          titleColor: textDark,
          descColor: textMuted,
        },
      },
    ],
  };

  const stepSection: FunnelElement = {
    id: "ec-steps",
    type: "section",
    name: "Key Points",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
      backgroundColor: bgLight,
    },
    children: [
      {
        id: "ec-steps-custom",
        type: "custom",
        customType: "step",
        name: "Key Points",
        style: { width: "100%" },
        data: {
          layout: "pyramid-left",
          items: [
            { text: "পাকস্থলীর কর্মক্ষমতা কমে যায়" },
            { text: "রোগজীবাণুর প্রবেশের সক্ষমতা বেড়ে যায়" },
          ],
          bgColor: "#f8f6f2",
          stripColor: "#edeae4",
          accentColor: "#e8e2d8",
          textColor: textDark,
          gap: 8,
        },
      },
    ],
  };

  const gallery: FunnelElement = {
    id: "ec-gallery",
    type: "section",
    name: "Gallery",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
    },
    children: [
      {
        id: "ec-gallery-carousel",
        type: "custom",
        customType: "carousel",
        name: "Images",
        style: { width: "100%" },
        data: {
          images: [
            { src: "https://picsum.photos/seed/p1/800/600", alt: "Product 1" },
            { src: "https://picsum.photos/seed/p2/800/600", alt: "Product 2" },
            { src: "https://picsum.photos/seed/p3/800/600", alt: "Product 3" },
          ],
          image_fit: "cover",
          image_radius: 16,
          image_gap: 16,
          desktop_items: 3,
          mobile_items: 1,
        },
      },
    ],
  };

  const reviews: FunnelElement = {
    id: "ec-reviews",
    type: "section",
    name: "Reviews",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
      backgroundColor: bgLight,
    },
    children: [
      {
        id: "ec-quotes",
        type: "custom",
        customType: "quotes",
        name: "Testimonials",
        style: { width: "100%" },
        data: {
          layout: "grid",
          mobileLayout: "carousel",
          items: [
            { text: "সত্যিই দারুণ মান!", author: "রাহিম" },
            { text: "টাকার যথার্থ মূল্য", author: "করিম" },
            { text: "আবারও কিনবো", author: "সাবিনা" },
          ],
          bgColor: "#ffffff",
          textColor: textDark,
          gap: 24,
          columns: 3,
          mobileColumns: 1,
        },
      },
    ],
  };

  const finalCta: FunnelElement = {
    id: "ec-cta",
    type: "section",
    name: "Final CTA",
    style: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "4rem 1rem",
    },
    children: [
      {
        id: "ec-cta-row",
        type: "row",
        name: "Row",
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        },
        children: [
          {
            id: "ec-cta-title",
            type: "headline",
            name: "CTA Headline",
            content: "অফার শেষ হওয়ার আগেই কিনে ফেলুন!",
            style: {
              fontSize: "2rem",
              fontWeight: 800,
              color: textDark,
              textAlign: "center",
            },
          },
          {
            id: "ec-cta-timer",
            type: "custom",
            customType: "countdown",
            name: "Countdown",
            style: { width: "100%" },
            data: {
              duration: "24h",
              digitColor: textDark,
              labelColor: textMuted,
              digitBgColor: "#f3f4f6",
              gap: 20,
              digitSize: 36,
              labelSize: 12,
              mobileDigitSize: 28,
              mobileLabelSize: 12,
              mobileGap: 12,
            },
          },
          {
            id: "ec-cta-button",
            type: "button",
            name: "CTA Button",
            content: "এখনই অর্ডার করুন",
            style: {
              backgroundColor: primary,
              color: "#ffffff",
              padding: "1rem 2rem",
              borderRadius: "0.75rem",
              fontWeight: 700,
              border: "none",
            },
            mobileStyle: { width: "100%" },
          },
        ],
      },
    ],
  };

  return [
    hero,
    uspBoxes,
    sequenceSection,
    featuresDetail,
    usageSequence,
    stepSection,
    gallery,
    reviews,
    finalCta,
  ];
}
