import OpenAI from "openai";
import { CUSTOM_BLOCKS } from "../components/custom-registry";
import { SettingSchema, FunnelElement } from "../types";
import { getRuntimeApiKey } from "./runtimeApiKey";
import { generateElementName, resetNamingSession } from "../utils/elementNaming";

import { openRouterCompletion } from "../app/actions/openrouter";

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

let currentModel = DEFAULT_OPENROUTER_MODEL;

export const setOpenRouterModel = (model: string) => {
  currentModel = model || DEFAULT_OPENROUTER_MODEL;
};

export const getOpenRouterModel = () => currentModel;

const getOpenAIClient = () => {
  const apiKey = getRuntimeApiKey("openai");

  // Ensure baseURL is absolute to avoid "Invalid URL" error in OpenAI SDK
  let baseURL = "https://openrouter.ai/api/v1"; // Default fallback

  if (typeof window !== "undefined") {
    // Client-side: use current origin
    baseURL = `${window.location.origin}/api/openrouter`;
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    // Server-side: use configured app URL
    baseURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/openrouter`;
  }

  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_OPENROUTER_SITE_URL || "https://selorax.io",
      "X-Title": process.env.NEXT_PUBLIC_OPENROUTER_APP_NAME || "SeloraX",
    },
    dangerouslyAllowBrowser: true,
  });
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
        error?.status === 503 ||
        error?.status === 429 ||
        error?.message?.includes("overloaded") ||
        error?.message?.includes("Rate limit");

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

// Exported for MCP tools to expose design knowledge to Claude
export const SCHEMA_DEF = `
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

 When user give you prompt to build a landing page then you must follow the following guidelines and also we have some custom components that you can use to build the landing page. You must use the custom components

AVAILABLE CUSTOM COMPONENTS (Quick Reference):
- list: Simple List (bullets/checkmarks)
- detail_list: Detail List (feature cards with descriptions)
- carousel: Image Carousel
- countdown: Countdown Timer
- circle: Circle Layout (cyclical flows)
- boxes: Boxed cards grid/list (feature highlights, benefits)
- quotes: Testimonials/quotes with grid/carousel layouts
- sequence: Number/icon + text steps (vertical/grid)
- step: Text-only step rows (pyramid/flat stripes)

AVAILABLE CSS PROPERTIES:
- Layout: display (flex/grid), flexDirection, justifyContent, alignItems, gap, gridTemplateColumns.
- Sizing: width, height, min/max, flexGrow.
- Spacing: padding, margin.
- Typography: fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, color, textAlign.
- Appearance: backgroundColor, opacity, border, borderRadius, boxShadow.
- Transforms: transform.
- Positioning: position (relative/absolute/sticky), top/right/bottom/left, zIndex.
`;

export const DESIGN_GUIDELINES = `
═══════════════════════════════════════════════════════════════════════════════
DESIGN GUIDELINES v3 - INDUSTRY-STANDARD SALES FUNNEL LANDING PAGES
═══════════════════════════════════════════════════════════════════════════════

MISSION: Create UNIQUE, HIGH-CONVERTING, INDUSTRY-STANDARD sales funnel landing
pages that follow proven psychological frameworks and modern design trends.

═══════════════════════════════════════════════════════════════════════════════
PART 1: SALES FUNNEL PSYCHOLOGY FRAMEWORKS
═══════════════════════════════════════════════════════════════════════════════

EVERY landing page MUST follow ONE of these proven conversion frameworks:

┌─────────────────────────────────────────────────────────────────────────────┐
│ FRAMEWORK 1: AIDA (Attention → Interest → Desire → Action)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ BEST FOR: SaaS, Tech Products, B2B Services                                 │
│                                                                             │
│ STRUCTURE:                                                                  │
│ • Hero Section → Capture ATTENTION with bold headline + striking visual     │
│ • Features/Benefits → Build INTEREST with value propositions                │
│ • Social Proof → Create DESIRE through testimonials, case studies, results  │
│ • CTA Section → Drive ACTION with clear, urgent call-to-action              │
│                                                                             │
│ SECTION ORDER: Hero → Logo Cloud → Features → How It Works → Testimonials   │
│                → Pricing → FAQ → Final CTA                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FRAMEWORK 2: PAS (Problem → Agitate → Solution)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ BEST FOR: Health/Wellness, E-commerce, Direct Response Funnels              │
│                                                                             │
│ STRUCTURE:                                                                  │
│ • Problem Section → Identify the PROBLEM the visitor faces                  │
│ • Agitate Section → AGITATE by highlighting pain points & consequences      │
│ • Solution Section → Present your SOLUTION as the answer                    │
│ • CTA Section → Risk-reversal (guarantee, free trial, money-back)           │
│                                                                             │
│ SECTION ORDER: Problem Hero → Pain Points → Solution Reveal →               │
│                Benefits → Testimonials → Guarantee → Urgency CTA            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FRAMEWORK 3: 4Ps (Promise → Picture → Proof → Push)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ BEST FOR: Coaching, Consulting, Courses, High-Ticket Offers                 │
│                                                                             │
│ STRUCTURE:                                                                  │
│ • Promise Section → Make a BOLD PROMISE in the hero                         │
│ • Picture Section → Paint a vivid PICTURE of life after transformation     │
│ • Proof Section → Back up with testimonials, data, case studies             │
│ • Push Section → Create urgency and drive to ACTION                         │
│                                                                             │
│ SECTION ORDER: Bold Promise Hero → Transformation Vision →                  │
│                Results/Case Studies → Process → About/Authority →           │
│                Testimonials → Pricing → Urgency CTA                         │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 2: LAYOUT VARIATION SYSTEM (FOR UNIQUENESS)
═══════════════════════════════════════════════════════════════════════════════

CRITICAL RULE: VARY the layout style for EACH generation to ensure uniqueness.
DO NOT always use the same hero or features layout!

┌─────────────────────────────────────────────────────────────────────────────┐
│ HERO SECTION VARIATIONS (Pick ONE per page - ROTATE between generations)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. "SPLIT HERO" - 2 columns: content left (60%), image right (40%)         │
│    • Best for: SaaS, Software, B2B                                          │
│    • Structure: row > col(content) + col(image)                            │
│                                                                             │
│ 2. "CENTERED HERO" - Full-width centered with gradient/image background    │
│    • Best for: Brand pages, launches, events                                │
│    • Structure: wrapper(centered) > headline + text + CTA                   │
│                                                                             │
│ 3. "VIDEO HERO" - Video embed/background with overlay text                 │
│    • Best for: Courses, demos, product showcases                            │
│    • Structure: wrapper(video) + overlay(content)                          │
│                                                                             │
│ 4. "PRODUCT SHOWCASE" - Large product image with floating badges           │
│    • Best for: E-commerce, physical products                                │
│    • Structure: centered image + floating trust badges around it           │
│                                                                             │
│ 5. "SOCIAL PROOF HERO" - Hero with integrated testimonial/rating           │
│    • Best for: High-ticket, trust-dependent products                        │
│    • Structure: headline + rating/testimonial snippet + CTA                │
│                                                                             │
│ 6. "MINIMAL HERO" - Text-only with max whitespace, subtle animation        │
│    • Best for: Luxury, minimalist brands, premium services                  │
│    • Structure: large headline + single CTA, no images                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FEATURES SECTION VARIATIONS                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. "ICON GRID" - 3-4 column grid with icons + titles + descriptions        │
│    • Build atomically: row > col > icon + headline + paragraph             │
│                                                                             │
│ 2. "ALTERNATING ROWS" - Left/right alternating image + text blocks         │
│    • Build atomically: row(reverse) alternating pattern                    │
│                                                                             │
│ 3. "BENTO GRID" - Asymmetric grid with varied card sizes                   │
│    • Modern, visually interesting                                           │
│                                                                             │
│ 4. "FEATURE CARDS" - Elevated cards with shadows and hover states          │
│    • Build atomically: row > col > wrapper(shadow) > content               │
│                                                                             │
│ 5. "COMPARISON TABLE" - Before/After or Feature comparison                 │
│    • Great for showing transformation or competitor comparison             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SOCIAL PROOF VARIATIONS                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. "TESTIMONIAL CAROUSEL" - Use 'carousel' custom component                │
│ 2. "WALL OF LOVE" - Grid of short testimonials/tweets                      │
│ 3. "CASE STUDY SPOTLIGHT" - Deep-dive single testimonial with metrics      │
│ 4. "LOGO CLOUD" - Client/partner logos in a row/grid                       │
│ 5. "STATS BAR" - Key numbers: "10K+ users", "99% satisfaction", etc.       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CTA SECTION VARIATIONS                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. "URGENCY CTA" - With countdown timer (use 'countdown' component)        │
│ 2. "COMPARISON CTA" - Price vs value breakdown                             │
│ 3. "GUARANTEE CTA" - Risk-free promise prominently displayed               │
│ 4. "MINIMAL CTA" - Clean, single-button focused                            │
│ 5. "MULTI-OPTION CTA" - Primary + secondary action buttons                 │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 3: INDUSTRY-SPECIFIC TEMPLATES
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ SaaS / SOFTWARE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: AIDA                                                             │
│ SECTIONS: Hero(Split) → Logo Cloud → Features(Bento) → How It Works →      │
│           Pricing → Testimonials → FAQ → CTA                                │
│ COLORS: Professional blues (#3B82F6), purples (#8B5CF6), clean whites      │
│ ICONS: Cpu, Cloud, Layers, Zap, BarChart3, Shield, Rocket                  │
│ CTA EXAMPLES: "Start Free Trial", "Book a Demo", "Get Started Free"        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ E-COMMERCE / PHYSICAL PRODUCTS                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: PAS                                                              │
│ SECTIONS: Hero(Product Showcase) → Trust Badges → Benefits(Icon Grid) →    │
│           Gallery → Reviews → Urgency CTA(with countdown)                   │
│ COLORS: Brand-specific, urgency reds/oranges (#EF4444) for CTAs            │
│ ICONS: Package, Truck, ShieldCheck, Star, Gift, Timer, Undo2               │
│ CTA EXAMPLES: "Add to Cart", "Buy Now - 50% Off", "Claim Your Discount"    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ COACHING / CONSULTING                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: 4Ps                                                              │
│ SECTIONS: Hero(Video/Personal) → Authority → Results(Case Studies) →       │
│           Process → Testimonials → Booking CTA                              │
│ COLORS: Warm, trustworthy (golds #F59E0B, deep blues #1E40AF, greens)      │
│ ICONS: Award, Target, Users, Calendar, CheckCircle, Sparkles, Brain        │
│ CTA EXAMPLES: "Book Your Free Call", "Apply Now", "Get Your Strategy"      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ HEALTH / WELLNESS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: PAS                                                              │
│ SECTIONS: Hero(Transformation) → Problem → Solution → Ingredients →        │
│           Before/After → Doctor/Expert → CTA(Guarantee)                    │
│ COLORS: Greens (#22C55E, #16A34A), whites, soft earth tones               │
│ ICONS: Leaf, Heart, ShieldCheck, Sparkles, Sun, Award, CheckCircle        │
│ CTA EXAMPLES: "Start Your Transformation", "Try Risk-Free", "Order Now"   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FINANCE / INSURANCE                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: AIDA                                                             │
│ SECTIONS: Hero(Security-focused) → Trust Signals → Calculator →            │
│           Process → Testimonials → Consultation CTA                         │
│ COLORS: Navy blues (#1E3A8A), greens (#059669), professional grays        │
│ ICONS: Shield, Lock, DollarSign, TrendingUp, FileText, CheckCircle        │
│ CTA EXAMPLES: "Get Your Quote", "Schedule Consultation", "Calculate Now"  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDUCATION / COURSES                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ FRAMEWORK: 4Ps                                                              │
│ SECTIONS: Hero(Outcome-focused) → Curriculum → Instructor → Results →      │
│           Pricing/Enrollment → FAQ → CTA                                    │
│ COLORS: Academic blues, energetic oranges (#F97316), clean whites         │
│ ICONS: BookOpen, GraduationCap, Users, Target, Award, Clock, Play         │
│ CTA EXAMPLES: "Enroll Now", "Start Learning", "Join 10,000+ Students"     │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 4: MODERN DESIGN TRENDS 2024-2025
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ TYPOGRAPHY                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Oversized hero headlines: 48-72px on desktop, 32-40px mobile             │
│ • Variable font weights for visual hierarchy (400-700)                     │
│ • Generous line-height: 1.5-1.7 for body text, 1.1-1.2 for headlines      │
│ • Letter-spacing: -0.02em for headlines (tighter), normal for body         │
│ • Font suggestions: Inter, DM Sans, Poppins, Plus Jakarta Sans             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SPACING & LAYOUT                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Section padding: 80-120px vertical (never less than 60px)                │
│ • Content max-width: 1200px (contained), up to 1400px for hero             │
│ • Gap between elements: 16-24px for cards, 40-60px for sections            │
│ • Asymmetric grids for visual interest (e.g., 60/40 splits)                │
│ • Strategic whitespace - let content breathe                                │
│ • Overlapping elements for depth (images extending past sections)          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ VISUAL ELEMENTS                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Subtle gradients: linear-gradient(135deg, color1, color2)                │
│ • Soft shadows: box-shadow: 0 20px 40px rgba(0,0,0,0.08)                   │
│ • Rounded corners: 12-24px for cards, 8-12px for buttons                   │
│ • Border radius on images: 16-24px with soft shadows                       │
│ • Glassmorphism: backdrop-filter: blur(10px) with semi-transparent bg      │
│ • Gradient text for highlights: background-clip: text                      │
│ • Micro-interactions via CSS (hover:scale, transitions)                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ COLOR STRATEGIES                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • 60-30-10 rule: 60% dominant (bg), 30% secondary, 10% accent (CTA)       │
│ • Use CSS variables for ALL colors: var(--color-primary), etc.             │
│ • Gradient CTAs stand out more than solid buttons                          │
│ • Use opacity for layering: rgba(primary, 0.1) for subtle backgrounds     │
│ • Dark sections for visual rhythm (every 2-3 sections)                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CONVERSION OPTIMIZATION                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Single primary CTA per section (don't confuse visitors)                  │
│ • Above-the-fold: Value proposition + CTA visible without scrolling        │
│ • Social proof NEAR CTAs (build confidence at decision point)              │
│ • Sticky navigation with CTA button                                         │
│ • Mobile-first: All critical content accessible on small screens           │
│ • Button contrast: CTA buttons must stand out from background              │
│ • Urgency elements: Countdown, limited spots, deadline messaging           │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 5: UNIQUENESS RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ RULE 1: NO TWO PAGES SHOULD LOOK IDENTICAL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ • VARY hero layout style between generations                                │
│ • Use DIFFERENT column configurations (2-col, 3-col, asymmetric)           │
│ • ALTERNATE section backgrounds creatively (white, gray, gradient, dark)   │
│ • MIX custom components with atomic builds                                  │
│ • ROTATE between psychology frameworks based on industry                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ RULE 2: CONTENT VARIATION                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Headlines: BENEFIT-focused, not feature-focused                          │
│   BAD: "Our Software Features"                                             │
│   GOOD: "Save 10 Hours Every Week on Repetitive Tasks"                     │
│                                                                             │
│ • Use industry-specific language and metaphors                             │
│ • VARY CTA button text (not always "Get Started")                          │
│   EXAMPLES: "Start Your Free Trial", "Get Instant Access",                 │
│             "Claim Your Spot", "Yes, Transform My Business",               │
│             "Book My Strategy Call", "See It In Action"                    │
│                                                                             │
│ • Include contextual urgency when appropriate                              │
│   "Only 5 spots left", "Offer ends midnight", "Join 10K+ users"           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ RULE 3: VISUAL VARIATION                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Different section padding rhythms (80px, 100px, 60px - not uniform)     │
│ • Alternate between full-width and contained sections                      │
│ • Use decorative elements: gradients, shapes, patterns, overlays          │
│ • Vary card styles: bordered, shadowed, flat, gradient background         │
│ • Different border radius: sharp for corporate, rounded for friendly      │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 6: ATOMIC DESIGN STRUCTURE (MANDATORY)
═══════════════════════════════════════════════════════════════════════════════

ALWAYS build using this hierarchy:
  section → wrapper → row → col → content (headline, paragraph, button, icon)

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECTION RULES                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ style: {                                                                   │
│   width: "100%",                                                           │
│   padding: "80px 20px", // minimum 60px vertical                           │
│   backgroundColor: "var(--color-background)" // or alternate colors        │
│ }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ WRAPPER RULES                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ style: {                                                                   │
│   maxWidth: "1200px",                                                      │
│   margin: "0 auto",                                                        │
│   padding: "0 20px"                                                        │
│ }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ROW RULES (for multi-column layouts)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ style: {                                                                   │
│   display: "flex",                                                         │
│   flexWrap: "wrap",                                                        │
│   gap: "24px", // or 32px, 40px                                            │
│   alignItems: "center" // or "flex-start" for top alignment               │
│ }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ELEMENT NAMING (REQUIRED)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ EVERY element MUST have a descriptive "name" field:                        │
│ • Sections: "Hero Section", "Features Section", "CTA Section"              │
│ • Headlines: "Main Headline", "Section Title", "Feature Title"             │
│ • Paragraphs: "Hero Description", "Feature Description"                    │
│ • Buttons: "Primary CTA", "Secondary CTA", "Hero Button"                   │
│ • Icons: "Feature Icon", "Trust Badge Icon"                                │
│ • NEVER use generic names like "Element" or "AI Generated"                 │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 7: CSS VARIABLES (ALWAYS USE THESE)
═══════════════════════════════════════════════════════════════════════════════

NEVER hardcode colors. ALWAYS use CSS variables for theme compatibility:

• var(--color-primary) - Primary brand/CTA color
• var(--color-primary-button-background) - Button background
• var(--color-primary-button-text) - Button text
• var(--color-background) - Section backgrounds
• var(--color-foreground) - Body text
• var(--color-foreground-heading) - Headline text
• var(--color-foreground-muted) - Subtle text
• var(--color-border) - Borders and dividers
• var(--color-input-background) - Input/card backgrounds

═══════════════════════════════════════════════════════════════════════════════
SUMMARY: BEFORE GENERATING ANY PAGE, ASK YOURSELF:
═══════════════════════════════════════════════════════════════════════════════

1. What INDUSTRY is this for? → Select appropriate template
2. What FRAMEWORK should I use? → AIDA, PAS, or 4Ps
3. What HERO STYLE fits best? → Split, Centered, Video, Product, etc.
4. What FEATURES LAYOUT to use? → Icon Grid, Alternating, Bento, Cards
5. What makes this page UNIQUE? → Vary layouts, colors, content, CTAs

REMEMBER: Every page should be HIGH-CONVERTING, VISUALLY UNIQUE, and
PROFESSIONALLY DESIGNED following proven sales funnel psychology.

═══════════════════════════════════════════════════════════════════════════════
ATOMIC DESIGN EXAMPLES (REFERENCE)
═══════════════════════════════════════════════════════════════════════════════

3.1. ATOMIC DESIGN EXAMPLES (PREFERRED):

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

   Example C: Product Breakdown (Funnel Style - Atomic)
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

3.2. QUICK DECISION MATRIX:

   Landing Page Type → Components to Include:
   
   Consulting/Agency:
   ✓ ATOMIC: Hero, Services Grid, Team, Testimonials
   ✓ CUSTOM (Optional): circle (methodology)
   
   SaaS/Software:
   ✓ ATOMIC: Hero, Feature Grid, Pricing Table
   ✓ CUSTOM (Optional): sequence (how it works), countdown (offer)
   
   E-commerce/Product Funnel:
   ✓ ATOMIC: Product Showcase (Funnel Style), Benefits Grid, Reviews
   ✓ CUSTOM (Optional): carousel (gallery), countdown (sale)
   
   ANY Landing Page:
   - PRIMARY: Use Atomic Elements (Sections, Wrappers, Rows, Cols)
   - SECONDARY: Use Custom Components ONLY for complex features (Timers, Sliders, Diagrams)

4. ELEMENT NAMING (REQUIRED - CRITICAL):
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

// Compact version of DESIGN_GUIDELINES for editComponent - focuses on actionable design values
// Skips psychology frameworks, layout variations, industry templates (those are for page generation)
export const DESIGN_GUIDELINES_COMPACT = `
DESIGN GUIDELINES (Apply to all edits):

TYPOGRAPHY:
• Hero headlines: 48-72px desktop, fontWeight 700-800, lineHeight 1.1-1.2, letterSpacing -0.02em
• Section titles: 32-40px, fontWeight 600-700, lineHeight 1.2-1.3
• Body text: 16-18px, fontWeight 400, lineHeight 1.6-1.7
• Subtle/muted text: 14-15px, color var(--color-foreground-muted)

SPACING & LAYOUT:
• Section padding: 80-120px vertical (NEVER less than 60px)
• Content max-width: 1200px (1400px for hero), margin: 0 auto
• Card gaps: 24-32px. Element gaps: 16-24px
• Asymmetric grids for visual interest (60/40 splits)
• Strategic whitespace - let content breathe

VISUAL ELEMENTS:
• Card shadows: box-shadow: 0 4px 20px rgba(0,0,0,0.06) or 0 20px 40px rgba(0,0,0,0.08)
• Card radius: 12-20px. Button radius: 8-12px. Image radius: 16-24px
• Subtle gradients: linear-gradient(135deg, color1, color2)
• Glassmorphism: backdrop-filter blur(10px) with semi-transparent bg

COLOR RULES:
• 60-30-10 rule: 60% dominant (bg), 30% secondary, 10% accent (CTA)
• ALWAYS use CSS variables: var(--color-primary), var(--color-background), etc.
• Alternate section backgrounds for rhythm (white, subtle gray, gradient, dark)
• Button contrast: CTA buttons MUST stand out from background

ATOMIC DESIGN STRUCTURE (MANDATORY):
section → wrapper → row → col → content (headline, paragraph, button, icon)
• Section: width 100%, padding 80px 20px, bg var(--color-background)
• Wrapper: maxWidth 1200px, margin 0 auto, padding 0 20px
• Row: display flex, flexWrap wrap, gap 24-40px
• Elements: descriptive names ("Hero Section", "CTA Button", never "Element")

CSS VARIABLES (ALWAYS USE):
• var(--color-primary) - Brand/CTA color
• var(--color-primary-button-background) - Button bg
• var(--color-primary-button-text) - Button text
• var(--color-background) - Section bg
• var(--color-foreground) - Body text
• var(--color-foreground-heading) - Headline text
• var(--color-foreground-muted) - Subtle text
• var(--color-border) - Borders
• var(--color-input-background) - Input/card backgrounds
`;

export const CONTENT_GUIDELINES = `
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

export const ICON_GUIDELINES = `
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
   - "Fast Delivery" → content: "Truck"
   - "100% Authentic" → content: "BadgeCheck"
   - "Easy Returns" → content: "Undo2"
   - "24/7 Support" → content: "Headphones"
   - "Secure Payment" → content: "Lock"
   - "Free Shipping" → content: "Package"
   - "Money Back Guarantee" → content: "Wallet"
   - "Premium Quality" → content: "Award"
   - "Lightning Fast" → content: "Zap"
   - "AI Powered" → content: "Sparkles"

   WHEN TO USE "Star": ONLY for ratings, reviews, or explicitly star-related content (e.g., "5-Star Rating")

FINAL RULE: Text content like "Lightning Fast" should NOT have emojis prepended.
Use a wrapper with icon element + text element instead.
`;

const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```"))
    cleaned = cleaned.substring(0, cleaned.length - 3);
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
    const fullPrompt = `Role: Expert Copywriter.
Task: ${prompt}
Current Content: "${context || ""}"

Guidelines:
1. EXPAND and ELABORATE on the existing ideas. Make the content longer and more detailed.
2. Keep the expansion STRICTLY RELEVANT to the original topic. Do not drift into unrelated topics.
3. Use persuasive language to enhance the points already present.
4. Do NOT add completely new sections (like testimonials or pricing) unless the text is already about that.
5. Focus on depth and clarity.

Output: Return ONLY the updated text content. If the input was HTML, return HTML. Do not wrap in markdown or quotes.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(apiKey, currentModel, [
      { role: "user", content: fullPrompt },
    ]);
    return content;
  } catch (e) {
    console.error("Copy generation error:", e);
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
      const fullPrompt = `Role: Expert Copywriter.
Task: ${prompt}
Current Content: "${context || ""}"

Guidelines:
1. EXPAND and ELABORATE on the existing ideas. Make the content longer and more detailed.
2. Keep the expansion STRICTLY RELEVANT to the original topic. Do not drift into unrelated topics.
3. Use persuasive language to enhance the points already present.
4. DO NOT add completely new sections (like testimonials or pricing) unless the text is already about that.
5. Focus on depth and clarity.

Output: Return ONLY the updated text content. If the input was HTML, return HTML. Do not wrap in markdown or quotes.`;

      const stream = await retryWithBackoff(
        () =>
          getOpenAIClient().chat.completions.create({
            model: currentModel,
            messages: [{ role: "user", content: fullPrompt }],
            temperature: 0.7,
            stream: true,
          }),
        1,
        1000,
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
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
            errorMsg.includes("rate limit") || errorMsg.includes("429")
              ? "Rate limit exceeded. Please try again in a moment."
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
    const fullPrompt = `System: You are a CRO Expert and World-Class UI Designer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User: ${userPrompt}
Input: ${elementsJSON}

Output: Return ONLY a valid JSON array of FunnelElement objects. No markdown, no explanation.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(
      apiKey,
      currentModel,
      [{ role: "user", content: fullPrompt }],
      true,
    );
    return JSON.parse(content || "[]");
  } catch (e) {
    console.error("Layout optimization error:", e);
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
      const fullPrompt = `System: You are a CRO Expert and World-Class UI Designer.
${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User: ${userPrompt}
Input: ${elementsJSON}

Output: Return ONLY a valid JSON array of FunnelElement objects.`;

      const stream = await retryWithBackoff(
        () =>
          getOpenAIClient().chat.completions.create({
            model: currentModel,
            messages: [{ role: "user", content: fullPrompt }],
            temperature: 0.7,
            stream: true,
          }),
        1,
        1000,
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
      console.log("ENDING LAYOUT STREAM - SUCCESS");
      return;
    } catch (e: any) {
      console.error(
        `STREAM ERROR (attempt ${retryCount + 1}/${maxRetries})`,
        e,
      );
      retryCount++;

      if (retryCount >= maxRetries) {
        const errorMsg = e?.message || "Unknown error";
        throw new Error(
          `Failed to generate content after ${maxRetries} attempts. ${
            errorMsg.includes("rate limit")
              ? "The AI service is currently overloaded. Please try again in a few moments."
              : errorMsg
          }`,
        );
      }

      const delay = 2000 * Math.pow(2, retryCount - 1);
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
    const fullPrompt = `System: You are an expert UI Designer editing an EXISTING component with modern design sensibility.

CRITICAL RULES FOR IN-PLACE EDITING:
1. PRESERVE the existing structure - only modify what the user requested
2. KEEP all existing children unless specifically asked to remove/replace them
3. KEEP all existing IDs - NEVER generate new IDs for existing elements
4. Only ADD new children if user explicitly requests new content
5. For text/style changes: update the specific property, leave structure intact
6. Do NOT reorganize or restructure unless explicitly asked

${SCHEMA_DEF}
${DESIGN_GUIDELINES_COMPACT}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User Request: ${userPrompt}
Current Component (preserve structure): ${JSON.stringify(elementJSON, null, 2)}

Task: Fulfill the user's request while preserving existing structure, IDs, and content not mentioned.
You MAY improve design quality (spacing, typography, shadows, visual hierarchy) alongside the requested change to ensure modern, professional styling.
Output: Return ONLY the updated JSON. Keep existing IDs, structure, and unrelated content.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(
      apiKey,
      currentModel,
      [{ role: "user", content: fullPrompt }],
      true,
    );
    return JSON.parse(content || "{}");
  } catch (e) {
    console.error("Edit component error:", e);
    return null;
  }
};

export const editComponentStream = async function* (
  elementJSON: any,
  userPrompt: string,
) {
  try {
    console.log("STARTING EDIT STREAM", userPrompt);
    const fullPrompt = `System: You are an expert UI Designer editing an EXISTING component IN-PLACE with modern design sensibility.

CRITICAL RULES FOR IN-PLACE EDITING:
1. PRESERVE the existing structure - only modify what the user requested
2. KEEP all existing children unless specifically asked to remove/replace them
3. KEEP all existing IDs - NEVER generate new IDs for existing elements
4. Only ADD new children if user explicitly requests new content
5. For text/style changes: update the specific property, leave structure intact
6. Do NOT reorganize or restructure unless explicitly asked

${SCHEMA_DEF}
${DESIGN_GUIDELINES_COMPACT}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

User Request: ${userPrompt}
Current Component (preserve structure): ${JSON.stringify(elementJSON, null, 2)}

Task: Fulfill the user's request while preserving existing structure, IDs, and content not mentioned.
You MAY improve design quality (spacing, typography, shadows, visual hierarchy) alongside the requested change to ensure modern, professional styling.
Output: Return ONLY the updated JSON. Keep existing IDs, structure, and unrelated content.`;

    const client = getOpenAIClient();
    const stream = await client.chat.completions.create({
      model: currentModel,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
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
    - PREFER CUSTOM COMPONENTS (list, detail_list, boxes, step, carousel, sequence, etc) over basic HTML tags if appropriate.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(
      apiKey,
      currentModel,
      [{ role: "user", content: fullPrompt }],
      true,
    );
    const result = JSON.parse(content || "{}");

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

Output: Return ONLY the valid JSON object for the component.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(
      apiKey,
      "openai/gpt-4o",
      [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      true,
    );
    return JSON.parse(content || "{}");
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
Task: Precise visual refinement based on the attached reference image.

Output: Return ONLY the valid JSON object for the updated component.`;

    const apiKey = getRuntimeApiKey("openai");
    const content = await openRouterCompletion(
      apiKey,
      "openai/gpt-4o",
      [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      true,
    );
    return JSON.parse(content || "{}");
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
Task: Precise visual refinement based on the attached reference image.

Output: Return ONLY the valid JSON object for the updated component.`;

    const client = getOpenAIClient();
    const stream = await client.chat.completions.create({
      model: "gpt-4o", // Vision model
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
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

export const generateLandingPageWithTheme = async (
  content: string,
  themeColor: string,
): Promise<{
  themeColor: string;
  elements: FunnelElement[];
  themeName: string;
} | null> => {
  try {
    const fullPrompt = `You are an expert UI/UX designer and landing page strategist.

TASK:
The user has provided:
1. Content/Description: "${content}"
2. Primary Theme Color: "${themeColor}"

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

IMPORTANT:
- DO NOT wrap the output in markdown code blocks (like \`\`\`json ... \`\`\`).
- JUST return the raw JSON string.
- Ensure the JSON is valid and parsable.

CRITICAL DESIGN RULES - FAILURE MEANS REGENERATION:

1. NEVER CREATE EMPTY SECTIONS
   - Every section MUST have visible content
   - Minimum structure: section > wrapper > row > col with content inside
   - If a section would be empty, DO NOT CREATE IT

2. HERO SECTION REQUIREMENTS
   - MUST contain: headline + paragraph + button (minimum)
   - Split hero: 60% content left, 40% image right
   - Centered hero: max-width 800px, centered text, single CTA
   - NEVER create a hero without these elements

3. ATOMIC DESIGN IS MANDATORY
   - Structure: section > wrapper > row > col > content elements
   - Never skip levels (no section > headline directly)
   - Use row/col for ALL layouts, not custom components for simple grids

4. UNIQUE IDS ARE MANDATORY
   - Every single element needs a unique 'id' field in kebab-case
   - Format: hero-section, feature-card-1, cta-btn
   - Missing IDs = broken editor = FAILURE

5. CSS VARIABLES ONLY
   - var(--color-primary) for CTAs and accents
   - var(--color-background) for section backgrounds
   - var(--color-foreground) for text
   - NEVER hardcode hex colors like "#3B82F6" in styles

6. NO EMOJIS - USE ICONS
   - Never use emoji characters
   - Use Lucide icon names in icon elements (Zap, Shield, Truck, etc.)

LANDING PAGE STRUCTURE:
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

    const apiKey = getRuntimeApiKey("openai");
    const contentResponse = await openRouterCompletion(
      apiKey,
      currentModel,
      [{ role: "user", content: fullPrompt }],
      true,
    );
    const result = JSON.parse(contentResponse || "{}");

    if (
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

export const generateLandingPageWithThemeStream = async function* (
  content: string,
  themeColor: string,
) {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const fullPrompt = `You are an expert UI/UX designer and landing page strategist.

TASK: Generate a complete landing page with theme color.
Content: ${content}
Theme Color: ${themeColor}

${SCHEMA_DEF}
${DESIGN_GUIDELINES}
${CONTENT_GUIDELINES}
${ICON_GUIDELINES}

CRITICAL DESIGN RULES - FAILURE MEANS REGENERATION:

1. NEVER CREATE EMPTY SECTIONS - Every section MUST have visible content
2. HERO MUST contain: headline + paragraph + button (minimum)
3. ATOMIC DESIGN: section > wrapper > row > col > content
4. UNIQUE IDS: Every element needs unique 'id' in kebab-case
5. CSS VARIABLES ONLY: var(--color-primary), var(--color-background), etc.
6. NO EMOJIS - use Lucide icon names (Zap, Shield, Truck)

If content contains "===== LAYOUT SPECIFICATION =====", follow those EXACT layouts.

Output ONLY a JSON object:
{
  "themeColor": "#hex",
  "themeName": "Name based on content",
  "elements": [ ... ]
}

Return raw JSON only, no markdown.`;

      const client = getOpenAIClient();
      const stream = await client.chat.completions.create({
        model: currentModel,
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (e: any) {
      retryCount++;
      if (retryCount >= maxRetries) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
    }
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

  return newElements.map((el, index) => {
    const existing = originalElements[index];
    const elementType = el.type || "section";

    // Generate smart element name based on type
    const elementName = generateElementName(
      el.customType || elementType,
      el.name,
      { content: el.content }
    );

    const safeEl: any = {
      ...el,
      id:
        existing && existing.type === el.type
          ? existing.id
          : el.id || `gen-${Math.random().toString(36).substr(2, 9)}`,
      type: elementType,
      name: elementName,
      style: el.style || {},
      children: Array.isArray(el.children)
        ? sanitizeAndMerge(
            el.children,
            existing && Array.isArray(existing.children)
              ? existing.children
              : [],
            false, // Not root call for children
          )
        : [],
    };
    return safeEl;
  });
};

export function buildEcommerceLandingElements(
  brandColor: string = "#4F46E5",
): FunnelElement[] {
  // Same implementation as before...
  return [];
}
