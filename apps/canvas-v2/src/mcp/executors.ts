/**
 * Centralized Tool Executors for MCP
 *
 * This file contains all tool implementations used by:
 * - Browser chat agent (useFunnelAgentMCP)
 * - External MCP clients (useMCPCommandListener)
 *
 * Both use the same executors for consistency.
 */

import { FunnelElement, DND_RULES, ColorScheme } from "../types";
import { generateSchemeFromBaseColor } from "../utils/themeGenerator";
import { CUSTOM_BLOCKS } from "../components/custom-registry";
import html2canvas from "html2canvas";

// Import design knowledge constants for MCP tools
import {
  DESIGN_GUIDELINES,
  SCHEMA_DEF,
  CONTENT_GUIDELINES,
  ICON_GUIDELINES,
} from "../services/openai";

// Re-export ColorScheme for consumers
export type { ColorScheme };

// AI Service interface (matches both OpenRouter and Gemini services)
export interface AIService {
  editComponent?: (element: any, instruction: string) => Promise<any>;
  editComponentStream?: (element: any, instruction: string) => AsyncIterable<string>;
  smartParsePartialJson?: (json: string, strict: boolean) => any;
  optimizeLayout?: (elementsJson: string, instruction: string) => Promise<any>;
  generateLandingPageWithTheme?: (content: string, color: string) => Promise<any>;
  generateLandingPageWithThemeStream?: (content: string, color: string) => AsyncIterable<string>;
  generateCopy?: (prompt: string, context?: string) => Promise<string>;
}

// Streaming chunk type for real-time updates
export interface StreamChunk {
  type: "start" | "chunk" | "partial" | "complete" | "error";
  tool?: string;
  data?: any;
  message?: string;
  progress?: number;
}

// Context passed to all tool executors
export interface ToolContext {
  // Element state
  elements: FunnelElement[];
  setElements: (elements: FunnelElement[] | ((prev: FunnelElement[]) => FunnelElement[])) => void;
  updateElement: (id: string, updates: Partial<FunnelElement>) => void;
  deleteElement: (id: string) => void;
  selectedId: string | null;

  // Theme state
  schemes: Record<string, ColorScheme>;
  currentSchemeId: string;
  addScheme: (scheme: ColorScheme, setAsCurrent?: boolean) => void;

  // AI Service (optional - only needed for AI-powered tools)
  aiService?: AIService;

  // Activity tracking (optional)
  addActivity?: (activity: any) => void;
  removeActivity?: (id: string) => void;

  // Thinking steps for chain-of-thought UI (optional)
  addThinkingStep?: (step: { id: string; label: string; status: "pending" | "running" | "completed" | "failed"; details?: string }) => void;

  // Session ID for streaming (optional - used for remote MCP connections)
  sessionId?: string;

  // Stream chunk callback for real-time updates (optional)
  onStreamChunk?: (chunk: StreamChunk) => void;
}

// Tool executor function type
export type ToolExecutor = (params: any, ctx: ToolContext) => Promise<any>;

// Helper functions
function findElementById(id: string, elements: FunnelElement[]): FunnelElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.children) {
      const found = findElementById(id, el.children);
      if (found) return found;
    }
  }
  return null;
}

function findFirstByType(type: string, elements: FunnelElement[]): FunnelElement | null {
  for (const el of elements) {
    if (el.type === type) return el;
    if (el.children) {
      const found = findFirstByType(type, el.children);
      if (found) return found;
    }
  }
  return null;
}

function findParentSection(elementId: string, elements: FunnelElement[]): FunnelElement | null {
  const element = findElementById(elementId, elements);
  if (element?.type === "section") return element;

  function findSectionContaining(id: string, sections: FunnelElement[]): FunnelElement | null {
    for (const section of sections) {
      if (section.type === "section") {
        if (containsElement(id, section.children || [])) {
          return section;
        }
      }
    }
    return null;
  }

  function containsElement(id: string, els: FunnelElement[]): boolean {
    for (const el of els) {
      if (el.id === id) return true;
      if (el.children && containsElement(id, el.children)) return true;
    }
    return false;
  }

  return findSectionContaining(elementId, elements);
}

function addToParent(
  elements: FunnelElement[],
  parentId: string,
  newElement: FunnelElement
): FunnelElement[] {
  return elements.map((el) => {
    if (el.id === parentId) {
      return { ...el, children: [...(el.children || []), newElement] };
    }
    if (el.children) {
      return { ...el, children: addToParent(el.children, parentId, newElement) };
    }
    return el;
  });
}

function showToast(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("show-toast", {
        detail: { message, type: type === "info" ? "success" : type },
      })
    );
  }
}

// ===== ICON AUTO-REPLACEMENT SYSTEM =====
// Maps content keywords to semantic Lucide icons
// This runs server-side to fix Star icons before elements are applied

const CONTENT_TO_ICON_MAP: Record<string, string> = {
  // Delivery/Shipping
  "delivery": "Truck", "shipping": "Truck", "fast delivery": "Truck",
  "free shipping": "Package", "2-day": "Truck", "courier": "Truck",
  "express": "Truck", "overnight": "Truck",

  // Security/Trust
  "security": "Shield", "secure": "Shield", "safe": "ShieldCheck",
  "protection": "Shield", "trust": "ShieldCheck", "verified": "BadgeCheck",
  "authentic": "BadgeCheck", "100%": "BadgeCheck", "guarantee": "ShieldCheck",
  "tested": "ShieldCheck", "certified": "BadgeCheck", "approved": "BadgeCheck",

  // Quality/Organic
  "quality": "Award", "premium": "Award", "best": "Trophy",
  "organic": "Leaf", "natural": "Leaf", "toxin-free": "Leaf",
  "eco": "Leaf", "green": "Leaf", "sustainable": "Leaf",

  // Speed/Performance
  "fast": "Zap", "speed": "Zap", "quick": "Timer", "instant": "Zap",
  "lightning": "Zap", "performance": "Gauge", "efficient": "Zap",

  // Returns/Refunds
  "return": "Undo2", "refund": "Undo2", "money back": "Undo2",
  "exchange": "RefreshCw", "30-day": "Undo2", "easy return": "Undo2",

  // Support
  "support": "Headphones", "help": "LifeBuoy", "24/7": "Headphones",
  "customer": "Headphones", "service": "Headphones", "assistance": "Headphones",

  // Payment
  "payment": "Lock", "pay": "CreditCard", "money": "Wallet",
  "price": "DollarSign", "discount": "Percent", "savings": "Percent",

  // AI/Tech
  "ai": "Sparkles", "smart": "Brain", "automated": "Cpu",
  "technology": "Cpu", "powered": "Sparkles", "intelligent": "Brain",

  // Communication
  "email": "Mail", "message": "MessageCircle", "contact": "Phone",
  "chat": "MessageCircle", "call": "Phone",

  // Time
  "time": "Clock", "schedule": "Calendar", "appointment": "CalendarDays",

  // Analytics
  "analytics": "BarChart3", "data": "ChartLine", "insights": "TrendingUp",
  "growth": "TrendingUp", "results": "Target",
};

/**
 * Infer the appropriate icon from text content
 * Returns null if no match found (preserves original icon)
 */
function inferIconFromText(text: string): string | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  // Check for rating-related content - these SHOULD use Star
  if (lowerText.includes("rating") || lowerText.includes("review") ||
      lowerText.includes("/5") || lowerText.includes("stars")) {
    return "Star"; // Keep Star for actual ratings
  }

  for (const [keyword, icon] of Object.entries(CONTENT_TO_ICON_MAP)) {
    if (lowerText.includes(keyword)) {
      return icon;
    }
  }
  return null;
}

/**
 * Post-process elements to replace Star icons with semantic ones
 * Runs recursively through all elements and their children
 * Also processes custom component items (boxes, detail_list)
 */
function postProcessIconsInElements(elements: any[]): any[] {
  const process = (els: any[], contextText: string = ""): any[] => {
    return els.map(el => {
      let processed = { ...el };

      // Build context from element's text fields
      const elementContext = [
        el.content,
        el.name,
        el.data?.title,
        el.data?.description,
        contextText
      ].filter(Boolean).join(" ");

      // Fix icon type elements with Star or empty
      if (el.type === "icon" && (el.content === "Star" || !el.content)) {
        const inferred = inferIconFromText(elementContext);
        if (inferred) {
          processed.content = inferred;
        } else if (el.content === "Star") {
          // Default fallback for Star icons without context
          processed.content = "CheckCircle";
        }
      }

      // Fix custom component items (boxes, detail_list, etc.)
      if (el.type === "custom" && el.data?.items && Array.isArray(el.data.items)) {
        processed.data = {
          ...el.data,
          items: el.data.items.map((item: any) => {
            if (item.icon === "Star" || !item.icon) {
              const itemContext = `${item.title || ""} ${item.description || ""}`;
              const inferred = inferIconFromText(itemContext);
              if (inferred) {
                return { ...item, icon: inferred };
              } else if (item.icon === "Star") {
                return { ...item, icon: "CheckCircle" };
              }
            }
            return item;
          }),
        };
      }

      // Recurse into children
      if (el.children && Array.isArray(el.children)) {
        processed.children = process(el.children, elementContext);
      }

      return processed;
    });
  };

  const result = process(elements);
  return result;
}

// ===== INTELLIGENT LAYOUT SYSTEM =====
// Makes generateLandingPage self-thinking for external clients

// Industry detection from content
function detectIndustry(content: string): string {
  const lower = content.toLowerCase();
  const keywords: Record<string, string[]> = {
    saas: ["software", "app", "platform", "saas", "api", "dashboard", "automation", "integrate"],
    ecommerce: ["shop", "store", "product", "buy", "cart", "price", "shipping", "order"],
    consulting: ["consulting", "strategy", "business", "advisory", "expert", "coach", "mentor"],
    education: ["course", "learn", "training", "workshop", "education", "teach", "student"],
    healthcare: ["health", "medical", "clinic", "doctor", "patient", "wellness", "therapy"],
    finance: ["finance", "investment", "money", "bank", "loan", "credit", "insurance"],
    creative: ["design", "creative", "portfolio", "art", "photography", "video", "media"],
  };

  for (const [industry, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) return industry;
  }
  return "general";
}

// Psychology framework by industry
function getFramework(industry: string): string {
  const frameworks: Record<string, string> = {
    saas: "AIDA", ecommerce: "PAS", consulting: "4Ps", education: "4Ps",
    healthcare: "PAS", finance: "AIDA", creative: "AIDA", general: "AIDA"
  };
  return frameworks[industry] || "AIDA";
}

// Section order by framework
function getSectionOrder(framework: string): string[] {
  const orders: Record<string, string[]> = {
    AIDA: ["Hero", "Logo Cloud", "Features", "How It Works", "Testimonials", "CTA"],
    PAS: ["Problem Hero", "Pain Points", "Solution", "Benefits", "Testimonials", "Guarantee CTA"],
    "4Ps": ["Promise Hero", "Transformation", "Results", "Process", "About", "Urgency CTA"],
  };
  return orders[framework] || orders.AIDA;
}


// Concrete layout templates that AI must follow
const HERO_TEMPLATES: Record<string, string> = {
  split: `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "80px 20px", bg: var(--color-background))
  └─ row (gap: 40px, alignItems: center)
      ├─ col (width: 60%)
      │   ├─ headline (fontSize: 48px, fontWeight: bold)
      │   ├─ paragraph (fontSize: 18px, marginTop: 16px)
      │   └─ button (marginTop: 24px, bg: var(--color-primary))
      └─ col (width: 40%)
          └─ image (product/hero image, rounded corners)`,

  centered: `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "100px 20px", bg: gradient or subtle pattern, textAlign: center)
  └─ wrapper (maxWidth: 800px, margin: 0 auto)
      ├─ headline (fontSize: 56px, fontWeight: bold, centered)
      ├─ paragraph (fontSize: 20px, marginTop: 20px, centered, maxWidth: 600px)
      └─ button (marginTop: 32px, centered, bg: var(--color-primary))`,

  "product-showcase": `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "60px 20px", bg: var(--color-background))
  └─ wrapper (textAlign: center)
      ├─ headline (fontSize: 44px, centered)
      ├─ image (LARGE centered product image, maxWidth: 500px)
      ├─ row (trust badges around image, gap: 20px, justifyContent: center)
      │   ├─ badge (icon + "Free Shipping")
      │   ├─ badge (icon + "Money Back")
      │   └─ badge (icon + "24/7 Support")
      └─ button (marginTop: 24px)`,

  "social-proof": `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "80px 20px", bg: var(--color-background))
  └─ wrapper (maxWidth: 700px, textAlign: center)
      ├─ row (rating stars, justifyContent: center)
      │   └─ "4.9/5 from 2,000+ reviews" with star icons
      ├─ headline (fontSize: 48px, marginTop: 16px)
      ├─ paragraph (fontSize: 18px, marginTop: 16px)
      ├─ testimonial-snippet (italic quote from customer)
      └─ button (marginTop: 24px)`,

  minimal: `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "120px 20px", bg: white, LOTS of whitespace)
  └─ wrapper (maxWidth: 600px, textAlign: center)
      ├─ headline (fontSize: 64px, fontWeight: 700, minimal text)
      └─ button (marginTop: 40px, simple CTA, no other elements)`,

  "gradient-overlay": `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "100px 20px", bg: linear-gradient(135deg, var(--color-primary) 0%, #1a1a2e 100%), color: white)
  └─ wrapper (maxWidth: 900px, textAlign: center)
      ├─ icon (large, 48px, Sparkles or relevant icon, color: rgba(255,255,255,0.9))
      ├─ headline (fontSize: 52px, fontWeight: 800, color: white, textShadow)
      ├─ paragraph (fontSize: 20px, marginTop: 20px, color: rgba(255,255,255,0.85), maxWidth: 650px)
      └─ row (gap: 16px, justifyContent: center, marginTop: 32px)
          ├─ button (bg: white, color: var(--color-primary), fontWeight: bold)
          └─ button (bg: transparent, border: 2px solid white, color: white)`,

  "video-hero": `BUILD EXACT STRUCTURE:
section (id: "hero-section", padding: "80px 20px", bg: var(--color-background))
  └─ wrapper
      ├─ row (gap: 48px, alignItems: center)
      │   ├─ col (width: 55%)
      │   │   ├─ paragraph (fontSize: 14px, textTransform: uppercase, letterSpacing: 2px, color: var(--color-primary), fontWeight: 600)
      │   │   ├─ headline (fontSize: 48px, fontWeight: 800, marginTop: 12px)
      │   │   ├─ paragraph (fontSize: 18px, marginTop: 16px, lineHeight: 1.7)
      │   │   └─ button (marginTop: 28px, bg: var(--color-primary))
      │   └─ col (width: 45%)
      │       └─ video (embedded video player, rounded corners, shadow)`,
};

const FEATURES_TEMPLATES: Record<string, string> = {
  "icon-grid": `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px")
  └─ wrapper
      ├─ headline (centered, "Why Choose Us" or similar)
      └─ row (3-4 columns, gap: 30px)
          ├─ col > wrapper(centered) > icon + headline(small) + paragraph
          ├─ col > wrapper(centered) > icon + headline(small) + paragraph
          ├─ col > wrapper(centered) > icon + headline(small) + paragraph
          └─ col > wrapper(centered) > icon + headline(small) + paragraph`,

  alternating: `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px")
  └─ wrapper
      ├─ row (alignItems: center, gap: 60px)
      │   ├─ col(50%) > image
      │   └─ col(50%) > headline + paragraph + button
      └─ row (alignItems: center, gap: 60px, REVERSED)
          ├─ col(50%) > headline + paragraph + button
          └─ col(50%) > image`,

  bento: `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px")
  └─ wrapper
      ├─ headline (centered)
      └─ grid (asymmetric, some cards span 2 columns)
          ├─ card (span: 2, larger, featured)
          ├─ card (span: 1)
          ├─ card (span: 1)
          └─ card (span: 1)`,

  "feature-cards": `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px", bg: subtle gray)
  └─ wrapper
      ├─ headline (centered)
      └─ row (3 columns, gap: 24px)
          ├─ card (elevated, shadow, padding: 32px) > icon + headline + paragraph
          ├─ card (elevated, shadow, padding: 32px) > icon + headline + paragraph
          └─ card (elevated, shadow, padding: 32px) > icon + headline + paragraph`,

  "numbered-steps": `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px")
  └─ wrapper
      ├─ headline (centered, "How It Works" or similar)
      ├─ paragraph (centered, subtitle)
      └─ row (3 columns, gap: 40px)
          ├─ col (textAlign: center)
          │   ├─ wrapper (width: 56px, height: 56px, borderRadius: 50%, bg: var(--color-primary), color: white, display: flex, alignItems: center, justifyContent: center, margin: 0 auto)
          │   │   └─ headline (fontSize: 24px, "1")
          │   ├─ headline (fontSize: 20px, marginTop: 20px)
          │   └─ paragraph (marginTop: 8px, color: #666)
          ├─ col (same structure with "2")
          └─ col (same structure with "3")`,

  "icon-list": `BUILD EXACT STRUCTURE:
section (id: "features-section", padding: "80px 20px", bg: var(--color-background))
  └─ wrapper (maxWidth: 800px)
      ├─ headline (centered)
      └─ col (gap: 24px)
          ├─ row (gap: 20px, alignItems: flex-start, padding: 24px, bg: white, borderRadius: 12px, shadow)
          │   ├─ icon (flexShrink: 0, color: var(--color-primary), size: 28px)
          │   └─ col > headline (fontSize: 18px) + paragraph (fontSize: 15px, color: #555)
          ├─ row (same pattern, different icon/content)
          ├─ row (same pattern, different icon/content)
          └─ row (same pattern, different icon/content)`,
};

const CTA_TEMPLATES: Record<string, string> = {
  urgency: `BUILD EXACT STRUCTURE:
section (id: "cta-section", padding: "60px 20px", bg: var(--color-primary), color: white)
  └─ wrapper (textAlign: center)
      ├─ custom component: countdown (type: "countdown", days/hours/mins/secs)
      ├─ headline ("Don't Miss Out!" or time-sensitive copy)
      ├─ paragraph (urgency message)
      └─ button (contrasting color, large)`,

  guarantee: `BUILD EXACT STRUCTURE:
section (id: "cta-section", padding: "80px 20px", bg: var(--color-background))
  └─ wrapper (textAlign: center)
      ├─ icon (Shield or BadgeCheck, large)
      ├─ headline ("100% Money-Back Guarantee" or similar)
      ├─ paragraph (risk-free promise details)
      └─ button (prominent CTA)`,

  minimal: `BUILD EXACT STRUCTURE:
section (id: "cta-section", padding: "100px 20px", bg: subtle gradient)
  └─ wrapper (textAlign: center, maxWidth: 500px)
      ├─ headline (simple, compelling)
      └─ button (single CTA, no distractions)`,

  comparison: `BUILD EXACT STRUCTURE:
section (id: "cta-section", padding: "80px 20px")
  └─ wrapper (textAlign: center)
      ├─ headline ("Compare the Value")
      ├─ row (price comparison)
      │   ├─ col (regular price, crossed out)
      │   └─ col (your price, highlighted)
      └─ button (CTA with savings message)`,

  "social-cta": `BUILD EXACT STRUCTURE:
section (id: "cta-section", padding: "80px 20px", bg: var(--color-background))
  └─ wrapper (textAlign: center, maxWidth: 700px)
      ├─ row (justifyContent: center, gap: 4px, marginBottom: 16px)
      │   └─ 5 star icons (color: gold, filled)
      ├─ paragraph (italic, "Join 10,000+ happy customers", fontSize: 16px)
      ├─ headline (fontSize: 36px, fontWeight: 800, marginTop: 16px)
      ├─ paragraph (marginTop: 12px, compelling value prop)
      └─ button (marginTop: 28px, large, bg: var(--color-primary))`,
};

const SOCIAL_PROOF_TEMPLATES: Record<string, string> = {
  "testimonial-grid": `BUILD EXACT STRUCTURE:
section (id: "testimonials-section", padding: "80px 20px")
  └─ wrapper
      ├─ headline (centered, "What Our Customers Say")
      └─ row (3 columns, gap: 24px)
          ├─ testimonial-card > quote + name + role + optional photo
          ├─ testimonial-card > quote + name + role + optional photo
          └─ testimonial-card > quote + name + role + optional photo`,

  "stats-bar": `BUILD EXACT STRUCTURE:
section (id: "social-proof-section", padding: "40px 20px", bg: subtle)
  └─ row (justify: space-around, 4 stats)
      ├─ stat > number ("10,000+") + label ("Happy Customers")
      ├─ stat > number ("99%") + label ("Satisfaction Rate")
      ├─ stat > number ("50+") + label ("Countries")
      └─ stat > number ("24/7") + label ("Support")`,

  "logo-cloud": `BUILD EXACT STRUCTURE:
section (id: "logos-section", padding: "40px 20px", bg: white)
  └─ wrapper (textAlign: center)
      ├─ paragraph ("Trusted by leading companies")
      └─ row (logos, gap: 40px, grayscale filter, justifyContent: center)
          └─ 5-6 company logo images`,

  "case-study": `BUILD EXACT STRUCTURE:
section (id: "case-study-section", padding: "80px 20px")
  └─ wrapper
      ├─ headline ("Success Story" or specific client name)
      └─ row (2 columns)
          ├─ col > image (client photo or results graph)
          └─ col > quote (long testimonial) + metrics + name + role`,

  "single-spotlight": `BUILD EXACT STRUCTURE:
section (id: "testimonial-section", padding: "80px 20px", bg: subtle gradient or light bg)
  └─ wrapper (maxWidth: 700px, textAlign: center)
      ├─ icon (Quote or MessageCircle, large, color: var(--color-primary), opacity: 0.3)
      ├─ paragraph (fontSize: 22px, fontStyle: italic, lineHeight: 1.8, marginTop: 20px, featured testimonial quote)
      ├─ row (justifyContent: center, alignItems: center, gap: 16px, marginTop: 24px)
      │   ├─ image (width: 56px, height: 56px, borderRadius: 50%, customer photo)
      │   └─ col > headline (fontSize: 16px, customer name) + paragraph (fontSize: 14px, role/company)
      └─ row (justifyContent: center, gap: 4px, marginTop: 12px)
          └─ 5 star icons (small, color: gold)`,
};

// Generate layout instructions for AI
function generateLayoutInstructions(
  content: string,
  industry?: string,
  style?: string
): { instructions: string; strategy: any } {
  const detectedIndustry = industry || detectIndustry(content);
  const framework = getFramework(detectedIndustry);

  // Generate truly random selection each time (NOT content-based)
  // This ensures every generation produces a unique design combination
  const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Select unique layout combination - random every time
  const heroStyles = ["split", "centered", "product-showcase", "social-proof", "minimal", "gradient-overlay", "video-hero"];
  const featureLayouts = ["icon-grid", "alternating", "bento", "feature-cards", "numbered-steps", "icon-list"];
  const ctaStyles = ["urgency", "guarantee", "minimal", "comparison", "social-cta"];
  const socialProofStyles = ["testimonial-grid", "stats-bar", "logo-cloud", "case-study", "single-spotlight"];

  const selectedHero = randomPick(heroStyles);
  const selectedFeatures = randomPick(featureLayouts);
  const selectedCta = randomPick(ctaStyles);
  const selectedSocialProof = randomPick(socialProofStyles);

  const strategy = {
    framework,
    industry: detectedIndustry,
    heroStyle: selectedHero,
    featuresLayout: selectedFeatures,
    ctaStyle: selectedCta,
    socialProofStyle: selectedSocialProof,
    sectionOrder: getSectionOrder(framework),
    uniqueId: Math.random().toString(36).slice(2, 8),
  };

  const instructions = `

===== LAYOUT SPECIFICATION (MUST FOLLOW EXACTLY) =====
This is a UNIQUE design combination #${strategy.uniqueId}. Follow these exact layouts.

PSYCHOLOGY FRAMEWORK: ${framework}
INDUSTRY: ${detectedIndustry}

SECTION ORDER: ${strategy.sectionOrder.join(" → ")}

--- HERO SECTION (${selectedHero} style) ---
${HERO_TEMPLATES[selectedHero]}

--- FEATURES SECTION (${selectedFeatures} layout) ---
${FEATURES_TEMPLATES[selectedFeatures]}

--- SOCIAL PROOF (${selectedSocialProof} style) ---
${SOCIAL_PROOF_TEMPLATES[selectedSocialProof]}

--- CTA SECTION (${selectedCta} style) ---
${CTA_TEMPLATES[selectedCta]}

CRITICAL RULES:
1. Follow the EXACT structure templates above
2. Use the section order specified for ${framework} framework
3. Every element MUST have unique id (kebab-case)
4. Use CSS variables: var(--color-primary), var(--color-background), etc.
5. NO emojis - use Lucide icons only
6. Icons must match content meaning (see ICON_GUIDELINES)

===== END SPECIFICATION =====
`;

  return { instructions, strategy };
}

// ===== SMART MERGE HELPERS FOR IN-PLACE UPDATES =====

// Helper to detect if instruction wants to fundamentally change/remove children
function instructionChangesChildren(instruction: string): boolean {
  const childChangeKeywords = [
    "add new section", "add section", "remove section", "delete section",
    "reorganize", "restructure", "rebuild", "replace all", "start over",
    "create new", "add new element", "remove element", "delete element"
  ];
  const lower = instruction.toLowerCase();
  return childChangeKeywords.some(kw => lower.includes(kw));
}

// Smart merge children - preserve IDs and structure when possible
function smartMergeChildren(
  original: FunnelElement[],
  updated: FunnelElement[] | undefined
): FunnelElement[] {
  if (!updated || updated.length === 0) return original;

  // If same length, try to match by ID and merge properties
  if (original.length === updated.length) {
    return original.map((orig, i) => {
      const matchById = updated.find(u => u.id === orig.id);
      if (matchById) {
        // Merge, preserving original ID
        return {
          ...matchById,
          id: orig.id,
          // Recursively merge children if both have children
          children: orig.children && matchById.children
            ? smartMergeChildren(orig.children, matchById.children)
            : (matchById.children || orig.children)
        };
      }
      // If no ID match, try positional match
      if (updated[i]) {
        return {
          ...updated[i],
          id: orig.id,
          children: orig.children && updated[i].children
            ? smartMergeChildren(orig.children, updated[i].children)
            : (updated[i].children || orig.children)
        };
      }
      return orig;
    });
  }

  // Different lengths - AI added or removed elements
  // Try to preserve what we can by ID matching
  const result: FunnelElement[] = [];
  const usedUpdatedIds = new Set<string>();

  for (const orig of original) {
    const matchById = updated.find(u => u.id === orig.id && !usedUpdatedIds.has(u.id));
    if (matchById) {
      usedUpdatedIds.add(matchById.id);
      result.push({
        ...matchById,
        id: orig.id,
        children: orig.children && matchById.children
          ? smartMergeChildren(orig.children, matchById.children)
          : (matchById.children || orig.children)
      });
    } else {
      // Original element not in updated - keep it if instruction didn't ask to remove
      result.push(orig);
    }
  }

  // Add any new elements from updated that weren't matched
  for (const upd of updated) {
    if (!usedUpdatedIds.has(upd.id) && !original.find(o => o.id === upd.id)) {
      result.push(upd);
    }
  }

  return result;
}

// Helper to emit element-specific loading events (browser side)
function emitElementActivity(
  elementId: string,
  activityType: "start" | "complete",
  description?: string
) {
  if (typeof window === "undefined") return;

  const eventName = activityType === "start" ? "mcp-scan-start" : "mcp-scan-complete";

  window.dispatchEvent(new CustomEvent(eventName, {
    detail: {
      elementId,
      scanType: "analyzing",
      description: description || `AI updating element...`
    }
  }));
}

// ===== QUALITY CHECK SYSTEM =====

interface QualityIssue {
  elementId: string;
  issue: "empty_section" | "missing_headline" | "missing_cta" | "no_wrapper" | "missing_content" | "insufficient_padding" | "oversized_text" | "flat_structure";
  severity: "critical" | "warning";
  description: string;
}

// Check if element tree contains a specific type
function hasElementType(element: FunnelElement, type: string): boolean {
  if (element.type === type) return true;
  return element.children?.some(c => hasElementType(c, type)) || false;
}

// Check if element has any meaningful content
function hasContent(element: FunnelElement): boolean {
  // Has direct content
  if (element.content && element.content.trim().length > 0) return true;
  // Has text elements
  if (element.type === "headline" || element.type === "paragraph") return true;
  // Check children
  return element.children?.some(c => hasContent(c)) || false;
}

// Parse vertical padding from a CSS padding string (e.g. "80px 20px" → 80)
function parseVerticalPadding(padding: string): number {
  if (!padding) return 0;
  const parts = padding.replace(/px/g, "").trim().split(/\s+/);
  if (parts.length >= 1) return parseInt(parts[0]) || 0;
  return 0;
}

// Check for oversized text in element tree
function findOversizedText(element: FunnelElement, issues: QualityIssue[]): void {
  if (element.type === "headline" && element.style?.fontSize) {
    const size = parseInt(String(element.style.fontSize));
    if (size > 80) {
      issues.push({
        elementId: element.id,
        issue: "oversized_text",
        severity: "warning",
        description: `Headline "${(element.content || "").slice(0, 30)}" has oversized font (${size}px, max 72px recommended)`
      });
    }
  }
  element.children?.forEach(c => findOversizedText(c, issues));
}

// Run quick quality checks on generated elements (non-AI validation)
function runQuickQualityCheck(elements: FunnelElement[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const section of elements) {
    if (section.type !== "section") continue;

    // Check for empty sections (no children)
    if (!section.children?.length) {
      issues.push({
        elementId: section.id,
        issue: "empty_section",
        severity: "critical",
        description: `Section "${section.name || section.id}" has no children`
      });
      continue;
    }

    // Check for sections with no meaningful content
    if (!hasContent(section)) {
      issues.push({
        elementId: section.id,
        issue: "missing_content",
        severity: "critical",
        description: `Section "${section.name || section.id}" has no visible content`
      });
      continue;
    }

    // Check atomic design: section should have wrapper
    const hasWrapper = section.children.some(c => c.type === "wrapper");
    if (!hasWrapper) {
      issues.push({
        elementId: section.id,
        issue: "no_wrapper",
        severity: "warning",
        description: `Section "${section.name || section.id}" missing wrapper element`
      });
    }

    // Check hero sections have headline + CTA
    const isHero = section.name?.toLowerCase().includes("hero") ||
                   section.id?.toLowerCase().includes("hero");
    if (isHero) {
      if (!hasElementType(section, "headline")) {
        issues.push({
          elementId: section.id,
          issue: "missing_headline",
          severity: "critical",
          description: `Hero section missing headline`
        });
      }
      if (!hasElementType(section, "button")) {
        issues.push({
          elementId: section.id,
          issue: "missing_cta",
          severity: "warning",
          description: `Hero section missing CTA button`
        });
      }
    }

    // === DESIGN HEURISTIC CHECKS ===

    // Check section vertical padding (minimum 40px, recommended 80px+)
    const sectionStyle = section.style || {};
    const paddingStr = typeof sectionStyle.padding === "string" ? sectionStyle.padding : "";
    if (paddingStr) {
      const verticalPadding = parseVerticalPadding(paddingStr);
      if (verticalPadding > 0 && verticalPadding < 40) {
        issues.push({
          elementId: section.id,
          issue: "insufficient_padding",
          severity: "warning",
          description: `Section "${section.name || section.id}" has insufficient vertical padding (${verticalPadding}px, minimum 80px recommended)`
        });
      }
    }

    // Check for oversized text anywhere in the section
    findOversizedText(section, issues);

    // Check for flat structure (many direct children without wrapper/row organization)
    const maxDepth = getElementDepth(section);
    if (maxDepth < 3 && (section.children?.length || 0) > 3) {
      issues.push({
        elementId: section.id,
        issue: "flat_structure",
        severity: "warning",
        description: `Section "${section.name || section.id}" appears flat - consider adding wrapper/row/col structure for better layout`
      });
    }
  }

  return issues;
}

// Fix critical quality issues and auto-fixable design issues (one-time, no looping)
async function fixCriticalIssues(
  issues: QualityIssue[],
  ctx: ToolContext
): Promise<{ fixed: number; remaining: number }> {
  const criticalIssues = issues.filter(i => i.severity === "critical");
  const autoFixableWarnings = issues.filter(i =>
    i.severity === "warning" && (i.issue === "insufficient_padding" || i.issue === "oversized_text")
  );
  let fixed = 0;

  // Fix critical issues
  for (const issue of criticalIssues) {
    const element = findElementById(issue.elementId, ctx.elements);
    if (!element) continue;

    if (issue.issue === "empty_section" || issue.issue === "missing_content") {
      console.log(`[Quality] Removing empty section: ${issue.elementId}`);
      ctx.deleteElement(issue.elementId);
      fixed++;
    } else if (issue.issue === "missing_headline" && ctx.aiService?.editComponent) {
      console.log(`[Quality] Adding headline to: ${issue.elementId}`);
      try {
        emitElementActivity(issue.elementId, "start", "Adding headline...");
        const updated = await ctx.aiService.editComponent(
          element,
          "Add a compelling headline to this hero section. Make it engaging and action-oriented."
        );
        if (updated) {
          ctx.updateElement(issue.elementId, { ...updated, id: element.id });
          fixed++;
        }
        emitElementActivity(issue.elementId, "complete");
      } catch (e) {
        console.error("[Quality] Failed to add headline:", e);
        emitElementActivity(issue.elementId, "complete");
      }
    }
  }

  // Auto-fix design warnings (simple style corrections, no AI needed)
  for (const issue of autoFixableWarnings) {
    const element = findElementById(issue.elementId, ctx.elements);
    if (!element) continue;

    if (issue.issue === "insufficient_padding") {
      console.log(`[Quality] Fixing padding for: ${issue.elementId}`);
      ctx.updateElement(issue.elementId, {
        style: { ...element.style, padding: "80px 20px" }
      });
      fixed++;
    } else if (issue.issue === "oversized_text") {
      console.log(`[Quality] Fixing oversized text for: ${issue.elementId}`);
      ctx.updateElement(issue.elementId, {
        style: { ...element.style, fontSize: "64px" }
      });
      fixed++;
    }
  }

  return { fixed, remaining: criticalIssues.length + autoFixableWarnings.length - fixed };
}

// ===== AUTO SCREENSHOT & VERIFY SYSTEM =====
// Captures screenshot and runs quality checks after section/component creation

interface VerifyResult {
  verified: boolean;
  screenshot: string | null;
  issues: QualityIssue[];
  fixed: number;
  elementId: string;
}

/**
 * Resolve CSS variable styles for html2canvas cloning
 */
function resolveCssVarsForClone(clonedElement: Element) {
  const resolveStyles = (el: Element) => {
    const computed = window.getComputedStyle(el);
    const htmlEl = el as HTMLElement;
    const color = computed.color;
    const bgColor = computed.backgroundColor;
    const borderColor = computed.borderColor;
    if (color && color !== "rgba(0, 0, 0, 0)") {
      htmlEl.style.setProperty("color", color, "important");
    }
    if (bgColor && bgColor !== "rgba(0, 0, 0, 0)") {
      htmlEl.style.setProperty("background-color", bgColor, "important");
    }
    if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") {
      htmlEl.style.borderColor = borderColor;
    }
    if (computed.textShadow && computed.textShadow !== "none") {
      htmlEl.style.textShadow = computed.textShadow;
    }
    Array.from(el.children).forEach(resolveStyles);
  };
  resolveStyles(clonedElement);
}

/**
 * Auto screenshot and verify a section/element after creation or edit.
 * Takes screenshot, runs structural quality checks, fixes critical issues.
 * Single-pass only (no loops).
 */
async function autoScreenshotAndVerify(
  elementId: string,
  ctx: ToolContext
): Promise<VerifyResult> {
  const element = findElementById(elementId, ctx.elements);
  if (!element) {
    return { verified: false, screenshot: null, issues: [], fixed: 0, elementId };
  }

  // Wait for DOM to render
  await new Promise(r => setTimeout(r, 500));

  let screenshot: string | null = null;

  // 1. Take screenshot (browser context only)
  if (typeof document !== "undefined" && typeof window !== "undefined") {
    try {
      let domEl = document.getElementById(elementId);
      if (!domEl) domEl = document.querySelector(`[data-element-id="${elementId}"]`);

      if (domEl) {
        // Show verify animation
        window.dispatchEvent(new CustomEvent("mcp-scan-start", {
          detail: { elementId, scanType: "verifying", description: "Auto-verifying design quality..." }
        }));

        const canvas = await html2canvas(domEl as HTMLElement, {
          scale: 1.5,
          backgroundColor: null,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
          onclone: (_clonedDoc, clonedElement) => {
            clonedElement.classList.remove("mcp-scanning");
            resolveCssVarsForClone(clonedElement);
          },
        });
        screenshot = canvas.toDataURL("image/png").split(",")[1];

        // Dispatch screenshot event for UI
        window.dispatchEvent(new CustomEvent("mcp-screenshot-complete", {
          detail: { elementId, imageData: screenshot, autoVerify: true }
        }));

        await new Promise(r => setTimeout(r, 600));
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
    } catch (e) {
      console.warn("[AutoVerify] Screenshot failed:", e);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
    }
  }

  // 2. Run structural quality checks
  const sectionsToCheck = element.type === "section"
    ? [element]
    : ctx.elements.filter(e => e.type === "section");
  const issues = runQuickQualityCheck(sectionsToCheck);

  // 3. Fix critical issues (single pass, no looping)
  let fixed = 0;
  if (issues.length > 0) {
    console.log(`[AutoVerify] Found ${issues.length} issue(s) for ${elementId}:`, issues.map(i => i.description));
    const fixResult = await fixCriticalIssues(issues, ctx);
    fixed = fixResult.fixed;
    if (fixed > 0) {
      showToast(`Auto-fixed ${fixed} quality issue(s)`, "info");
    }
  }

  return { verified: true, screenshot, issues, fixed, elementId };
}

/**
 * Auto-verify all root sections after full page generation.
 * Screenshots each section and runs quality checks.
 */
async function autoVerifyAllSections(
  ctx: ToolContext
): Promise<{ totalIssues: number; totalFixed: number; sectionResults: VerifyResult[] }> {
  const sections = ctx.elements.filter(el => el.type === "section");
  const results: VerifyResult[] = [];
  let totalIssues = 0;
  let totalFixed = 0;

  for (const section of sections) {
    const result = await autoScreenshotAndVerify(section.id, ctx);
    results.push(result);
    totalIssues += result.issues.length;
    totalFixed += result.fixed;
  }

  return { totalIssues, totalFixed, sectionResults: results };
}

// All tool executors
export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  // === CONNECTION & INFO TOOLS ===

  checkConnection: async () => {
    return { connected: true, timestamp: Date.now() };
  },

  getElementTypes: async () => {
    return {
      types: [
        { type: "section", description: "Container section for page content" },
        { type: "row", description: "Horizontal row container" },
        { type: "col", description: "Column within a row" },
        { type: "headline", description: "Headline/title text" },
        { type: "paragraph", description: "Paragraph text content" },
        { type: "button", description: "Clickable button" },
        { type: "image", description: "Image element" },
        { type: "video", description: "Video embed" },
        { type: "input", description: "Form input field" },
        { type: "icon", description: "Icon element" },
      ],
    };
  },

  // === CONTENT MANIPULATION TOOLS ===

  setElements: async (params, ctx) => {
    const { elements: newElements, progressive = true } = params;
    if (Array.isArray(newElements)) {
      // Start AI activity for page generation
      if (ctx.addActivity) {
        ctx.addActivity({
          elementId: null,
          activityType: "generating",
          description: "Building page...",
          startTime: Date.now(),
        });
      }

      // Trigger generating animation
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mcp-scan-start", {
            detail: { elementId: "page-root", scanType: "generating", description: "Building page..." },
          })
        );
      }

      // Post-process to replace Star icons with semantic ones
      const processedElements = postProcessIconsInElements(newElements);

      // Progressive rendering - add elements one by one for real-time effect
      if (progressive && processedElements.length > 1) {
        // Clear existing elements first
        ctx.setElements([]);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add each section progressively
        for (let i = 0; i < processedElements.length; i++) {
          const elementsToShow = processedElements.slice(0, i + 1);
          ctx.setElements(elementsToShow);

          // Dispatch progress event
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("mcp-element-added", {
                detail: {
                  elementId: processedElements[i].id,
                  index: i + 1,
                  total: processedElements.length,
                  name: processedElements[i].name || `Section ${i + 1}`
                },
              })
            );
          }

          // Small delay between sections for visual effect
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } else {
        // Set all at once (non-progressive)
        ctx.setElements(processedElements);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // End activity
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
      if (ctx.removeActivity) {
        ctx.removeActivity("page-root");
      }

      showToast(`Page updated with ${processedElements.length} elements!`, "success");

      // Auto screenshot & verify all sections
      const setElVerify = await autoVerifyAllSections(ctx);

      return {
        success: true,
        message: `Page updated with ${processedElements.length} elements (icons auto-mapped)`,
        elementCount: processedElements.length,
        iconProcessing: "Star icons were automatically replaced with semantic icons based on content",
        verification: {
          sectionsVerified: setElVerify.sectionResults.length,
          totalIssues: setElVerify.totalIssues,
          totalFixed: setElVerify.totalFixed,
          screenshots: setElVerify.sectionResults.filter(r => r.screenshot).length,
        },
      };
    }
    return { success: false, error: "Invalid elements array provided" };
  },

  addElement: async (params, ctx) => {
    const { element, parentId, insertAtIndex } = params;
    if (!element) {
      return { success: false, error: "No element provided" };
    }

    // Post-process the element to replace Star icons
    const processedElement = postProcessIconsInElements([element])[0];

    if (parentId) {
      const parent = findElementById(parentId, ctx.elements);
      if (!parent) {
        return { success: false, error: `Parent element ${parentId} not found` };
      }

      // If insertAtIndex is provided, insert at specific position
      if (typeof insertAtIndex === 'number') {
        ctx.setElements((prev) => {
          const insertAtParent = (els: FunnelElement[]): FunnelElement[] => {
            return els.map(el => {
              if (el.id === parentId) {
                const children = [...(el.children || [])];
                const index = Math.max(0, Math.min(insertAtIndex, children.length));
                children.splice(index, 0, processedElement);
                return { ...el, children };
              }
              if (el.children) {
                return { ...el, children: insertAtParent(el.children) };
              }
              return el;
            });
          };
          return insertAtParent(prev);
        });
      } else {
        ctx.setElements((prev) => addToParent(prev, parentId, processedElement));
      }
      showToast(`Added ${processedElement.name || processedElement.type} to ${parent.name}`, "success");
    } else {
      // If insertAtIndex is provided, insert at specific position in root
      if (typeof insertAtIndex === 'number') {
        ctx.setElements((prev) => {
          const newElements = [...prev];
          const index = Math.max(0, Math.min(insertAtIndex, newElements.length));
          newElements.splice(index, 0, processedElement);
          return newElements;
        });
      } else {
        ctx.setElements((prev) => [...prev, processedElement]);
      }
      showToast(`Added: ${processedElement.name || processedElement.type}`, "success");
    }

    // Auto screenshot & verify the newly added element
    const verifyTarget = processedElement.type === "section"
      ? processedElement.id
      : (findParentSection(processedElement.id, ctx.elements)?.id || processedElement.id);
    const verifyResult = await autoScreenshotAndVerify(verifyTarget, ctx);

    return {
      success: true,
      message: `Element ${processedElement.id} added successfully (icons auto-mapped)`,
      elementId: processedElement.id,
      parentId: parentId || null,
      insertedAtIndex: insertAtIndex,
      verification: {
        screenshot: verifyResult.screenshot ? true : false,
        issues: verifyResult.issues.length,
        fixed: verifyResult.fixed,
      },
    };
  },

  updateElement: async (params, ctx) => {
    const { id, updates } = params;
    if (!id || !updates) {
      return { success: false, error: "Missing id or updates" };
    }

    const element = findElementById(id, ctx.elements);
    if (!element) {
      return { success: false, error: `Element ${id} not found` };
    }

    // Start AI activity indicator for this element
    if (ctx.addActivity) {
      ctx.addActivity({
        elementId: id,
        activityType: "updating",
        description: `Updating ${element.name}...`,
        startTime: Date.now(),
      });
    }

    // Trigger scanning animation on the element
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId: id, scanType: "analyzing", description: "Updating element..." },
        })
      );
    }

    // Process updates: handle special mappings for different element types
    let processedUpdates = { ...updates };

    // For icon elements, map 'icon' field to 'content' field
    // Icon elements store their icon name in 'content', not 'icon'
    if (element.type === "icon" && updates.icon && !updates.content) {
      processedUpdates.content = updates.icon;
      delete processedUpdates.icon;
    }

    // Perform the update
    ctx.updateElement(id, processedUpdates);

    // Small delay to allow state to settle and show visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    // End scanning animation
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    // End AI activity indicator
    if (ctx.removeActivity) {
      ctx.removeActivity(id);
    }

    showToast(`Element updated!`, "success");
    return { success: true, message: `Element ${id} updated successfully` };
  },

  deleteElement: async (params, ctx) => {
    const { elementId } = params;
    const element = findElementById(elementId, ctx.elements);

    if (element) {
      ctx.deleteElement(elementId);
      showToast(`Deleted: ${element.name}`, "success");
      return { success: true, message: `Element ${elementId} deleted` };
    }
    return { success: false, error: `Element ${elementId} not found` };
  },

  generatePage: async (params, ctx) => {
    const { elements: pageElements, themeColor, themeName } = params;

    if (!Array.isArray(pageElements)) {
      return { success: false, error: "Invalid elements array" };
    }

    // Trigger generating animation
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId: "page-root", scanType: "generating", description: "Building landing page..." },
        })
      );
    }

    // Post-process to replace Star icons with semantic ones
    const processedElements = postProcessIconsInElements(pageElements);

    // Progressive rendering - add elements one by one
    if (processedElements.length > 1) {
      ctx.setElements([]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (let i = 0; i < processedElements.length; i++) {
        ctx.setElements(processedElements.slice(0, i + 1));

        // Dispatch progress event
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("mcp-element-added", {
              detail: {
                elementId: processedElements[i].id,
                index: i + 1,
                total: processedElements.length,
                name: processedElements[i].name || `Section ${i + 1}`
              },
            })
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } else {
      ctx.setElements(processedElements);
    }

    // End animation
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    showToast(`Landing page generated!`, "success");

    let schemeId = null;
    if (themeColor) {
      const scheme = generateSchemeFromBaseColor(
        themeColor,
        themeName || `Theme - ${themeColor}`,
        "theme-generated"
      );
      if (scheme) {
        ctx.addScheme(scheme, true);
        schemeId = scheme.id;
      }
    }

    // Auto screenshot & verify all sections
    const verifyResults = await autoVerifyAllSections(ctx);

    return {
      success: true,
      message: `Landing page generated with ${processedElements.length} elements (icons auto-mapped)`,
      elementCount: processedElements.length,
      themeApplied: !!themeColor,
      schemeId,
      iconProcessing: "Star icons were automatically replaced with semantic icons based on content",
      verification: {
        sectionsVerified: verifyResults.sectionResults.length,
        totalIssues: verifyResults.totalIssues,
        totalFixed: verifyResults.totalFixed,
      },
    };
  },

  // === SIMPLE UPDATE TOOLS ===

  changeTheme: async (params, ctx) => {
    const { color } = params;
    const scheme = generateSchemeFromBaseColor(color, `Theme - ${color}`, "theme-generated");

    if (scheme) {
      ctx.addScheme(scheme, true);
      showToast(`Theme changed to ${color}!`, "success");
      return { success: true, message: `Theme changed to ${color}`, schemeId: scheme.id };
    }
    return { success: false, error: `Failed to generate theme for color: ${color}` };
  },

  setHeadline: async (params, ctx) => {
    const { text, elementId } = params;
    let targetId = elementId;

    if (!targetId) {
      const headline = findFirstByType("headline", ctx.elements);
      if (headline) targetId = headline.id;
    }

    if (targetId) {
      ctx.updateElement(targetId, { content: text });
      showToast(`Headline updated!`, "success");
      return { success: true, message: `Headline updated`, elementId: targetId };
    }
    showToast(`No headline found`, "warning");
    return { success: false, error: "No headline element found" };
  },

  setButtonText: async (params, ctx) => {
    const { text, elementId } = params;
    let targetId = elementId;

    if (!targetId) {
      const button = findFirstByType("button", ctx.elements);
      if (button) targetId = button.id;
    }

    if (targetId) {
      ctx.updateElement(targetId, { content: text });
      showToast(`Button updated!`, "success");
      return { success: true, message: `Button text updated`, elementId: targetId };
    }
    showToast(`No button found`, "warning");
    return { success: false, error: "No button element found" };
  },

  setImageUrl: async (params, ctx) => {
    const { url, elementId, alt } = params;
    let targetId = elementId;

    if (!targetId) {
      const image = findFirstByType("image", ctx.elements);
      if (image) targetId = image.id;
    }

    if (targetId) {
      const updates: Partial<FunnelElement> = { src: url };
      if (alt) updates.content = alt;
      ctx.updateElement(targetId, updates);
      showToast(`Image updated!`, "success");
      return { success: true, message: `Image URL set`, elementId: targetId };
    }
    showToast(`No image found`, "warning");
    return { success: false, error: "No image element found" };
  },

  // === QUERY TOOLS ===

  getDesignSystem: async (params, ctx) => {
    const currentScheme = ctx.schemes?.[ctx.currentSchemeId];

    const cssVariables = currentScheme
      ? Object.entries(currentScheme.settings).map(([key, value]) => ({
          variable: `--color-${key.replace(/_/g, "-")}`,
          key,
          value,
        }))
      : [];

    return {
      currentSchemeId: ctx.currentSchemeId,
      currentScheme: currentScheme
        ? {
            id: currentScheme.id,
            name: currentScheme.name,
            colors: currentScheme.settings,
          }
        : null,
      availableSchemes: ctx.schemes
        ? Object.keys(ctx.schemes).map((id) => ({
            id,
            name: ctx.schemes[id].name,
          }))
        : [],
      cssVariables,
      usage:
        "Use CSS variables like var(--color-primary) or var(--color-background) in element styles to match the current theme.",
    };
  },

  getCapabilities: async (params, ctx) => {
    const customComponents = Object.entries(CUSTOM_BLOCKS).reduce((acc, [key, def]) => {
      if (!acc.find((c: any) => c.name === def.name)) {
        acc.push({
          key,
          name: def.name,
          category: def.category,
          description: `Custom ${def.name} component`,
          hasVariants: !!def.variants,
          variantCount: def.variants?.length || 0,
        });
      }
      return acc;
    }, [] as any[]);

    return {
      elementTypes: [
        { type: "section", description: "Root container for page sections", canHaveChildren: true, allowedChildren: DND_RULES.section },
        { type: "wrapper", description: "Generic flex container", canHaveChildren: true, allowedChildren: DND_RULES.wrapper },
        { type: "row", description: "Horizontal row container", canHaveChildren: true, allowedChildren: DND_RULES.row },
        { type: "col", description: "Column within a row", canHaveChildren: true, allowedChildren: DND_RULES.col },
        { type: "headline", description: "Headline/title text", canHaveChildren: false, requiredProps: ["content"] },
        { type: "paragraph", description: "Paragraph text content", canHaveChildren: false, requiredProps: ["content"] },
        { type: "button", description: "Clickable button", canHaveChildren: false, requiredProps: ["content"] },
        { type: "image", description: "Image element", canHaveChildren: false, requiredProps: ["src"] },
        { type: "video", description: "Video embed", canHaveChildren: false, requiredProps: ["data.videoUrl"] },
        { type: "input", description: "Form input field", canHaveChildren: false },
        { type: "icon", description: "Icon element - MUST use Lucide icons matching content meaning. Put icon name in 'content' property!", canHaveChildren: false, requiredProps: ["content"], iconExamples: ["Truck", "Shield", "Zap", "CheckCircle", "BadgeCheck", "Package", "Headphones", "Lock"], contentToIcon: { "delivery": "Truck", "security": "Shield", "speed": "Zap", "quality": "BadgeCheck", "shipping": "Package", "support": "Headphones", "payment": "Lock", "returns": "Undo2" } },
        { type: "custom", description: "Custom registered component", canHaveChildren: false, requiredProps: ["customType"] },
      ],
      customComponents,
      nestingRules: {
        root: DND_RULES.root,
        section: DND_RULES.section,
        row: DND_RULES.row,
        col: DND_RULES.col,
        wrapper: DND_RULES.wrapper,
      },
      requiredElementFields: ["id", "type", "name", "style"],
      tips: [
        "⚠️ CRITICAL: EVERY element MUST have a unique 'id' field! Use kebab-case: 'hero-section', 'feature-card-1'. Missing/duplicate IDs break the editor!",
        "Always start with a 'section' element at the root level",
        "Use CSS variables like var(--color-primary) for theme-aware colors",
        "For modern layouts, consider using custom components like 'boxes', 'carousel', 'gallery'",
        "Use 'row' with 'col' children for responsive column layouts",
        "NEVER use emojis (⚡🚀✅🎨) - use 'icon' elements with Lucide icons",
        "Icon MUST match content meaning: 'Fast Delivery' → Truck, 'Secure' → Shield, '100% Authentic' → BadgeCheck",
        "NEVER use 'Star' as default icon - only for ratings/reviews. Use searchIcon tool to find the right icon!",
        "Icon element structure: { type: 'icon', id: 'my-icon', content: 'Truck', style: { color: 'var(--color-primary)' } }",
      ],
    };
  },

  getCurrentElements: async (params, ctx) => {
    const { includeStyles } = params || {};

    const simplifyElement = (el: FunnelElement): any => ({
      id: el.id,
      type: el.type,
      name: el.name,
      content: el.content,
      src: el.src,
      ...(includeStyles && { style: el.style, tabletStyle: el.tabletStyle, mobileStyle: el.mobileStyle }),
      ...(el.customType && { customType: el.customType }),
      ...(el.data && { data: el.data }),
      ...(el.children && { children: el.children.map(simplifyElement) }),
    });

    return {
      elements: ctx.elements.map(simplifyElement),
      count: ctx.elements.length,
    };
  },

  findElement: async (params, ctx) => {
    const { type, name, content } = params || {};
    const matches: any[] = [];

    const searchRecursive = (els: FunnelElement[]) => {
      for (const el of els) {
        let match = true;
        if (type && el.type !== type) match = false;
        if (name && !el.name.toLowerCase().includes(name.toLowerCase())) match = false;
        if (content && (!el.content || !el.content.toLowerCase().includes(content.toLowerCase())))
          match = false;
        if (match && (type || name || content)) {
          matches.push({
            id: el.id,
            type: el.type,
            name: el.name,
            content: el.content?.substring(0, 100),
          });
        }
        if (el.children) searchRecursive(el.children);
      }
    };

    searchRecursive(ctx.elements);
    return { matches, count: matches.length };
  },

  getSelectedElement: async (params, ctx) => {
    const selectedElement = ctx.selectedId ? findElementById(ctx.selectedId, ctx.elements) : null;
    const parent = ctx.selectedId ? findParentSection(ctx.selectedId, ctx.elements) : null;

    // Trigger scanning animation if element exists
    if (ctx.selectedId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId: ctx.selectedId, scanType: "reading", description: "Reading selection..." },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    return {
      element: selectedElement,
      parent: parent ? { id: parent.id, type: parent.type, name: parent.name } : null,
    };
  },

  getParentSection: async (params, ctx) => {
    const { elementId } = params;
    const targetId = elementId || ctx.selectedId;

    if (!targetId) {
      return { error: "No element specified or selected" };
    }

    // Trigger scanning animation on the element
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId: targetId, scanType: "analyzing", description: "Finding parent section..." },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    const section = findParentSection(targetId, ctx.elements);

    // If section found, also scan the section
    if (section && section.id !== targetId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId: section.id, scanType: "reading", description: "Reading section..." },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    return { section };
  },

  // === VISUAL FEEDBACK TOOLS ===

  verifyElement: async (params, ctx) => {
    const { elementId, includeScreenshot } = params;
    const element = findElementById(elementId, ctx.elements);

    if (!element) {
      return { exists: false };
    }

    // Trigger verify scanning animation
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId, scanType: "verifying", description: "Verifying element..." },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    let screenshot = null;
    if (includeScreenshot && typeof document !== "undefined") {
      try {
        let domElement = document.getElementById(elementId);
        if (!domElement) {
          domElement = document.querySelector(`[data-element-id="${elementId}"]`);
        }
        if (domElement) {
          const canvas = await html2canvas(domElement as HTMLElement, {
            scale: 1.5,
            backgroundColor: null,
            useCORS: true,
            logging: false,
            allowTaint: true,
            foreignObjectRendering: false,
            onclone: (clonedDoc, clonedElement) => {
              clonedElement.classList.remove("mcp-scanning");
              const resolveStyles = (el: Element) => {
                const computed = window.getComputedStyle(el);
                const htmlEl = el as HTMLElement;
                const color = computed.color;
                const bgColor = computed.backgroundColor;
                const borderColor = computed.borderColor;
                if (color && color !== "rgba(0, 0, 0, 0)") {
                  htmlEl.style.setProperty("color", color, "important");
                }
                if (bgColor && bgColor !== "rgba(0, 0, 0, 0)") {
                  htmlEl.style.setProperty("background-color", bgColor, "important");
                }
                if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") {
                  htmlEl.style.borderColor = borderColor;
                }
                if (computed.textShadow && computed.textShadow !== "none") {
                  htmlEl.style.textShadow = computed.textShadow;
                }
                Array.from(el.children).forEach(resolveStyles);
              };
              resolveStyles(clonedElement);
            },
          });
          screenshot = canvas.toDataURL("image/png").split(",")[1];

          // Dispatch screenshot complete event
          window.dispatchEvent(
            new CustomEvent("mcp-screenshot-complete", {
              detail: { elementId, imageData: screenshot },
            })
          );
        }
      } catch (e) {
        console.warn("[MCP] Screenshot failed during verify:", e);
      }
    }

    showToast(`Element ${elementId} verified`, "success");
    return { exists: true, element, screenshot };
  },

  screenshotElement: async (params, ctx) => {
    const { elementId, scale } = params;

    if (typeof document === "undefined") {
      return { error: "Screenshot not available in server context" };
    }

    try {
      let domElement = document.getElementById(elementId);
      if (!domElement) {
        domElement = document.querySelector(`[data-element-id="${elementId}"]`);
      }

      if (!domElement) {
        return { error: `Element ${elementId} not found in DOM` };
      }

      // Take screenshot with CSS variable resolution
      const canvas = await html2canvas(domElement as HTMLElement, {
        scale: scale || 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        allowTaint: true,
        foreignObjectRendering: false,
        onclone: (clonedDoc, clonedElement) => {
          clonedElement.classList.remove("mcp-scanning");
          const resolveStyles = (el: Element) => {
            const computed = window.getComputedStyle(el);
            const htmlEl = el as HTMLElement;
            const color = computed.color;
            const bgColor = computed.backgroundColor;
            const borderColor = computed.borderColor;
            if (color && color !== "rgba(0, 0, 0, 0)") {
              htmlEl.style.setProperty("color", color, "important");
            }
            if (bgColor && bgColor !== "rgba(0, 0, 0, 0)") {
              htmlEl.style.setProperty("background-color", bgColor, "important");
            }
            if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") {
              htmlEl.style.borderColor = borderColor;
            }
            if (computed.textShadow && computed.textShadow !== "none") {
              htmlEl.style.textShadow = computed.textShadow;
            }
            Array.from(el.children).forEach(resolveStyles);
          };
          resolveStyles(clonedElement);
        },
      });

      const imageData = canvas.toDataURL("image/png").split(",")[1];

      // Dispatch visual feedback events
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mcp-screenshot-start", { detail: { elementId } })
        );
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("mcp-screenshot-complete", {
              detail: { elementId, imageData },
            })
          );
        }, 1200);
      }

      showToast(`Screenshot captured!`, "success");
      return { imageData };
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mcp-screenshot-complete", {
            detail: { elementId, error: error.message },
          })
        );
      }
      showToast(`Screenshot failed`, "error");
      return { error: error.message };
    }
  },

  aiActivityStart: async (params, ctx) => {
    const { elementId, activityType, description, placeholderId } = params;

    if (ctx.addActivity) {
      ctx.addActivity({
        elementId: elementId || null,
        placeholderId,
        activityType,
        description,
        startTime: Date.now(),
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-ai-activity", {
          detail: { type: activityType, elementId: elementId || placeholderId, description },
        })
      );
    }

    showToast(`AI ${activityType}...`, "info");
    return { success: true, message: "AI activity started" };
  },

  aiActivityEnd: async (params, ctx) => {
    const { elementId, placeholderId, success } = params;

    if (ctx.removeActivity) {
      ctx.removeActivity(elementId || placeholderId);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-ai-activity", {
          detail: { type: success ? "completed" : "failed", elementId: elementId || placeholderId },
        })
      );
    }

    if (success) {
      showToast(`AI completed!`, "success");
    }
    return { success: true, message: "AI activity ended" };
  },

  // === AI-POWERED TOOLS (require aiService) ===

  editElementById: async (params, ctx) => {
    const { id, instruction, updatedElement, preserveChildren = true } = params;

    const el = findElementById(id, ctx.elements);
    if (!el) {
      return { success: false, error: `Element with ID ${id} not found.` };
    }

    // Scroll to element in browser
    if (typeof document !== "undefined") {
      const domEl = document.getElementById(id);
      if (domEl) domEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // ===== DIRECT MODE: Apply updatedElement JSON directly (no AI needed) =====
    if (updatedElement && typeof updatedElement === "object") {
      // Start scanning animation
      emitElementActivity(id, "start", "Updating element...");

      if (ctx.onStreamChunk) {
        ctx.onStreamChunk({
          type: "start",
          tool: "editElementById",
          message: `Updating ${el.name || id}...`,
        });
      }

      try {
        // Post-process icons in the updated element
        const processed = updatedElement.children
          ? { ...updatedElement, children: postProcessIconsInElements(updatedElement.children) }
          : updatedElement;

        // Merge: preserve original ID, apply progressive children update
        let mergedEl = { ...el, ...processed, id: el.id };

        // Progressive rendering for sections with children
        if (mergedEl.children && mergedEl.children.length > 0 && el.type === "section") {
          // First update the section shell (style, name, etc) without children
          const { children: newChildren, ...shellProps } = mergedEl;
          ctx.updateElement(id, { ...el, ...shellProps, id: el.id, children: el.children || [] });
          await new Promise((r) => setTimeout(r, 100));

          // Then progressively add/update children for streaming effect
          for (let i = 0; i < newChildren.length; i++) {
            const partialChildren = newChildren.slice(0, i + 1);
            // Pad remaining children from original to avoid losing them during animation
            const remaining = (el.children || []).slice(i + 1);
            ctx.updateElement(id, { ...shellProps, id: el.id, children: [...partialChildren, ...remaining] });
            await new Promise((r) => setTimeout(r, 80));
          }
          // Final full update
          ctx.updateElement(id, mergedEl);
        } else {
          // Simple update for non-section elements
          ctx.updateElement(id, mergedEl);
        }

        // Complete animation
        await new Promise((r) => setTimeout(r, 200));
        emitElementActivity(id, "complete");

        if (ctx.onStreamChunk) {
          ctx.onStreamChunk({
            type: "complete",
            tool: "editElementById",
            message: `Updated ${el.name || id}`,
          });
        }

        showToast(`Element updated in-place!`, "success");

        return {
          success: true,
          message: `Element '${el.name || id}' updated in-place (direct mode).`,
          mode: "direct",
        };
      } catch (e) {
        console.error("Direct edit failed:", e);
        emitElementActivity(id, "complete");
        if (ctx.onStreamChunk) {
          ctx.onStreamChunk({ type: "error", tool: "editElementById", message: `Failed to update ${el.name || id}` });
        }
        return { success: false, error: `Direct edit failed: ${e}` };
      }
    }

    // ===== AI MODE: Use instruction with browser AI service =====
    if (!instruction) {
      return { success: false, error: "Either 'instruction' or 'updatedElement' is required." };
    }

    if (!ctx.aiService) {
      return { success: false, error: "AI service not available. Use 'updatedElement' param to provide the element JSON directly." };
    }

    // Determine if this instruction changes children structure
    const changesChildren = instructionChangesChildren(instruction);
    const shouldPreserveChildren = preserveChildren && el.children && !changesChildren;

    // Emit element activity start for visual feedback
    emitElementActivity(id, "start", `AI editing: ${instruction.slice(0, 50)}...`);

    // Notify stream listeners
    if (ctx.onStreamChunk) {
      ctx.onStreamChunk({
        type: "start",
        tool: "editElementById",
        message: `Updating ${el.name || id}...`,
      });
    }

    try {
      if (ctx.aiService.editComponentStream && ctx.aiService.smartParsePartialJson) {
        const stream = await ctx.aiService.editComponentStream(el, instruction);
        let accumulatedJson = "";
        let lastValidData: any = null;

        for await (const chunk of stream) {
          accumulatedJson += chunk;
          const partialData = ctx.aiService.smartParsePartialJson(accumulatedJson, false);
          if (partialData && partialData.type) {
            lastValidData = partialData;
            // Apply smart merge during streaming
            let mergedEl = { ...el, ...partialData, id: el.id };
            if (shouldPreserveChildren && partialData.children) {
              mergedEl.children = smartMergeChildren(el.children!, partialData.children);
            }
            ctx.updateElement(id, mergedEl);
          }
        }

        // Emit element activity complete
        emitElementActivity(id, "complete");

        // Notify stream listeners
        if (ctx.onStreamChunk) {
          ctx.onStreamChunk({
            type: "complete",
            tool: "editElementById",
            message: `Updated ${el.name || id}`,
          });
        }

        showToast(`Element updated in-place!`, "success");

        // Auto screenshot & verify after streaming edit
        const verifyTarget = el.type === "section" ? id : (findParentSection(id, ctx.elements)?.id || id);
        const streamVerify = await autoScreenshotAndVerify(verifyTarget, ctx);

        return { success: true, message: "Element updated in-place (Streamed).", preserved: shouldPreserveChildren, verification: { screenshot: !!streamVerify.screenshot, issues: streamVerify.issues.length, fixed: streamVerify.fixed } };
      } else if (ctx.aiService.editComponent) {
        const updatedEl = await ctx.aiService.editComponent(el, instruction);
        if (updatedEl) {
          // SMART MERGE: Preserve original children if not explicitly changed
          let mergedEl = { ...updatedEl, id: el.id };

          if (shouldPreserveChildren && updatedEl.children) {
            mergedEl.children = smartMergeChildren(el.children!, updatedEl.children);
          }

          ctx.updateElement(id, mergedEl);

          // Emit element activity complete
          emitElementActivity(id, "complete");

          // Notify stream listeners
          if (ctx.onStreamChunk) {
            ctx.onStreamChunk({
              type: "complete",
              tool: "editElementById",
              message: `Updated ${el.name || id}`,
            });
          }

          showToast(`Element updated in-place!`, "success");

          // Auto screenshot & verify after edit
          const editVerifyTarget = el.type === "section" ? id : (findParentSection(id, ctx.elements)?.id || id);
          const editVerify = await autoScreenshotAndVerify(editVerifyTarget, ctx);

          return { success: true, message: "Element updated in-place.", preserved: shouldPreserveChildren, verification: { screenshot: !!editVerify.screenshot, issues: editVerify.issues.length, fixed: editVerify.fixed } };
        }
      }
    } catch (e) {
      console.error("AI edit failed:", e);
      // Emit element activity complete even on error
      emitElementActivity(id, "complete");

      if (ctx.onStreamChunk) {
        ctx.onStreamChunk({
          type: "error",
          tool: "editElementById",
          message: `Failed to update ${el.name || id}`,
        });
      }

      return { success: false, error: "Failed to update element via AI." };
    }

    // Emit element activity complete for fallback
    emitElementActivity(id, "complete");
    return { success: false, error: "Failed to update element." };
  },

  editElement: async (params, ctx) => {
    const { instruction } = params;

    if (!ctx.selectedId) {
      return { success: false, error: "No element selected. Ask user to select an element first." };
    }

    // Delegate to editElementById
    return TOOL_EXECUTORS.editElementById({ id: ctx.selectedId, instruction }, ctx);
  },

  updateLayout: async (params, ctx) => {
    const { instruction } = params;

    if (!ctx.aiService?.optimizeLayout) {
      return { success: false, error: "AI service not available for layout optimization" };
    }

    // Dispatch scanning start event for visual feedback
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: {
            elementId: "layout-optimization",
            scanType: "generating",
            description: `AI optimizing layout: ${instruction.slice(0, 50)}...`,
          },
        })
      );
    }

    try {
      const currentJson = JSON.stringify(ctx.elements);
      const newLayout = await ctx.aiService.optimizeLayout(currentJson, instruction);
      if (newLayout) {
        ctx.setElements(newLayout);

        // Dispatch scanning complete event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
        }

        showToast(`Layout optimized!`, "success");
        return { success: true, message: "Layout updated successfully." };
      }
    } catch (e) {
      console.error("Layout optimization failed:", e);
      // Dispatch scanning complete even on error
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
      return { success: false, error: "Failed to optimize layout." };
    }

    // Dispatch scanning complete for fallback
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }
    return { success: false, error: "Failed to update layout." };
  },

  generateLandingPage: async (params, ctx) => {
    const { content, color, style, industry, streaming = true, autoVerify = true } = params;

    if (!ctx.aiService?.generateLandingPageWithTheme) {
      return { success: false, error: "AI service not available for page generation" };
    }

    // ===== SELF-THINKING PHASE =====
    // Generate intelligent layout instructions based on content analysis
    const { instructions, strategy } = generateLayoutInstructions(content, industry, style);

    // Design style modifiers for variety
    const styleModifiers: Record<string, string> = {
      "modern-minimal": "STYLE: Clean, minimal design with lots of whitespace. Subtle shadows, thin borders. Muted colors with one accent. Simple typography with generous line-height.",
      "bold-energetic": "STYLE: High contrast, vibrant colors. Bold typography, dynamic angles. Strong CTA buttons. Energetic, action-oriented copy.",
      "luxury-premium": "STYLE: Elegant, refined aesthetic. Serif fonts for headlines, sophisticated color palette. Premium imagery. Exclusive, aspirational tone.",
      "playful-fun": "STYLE: Bright, cheerful colors. Rounded corners, friendly icons. Casual, conversational copy. Fun micro-interactions.",
      "corporate-professional": "STYLE: Trust-building design. Clear hierarchy, professional imagery. Statistics and credentials. Formal but approachable tone.",
      "creative-artistic": "STYLE: Unique, expressive layout. Asymmetric grids, creative typography. Bold visual statements. Unconventional but intuitive.",
    };

    // Build enhanced content with CONCRETE layout instructions
    let enhancedContent = content;

    // Add the concrete layout specifications
    enhancedContent += instructions;

    // Add style modifier if provided
    if (style && styleModifiers[style]) {
      enhancedContent += `\n\n${styleModifiers[style]}`;
    }

    const themeColor = color || "blue";

    // Dispatch activity start event for UI feedback
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: {
            elementId: "page-generation",
            scanType: "generating",
            description: `Generating ${strategy.heroStyle} hero + ${strategy.featuresLayout} features (${strategy.framework} framework)...`,
          },
        })
      );
    }

    // Notify stream start
    if (ctx.onStreamChunk) {
      ctx.onStreamChunk({
        type: "start",
        tool: "generateLandingPage",
        message: `Starting generation with ${strategy.heroStyle} hero...`,
      });
    }

    try {
      // ===== STREAMING MODE =====
      // Use streaming for real-time updates if available
      if (streaming && ctx.aiService.generateLandingPageWithThemeStream && ctx.aiService.smartParsePartialJson) {
        const stream = ctx.aiService.generateLandingPageWithThemeStream(enhancedContent, themeColor);
        let accumulatedJson = "";
        let lastPartialElements: any[] = [];
        let chunkCount = 0;

        for await (const chunk of stream) {
          accumulatedJson += chunk;
          chunkCount++;

          // Try to parse partial JSON for real-time updates
          try {
            const partialData = ctx.aiService.smartParsePartialJson(accumulatedJson, false);
            if (partialData && partialData.elements && Array.isArray(partialData.elements)) {
              // Only update if we have new elements
              if (partialData.elements.length > lastPartialElements.length) {
                const processedElements = postProcessIconsInElements(partialData.elements);
                ctx.setElements(processedElements);
                lastPartialElements = partialData.elements;

                // Notify stream progress
                if (ctx.onStreamChunk) {
                  ctx.onStreamChunk({
                    type: "partial",
                    tool: "generateLandingPage",
                    data: { elementsCount: processedElements.length },
                    progress: Math.min(90, (processedElements.length / 6) * 100), // Assume ~6 sections
                    message: `Building section ${processedElements.length}...`,
                  });
                }

                // Dispatch streaming update event for UI
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("mcp-stream-update", {
                      detail: {
                        type: "partial",
                        elementsCount: processedElements.length,
                        progress: Math.min(90, (processedElements.length / 6) * 100),
                      },
                    })
                  );
                }
              }
            }
          } catch {
            // Partial JSON not yet parseable, continue accumulating
          }

          // Send chunk update periodically
          if (chunkCount % 10 === 0 && ctx.onStreamChunk) {
            ctx.onStreamChunk({
              type: "chunk",
              tool: "generateLandingPage",
              message: "Generating...",
            });
          }
        }

        // Parse final result
        try {
          const result = JSON.parse(accumulatedJson);
          if (result && result.elements) {
            const processedElements = postProcessIconsInElements(result.elements);
            ctx.setElements(processedElements);

            if (result.themeColor) {
              const scheme = generateSchemeFromBaseColor(
                result.themeColor,
                result.themeName || "Generated Theme",
                "theme-ai-generated"
              );
              if (scheme) ctx.addScheme(scheme, true);
            }

            // Notify stream complete
            if (ctx.onStreamChunk) {
              ctx.onStreamChunk({
                type: "complete",
                tool: "generateLandingPage",
                data: { elementsCount: processedElements.length, themeColor: result.themeColor },
                progress: 100,
                message: "Landing page generated!",
              });
            }

            // Dispatch completion event
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
            }

            showToast(`Landing page generated with ${strategy.heroStyle} hero!`, "success");

            // ===== AUTO SCREENSHOT & VERIFY ALL SECTIONS =====
            let verificationReport = { sectionsVerified: 0, totalIssues: 0, totalFixed: 0, screenshots: 0 };
            if (autoVerify) {
              const verifyResults = await autoVerifyAllSections(ctx);
              verificationReport = {
                sectionsVerified: verifyResults.sectionResults.length,
                totalIssues: verifyResults.totalIssues,
                totalFixed: verifyResults.totalFixed,
                screenshots: verifyResults.sectionResults.filter(r => r.screenshot).length,
              };
            }

            return {
              success: true,
              message: `Generated unique landing page #${strategy.uniqueId} (streamed)`,
              designStrategy: {
                framework: strategy.framework,
                industry: strategy.industry,
                heroStyle: strategy.heroStyle,
                featuresLayout: strategy.featuresLayout,
                ctaStyle: strategy.ctaStyle,
                socialProofStyle: strategy.socialProofStyle,
                sectionOrder: strategy.sectionOrder,
              },
              themeColor: result.themeColor,
              streaming: true,
              verification: verificationReport,
              tip: "Each generation creates a unique layout combination. Run again for a different design.",
            };
          }
        } catch (parseError) {
          console.error("Failed to parse streaming result:", parseError);
          // Fall through to non-streaming fallback
        }
      }

      // ===== NON-STREAMING FALLBACK =====
      const result = await ctx.aiService.generateLandingPageWithTheme(enhancedContent, themeColor);

      if (result && result.elements) {
        // Post-process elements for icon auto-mapping
        const processedElements = postProcessIconsInElements(result.elements);
        ctx.setElements(processedElements);
        const scheme = generateSchemeFromBaseColor(
          result.themeColor,
          result.themeName,
          "theme-ai-generated"
        );
        if (scheme) ctx.addScheme(scheme, true);

        // Notify stream complete
        if (ctx.onStreamChunk) {
          ctx.onStreamChunk({
            type: "complete",
            tool: "generateLandingPage",
            data: { elementsCount: processedElements.length, themeColor: result.themeColor },
            progress: 100,
            message: "Landing page generated!",
          });
        }

        // Dispatch completion event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
        }

        showToast(`Landing page generated with ${strategy.heroStyle} hero!`, "success");

        // ===== AUTO SCREENSHOT & VERIFY ALL SECTIONS =====
        let nonStreamVerification = { sectionsVerified: 0, totalIssues: 0, totalFixed: 0, screenshots: 0 };
        if (autoVerify) {
          const verifyResults = await autoVerifyAllSections(ctx);
          nonStreamVerification = {
            sectionsVerified: verifyResults.sectionResults.length,
            totalIssues: verifyResults.totalIssues,
            totalFixed: verifyResults.totalFixed,
            screenshots: verifyResults.sectionResults.filter(r => r.screenshot).length,
          };
        }

        return {
          success: true,
          message: `Generated unique landing page #${strategy.uniqueId}`,
          designStrategy: {
            framework: strategy.framework,
            industry: strategy.industry,
            heroStyle: strategy.heroStyle,
            featuresLayout: strategy.featuresLayout,
            ctaStyle: strategy.ctaStyle,
            socialProofStyle: strategy.socialProofStyle,
            sectionOrder: strategy.sectionOrder,
          },
          themeColor: result.themeColor,
          verification: nonStreamVerification,
          tip: "Each generation creates a unique layout combination. Run again for a different design.",
        };
      }
    } catch (e) {
      console.error("Page generation failed:", e);

      // Notify stream error
      if (ctx.onStreamChunk) {
        ctx.onStreamChunk({
          type: "error",
          tool: "generateLandingPage",
          message: e instanceof Error ? e.message : "Page generation failed",
        });
      }

      // Dispatch completion event even on error
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
      showToast(`AI Error: ${e instanceof Error ? e.message : "Page generation failed"}`, "error");
      return { success: false, error: e instanceof Error ? e.message : "Failed to generate landing page." };
    }

    // Dispatch completion for fallback case
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }
    return { success: false, error: "Failed to generate landing page." };
  },

  // Create design strategy for explicit two-step workflow
  createDesignStrategy: async (params, ctx) => {
    const { content, industry: userIndustry } = params;

    if (!content) {
      return { success: false, error: "Content is required to create a design strategy" };
    }

    // Generate the strategy
    const { strategy } = generateLayoutInstructions(content, userIndustry);

    return {
      success: true,
      message: `Design strategy created: ${strategy.framework} framework with ${strategy.heroStyle} hero`,
      strategy,
      instructions: [
        `Framework: ${strategy.framework} (${strategy.industry} industry)`,
        `Hero Style: ${strategy.heroStyle}`,
        `Features Layout: ${strategy.featuresLayout}`,
        `Social Proof: ${strategy.socialProofStyle}`,
        `CTA Style: ${strategy.ctaStyle}`,
        `Section Order: ${strategy.sectionOrder.join(" → ")}`,
      ],
      nextStep: "Now call generateLandingPage with this content. The layout instructions are automatically applied.",
    };
  },

  updateCopy: async (params, ctx) => {
    const { prompt, context } = params;

    if (!ctx.aiService?.generateCopy) {
      return { success: false, error: "AI service not available for copy generation" };
    }

    // Dispatch scanning start event for visual feedback
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: {
            elementId: ctx.selectedId || "copy-generation",
            scanType: "generating",
            description: `AI generating copy: ${prompt.slice(0, 50)}...`,
          },
        })
      );
    }

    try {
      const copy = await ctx.aiService.generateCopy(prompt, context);
      if (ctx.selectedId) {
        ctx.updateElement(ctx.selectedId, { content: copy });

        // Dispatch scanning complete event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
        }

        showToast(`Copy updated!`, "success");
        return { success: true, message: `Updated selected element with copy: "${copy}"` };
      }

      // Dispatch scanning complete event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }

      return { success: true, copy, message: `Generated Copy: "${copy}"` };
    } catch (e) {
      console.error("Copy generation failed:", e);
      // Dispatch scanning complete even on error
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
      return { success: false, error: "Failed to generate copy." };
    }
  },

  think: async (params, ctx) => {
    const { thought } = params;

    if (ctx.addThinkingStep) {
      ctx.addThinkingStep({
        id: Date.now().toString(),
        label: "Reasoning",
        status: "completed" as const,
        details: thought,
      });
    }

    return {
      success: true,
      message: "Thought recorded. Now proceed with your plan.",
      nextSteps: [
        "Call getDesignGuidelines() if you need design patterns",
        "Call getDesignSystem() to get current theme colors",
        "Call getCapabilities() to see available components",
        "Execute your plan step by step",
        "STOP when done - do NOT verify or screenshot (causes loops that make designs worse)"
      ],
    };
  },

  // ===== DESIGN KNOWLEDGE TOOLS =====
  // These tools expose design guidelines to Claude for intelligent design decisions

  getDesignGuidelines: async () => {
    return {
      success: true,
      guidelines: DESIGN_GUIDELINES,
      schemaDefinition: SCHEMA_DEF,
      contentGuidelines: CONTENT_GUIDELINES,
      iconGuidelines: ICON_GUIDELINES,
      quickReference: {
        atomicDesign: "section > wrapper > row > col (ALWAYS use this structure)",
        uniqueIdRule: "EVERY element MUST have a unique 'id' field - NO EXCEPTIONS. Use kebab-case: 'hero-section', 'feature-card-1', 'cta-btn'",
        cssVariables: [
          "var(--color-primary) - main brand/CTA color",
          "var(--color-background) - section backgrounds",
          "var(--color-foreground) - text color",
          "var(--color-foreground-heading) - heading text",
          "var(--color-border) - borders and dividers",
        ],
        mandatorySections: [
          "Hero Section - headline, CTA, visual",
          "Features/Benefits - grid layout with icons",
          "Social Proof - testimonials or trust badges",
          "CTA Section - final call-to-action",
        ],
        customComponentsRule: "AVOID custom components for simple grids. Build atomically with row/col instead. Only use custom components (carousel, countdown, circle) for complex interactivity.",
        iconRule: "NEVER use emojis. Use 'icon' elements with Lucide names matching content meaning (Truck for delivery, Shield for security, Zap for speed).",
        namingRule: "Name elements descriptively: 'Hero Section', 'Features Grid', 'CTA Button' - never generic names",
      },
      tips: [
        "CRITICAL: Every element MUST have a unique 'id' field (e.g., 'hero-section', 'feature-icon-1')",
        "Use atomic design: section > wrapper > row > col",
        "Use CSS variables like var(--color-primary) for theme colors",
        "Avoid custom components for simple grids - build atomically",
        "Name elements descriptively",
        "No emojis - use Lucide icons via 'icon' elements",
        "Alternate section backgrounds for visual rhythm",
        "Use generous padding (min 80px top/bottom on sections)",
      ],
      condensedGuidelines: {
        typography: {
          heroHeadline: "48-72px, fontWeight 700-800, lineHeight 1.1-1.2, letterSpacing -0.02em",
          sectionTitle: "32-40px, fontWeight 600-700, lineHeight 1.2-1.3",
          bodyText: "16-18px, fontWeight 400, lineHeight 1.6-1.7",
          subtleText: "14-15px, color var(--color-foreground-muted)",
        },
        spacing: {
          sectionPadding: "80-120px vertical, never less than 60px",
          contentMaxWidth: "1200px (1400px for hero)",
          cardGap: "24-32px",
          elementGap: "16-24px",
        },
        visualEffects: {
          cardShadow: "0 4px 20px rgba(0,0,0,0.06) or 0 20px 40px rgba(0,0,0,0.08)",
          buttonRadius: "8-12px",
          cardRadius: "12-20px",
          imageRadius: "16-24px",
          gradient: "linear-gradient(135deg, color1, color2)",
        },
        colorRules: {
          rule: "60-30-10: 60% background, 30% secondary, 10% accent",
          cta: "var(--color-primary-button-background) with var(--color-primary-button-text)",
          alternating: "Alternate section backgrounds: white, subtle gray, gradient, dark",
        },
      },
      jsonExamples: {
        heroSection: {
          description: "Well-structured hero section with proper atomic design",
          json: {
            id: "hero-section", type: "section", name: "Hero Section",
            style: { width: "100%", padding: "80px 20px", backgroundColor: "var(--color-background)" },
            children: [{
              id: "hero-wrapper", type: "wrapper", name: "Hero Wrapper",
              style: { maxWidth: "1200px", margin: "0 auto", padding: "0 20px" },
              children: [{
                id: "hero-row", type: "row", name: "Hero Row",
                style: { display: "flex", flexWrap: "wrap", gap: "40px", alignItems: "center" },
                children: [
                  {
                    id: "hero-content-col", type: "col", name: "Content Column",
                    style: { flex: "1 1 55%", minWidth: "300px" },
                    children: [
                      { id: "hero-headline", type: "headline", name: "Main Headline", content: "Transform Your Business Today", style: { fontSize: "48px", fontWeight: "700", lineHeight: "1.1", color: "var(--color-foreground-heading)", letterSpacing: "-0.02em" } },
                      { id: "hero-desc", type: "paragraph", name: "Hero Description", content: "Join thousands of companies saving time and growing faster.", style: { fontSize: "18px", lineHeight: "1.6", color: "var(--color-foreground-muted)", marginTop: "16px", maxWidth: "500px" } },
                      { id: "hero-cta", type: "button", name: "CTA Button", content: "Start Free Trial", style: { marginTop: "24px", padding: "14px 32px", fontSize: "16px", fontWeight: "600", backgroundColor: "var(--color-primary-button-background)", color: "var(--color-primary-button-text)", borderRadius: "10px", border: "none" } }
                    ]
                  },
                  {
                    id: "hero-image-col", type: "col", name: "Image Column",
                    style: { flex: "1 1 40%", minWidth: "280px" },
                    children: [
                      { id: "hero-img", type: "image", name: "Hero Image", src: "https://placehold.co/600x400", style: { width: "100%", borderRadius: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.1)" } }
                    ]
                  }
                ]
              }]
            }]
          }
        },
        featureCard: {
          description: "Feature card with icon, title, and description",
          json: {
            id: "feature-card-1", type: "wrapper", name: "Feature Card",
            style: { padding: "32px", backgroundColor: "var(--color-input-background)", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", textAlign: "center" },
            children: [
              { id: "feature-icon-1", type: "icon", name: "Feature Icon", content: "Zap", style: { color: "var(--color-primary)", width: "32px", height: "32px", marginBottom: "16px" } },
              { id: "feature-title-1", type: "headline", name: "Feature Title", content: "Lightning Fast", style: { fontSize: "20px", fontWeight: "600", color: "var(--color-foreground-heading)", marginBottom: "8px" } },
              { id: "feature-desc-1", type: "paragraph", name: "Feature Description", content: "Experience blazing fast performance.", style: { fontSize: "15px", lineHeight: "1.6", color: "var(--color-foreground-muted)" } }
            ]
          }
        },
      },
    };
  },

  getAgentInstructions: async () => {
    return {
      success: true,
      workflow: {
        step1: "THINK: Use the 'think' tool to plan your approach - break down the request, consider which tools you need",
        step2: "LEARN: Call 'getDesignGuidelines' to understand design patterns and best practices",
        step3: "CONTEXT: Call 'getDesignSystem' to get current theme colors and CSS variables",
        step4: "EXPLORE: Call 'getCapabilities' to see available element types and components",
        step5: "PLAN: Use 'planDesign' to create a structured implementation plan",
        step6: "EXECUTE: Implement the design using 'generatePage' or 'setElements' with atomic structure",
        step7: "STOP: Task complete! Do NOT verify or screenshot automatically.",
      },
      criticalRules: [
        "UNIQUE IDs: EVERY element MUST have a unique 'id' field - NO EXCEPTIONS. Format: 'hero-section', 'feature-card-1', 'cta-btn'. Missing IDs break the editor!",
        "ATOMIC DESIGN: Always use section > wrapper > row > col structure",
        "CSS VARIABLES: Use var(--color-primary), var(--color-background), etc. for theme colors",
        "NO EMOJIS: Never use emojis - use 'icon' elements with Lucide names",
        "ICON MATCHING: Match icons to content meaning (Truck=delivery, Shield=security, Zap=speed)",
        "DESCRIPTIVE NAMES: Name elements like 'Hero Section', 'Features Grid', not 'Element 1'",
        "SIMPLE GRIDS: Avoid custom components for feature grids - build atomically with row/col",
        "CUSTOM COMPONENTS: Only use carousel (sliders), countdown (timers), circle (diagrams) for complex features",
        "⚠️ NO AUTO-VERIFY: Do NOT take screenshots or verify unless user explicitly asks. Verification loops make designs worse!",
        "⚠️ ONE AND DONE: Complete task once and STOP. Do not iterate or 'improve' without user request.",
      ],
      exampleWorkflow: `
1. User says: "Create a landing page for a fitness app"
2. You call: think({ thought: "I need to create a fitness landing page. I'll get design guidelines first, then plan sections, then generate." })
3. You call: getDesignGuidelines() → Learn atomic design patterns
4. You call: getDesignSystem() → Get current theme colors
5. You call: planDesign({ request: "fitness app landing page" }) → Get section recommendations
6. You call: generatePage({ elements: [...], themeColor: "#FF6B35" }) → Create the page
7. DONE! Tell user the page is ready. Do NOT take screenshots or verify automatically.
      `,
      importantNote: "Verification loops (screenshot → improve → screenshot → improve) make designs WORSE. Only verify if user explicitly asks.",
    };
  },

  planDesign: async (params, ctx) => {
    const { request, currentTheme } = params;
    const currentScheme = ctx.schemes?.[ctx.currentSchemeId];

    // Use the SAME intelligence as generateLandingPage
    const industry = detectIndustry(request);
    const framework = getFramework(industry);
    const sectionOrder = getSectionOrder(framework);
    const { strategy } = generateLayoutInstructions(request, industry);

    // Map section names to concrete recommendations with layout details
    const recommendedSections = sectionOrder.map((sectionName) => {
      const lower = sectionName.toLowerCase();
      if (lower.includes("hero") || lower.includes("problem") || lower.includes("promise")) {
        return {
          name: sectionName,
          type: "section",
          layout: strategy.heroStyle,
          template: HERO_TEMPLATES[strategy.heroStyle]?.slice(0, 200) || "Split hero layout",
          purpose: "Capture attention with bold headline, value proposition, and CTA",
          elements: ["headline (48-64px)", "paragraph (18px)", "button (CTA)", "image or video"],
          structure: "section > wrapper > row > col",
        };
      }
      if (lower.includes("feature") || lower.includes("benefit") || lower.includes("how") || lower.includes("pain") || lower.includes("solution") || lower.includes("transformation")) {
        return {
          name: sectionName,
          type: "section",
          layout: strategy.featuresLayout,
          template: FEATURES_TEMPLATES[strategy.featuresLayout]?.slice(0, 200) || "Icon grid layout",
          purpose: "Showcase key benefits, features, or process steps",
          elements: ["icon (Lucide)", "headline (20-24px)", "paragraph (15-16px)"],
          structure: "section > wrapper > row > col (3-4 columns)",
        };
      }
      if (lower.includes("testimonial") || lower.includes("proof") || lower.includes("logo") || lower.includes("result") || lower.includes("about")) {
        return {
          name: sectionName,
          type: "section",
          layout: strategy.socialProofStyle,
          template: SOCIAL_PROOF_TEMPLATES[strategy.socialProofStyle]?.slice(0, 200) || "Testimonial grid",
          purpose: "Build trust through social proof, testimonials, or results",
          elements: ["paragraph (quote)", "headline (author name)", "image (avatar)"],
          structure: "section > wrapper > row > col",
        };
      }
      // CTA / urgency / guarantee
      return {
        name: sectionName,
        type: "section",
        layout: strategy.ctaStyle,
        template: CTA_TEMPLATES[strategy.ctaStyle]?.slice(0, 200) || "Minimal CTA",
        purpose: "Drive final conversion with compelling call-to-action",
        elements: ["headline (32-40px)", "paragraph", "button (prominent CTA)"],
        structure: "section > wrapper (centered, maxWidth 700px)",
      };
    });

    return {
      success: true,
      plan: {
        analysis: `Detected industry: ${industry}. Using ${framework} psychology framework with ${strategy.heroStyle} hero + ${strategy.featuresLayout} features.`,
        framework,
        industry,
        sectionOrder,
        designStrategy: strategy,
        recommendedSections,
        styleGuidelines: {
          uniqueIds: "EVERY element MUST have a unique 'id' field (kebab-case: 'hero-section', 'feature-card-1')",
          structure: "Use atomic design: section > wrapper > row > col",
          colors: currentScheme
            ? `Use current theme: var(--color-primary) for CTAs, var(--color-background) for sections`
            : "Set a theme color that matches the brand/purpose",
          spacing: "Sections: 80-120px padding. Cards: 24-32px gap. Content: 16-24px gap.",
          typography: "Hero: 48-64px bold. Section titles: 32-40px. Body: 16-18px, lineHeight 1.6.",
          visualDepth: "Cards: box-shadow 0 4px 20px rgba(0,0,0,0.06). Buttons: borderRadius 8-12px. Images: borderRadius 16px.",
        },
        currentTheme: currentScheme
          ? { name: currentScheme.name, primary: currentScheme.settings.primary, useVariables: true }
          : { note: "No theme set - consider using changeTheme() first" },
      },
      nextSteps: [
        "Call generateLandingPage() with the content - layout instructions are automatically applied",
        "Or use setElements() to manually build with the recommended structure",
        "STOP when done - do NOT verify or screenshot (causes loops that make designs worse)",
      ],
    };
  },

  searchIcon: async (params) => {
    const { query, category } = params;
    const searchTerm = query?.toLowerCase() || "";

    // Comprehensive icon database organized by concepts/keywords
    const ICON_DATABASE: Record<string, { icons: string[]; keywords: string[] }> = {
      speed: {
        icons: ["Zap", "Timer", "Gauge", "Rocket", "FastForward", "Clock", "Hourglass", "Activity"],
        keywords: ["fast", "quick", "speed", "performance", "lightning", "instant", "rapid", "swift"],
      },
      security: {
        icons: ["Shield", "ShieldCheck", "ShieldAlert", "Lock", "LockKeyhole", "KeyRound", "Key", "Fingerprint", "ScanFace", "ShieldOff"],
        keywords: ["secure", "security", "safe", "protection", "protect", "privacy", "encrypted", "trust", "guard"],
      },
      analytics: {
        icons: ["BarChart3", "BarChart2", "LineChart", "PieChart", "TrendingUp", "TrendingDown", "Activity", "ChartLine", "ChartBar", "ChartPie", "ChartArea"],
        keywords: ["analytics", "data", "statistics", "metrics", "chart", "graph", "report", "insights", "dashboard", "tracking"],
      },
      design: {
        icons: ["Palette", "Paintbrush", "Brush", "Layers", "Layout", "LayoutGrid", "Sparkles", "Wand2", "PenTool", "Figma", "Framer"],
        keywords: ["design", "creative", "art", "style", "beautiful", "aesthetic", "template", "customize", "visual", "ui"],
      },
      communication: {
        icons: ["MessageCircle", "MessageSquare", "Mail", "Send", "Phone", "PhoneCall", "Video", "Headphones", "Mic", "AtSign", "Inbox"],
        keywords: ["message", "chat", "email", "contact", "call", "support", "talk", "communication", "reach", "connect"],
      },
      navigation: {
        icons: ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ChevronRight", "ChevronLeft", "ExternalLink", "Link", "Navigation", "Compass", "Map"],
        keywords: ["arrow", "direction", "navigate", "go", "next", "previous", "link", "explore", "direction"],
      },
      status: {
        icons: ["CheckCircle", "Check", "CheckCheck", "CircleCheck", "BadgeCheck", "XCircle", "X", "AlertCircle", "AlertTriangle", "Info", "HelpCircle"],
        keywords: ["success", "check", "done", "complete", "verified", "approved", "correct", "error", "warning", "info", "help"],
      },
      media: {
        icons: ["Image", "Camera", "Video", "Film", "Play", "Pause", "Music", "Mic", "Volume2", "Youtube", "Tv"],
        keywords: ["image", "photo", "video", "media", "play", "music", "audio", "camera", "film", "gallery"],
      },
      commerce: {
        icons: ["ShoppingCart", "ShoppingBag", "CreditCard", "DollarSign", "Wallet", "Receipt", "Tag", "Percent", "Gift", "Package", "Truck"],
        keywords: ["buy", "shop", "cart", "price", "money", "payment", "sale", "discount", "order", "delivery", "ecommerce"],
      },
      social: {
        icons: ["Users", "UserPlus", "User", "Heart", "ThumbsUp", "Share2", "Globe", "HeartHandshake", "Award", "Trophy"],
        keywords: ["user", "people", "community", "social", "share", "like", "follow", "team", "group", "network", "friends"],
      },
      technology: {
        icons: ["Cpu", "Server", "Database", "Cloud", "Code", "Terminal", "Smartphone", "Laptop", "Monitor", "Wifi", "Settings"],
        keywords: ["tech", "technology", "code", "software", "hardware", "computer", "server", "cloud", "api", "developer"],
      },
      ai: {
        icons: ["Sparkles", "Brain", "Cpu", "Wand2", "Bot", "Lightbulb", "Zap", "Stars", "Gem", "Rocket"],
        keywords: ["ai", "artificial", "intelligence", "smart", "auto", "magic", "automated", "machine", "learning", "powered"],
      },
      time: {
        icons: ["Clock", "Timer", "Calendar", "CalendarDays", "Hourglass", "Watch", "AlarmClock", "History", "TimerReset"],
        keywords: ["time", "schedule", "date", "calendar", "clock", "deadline", "appointment", "event", "countdown"],
      },
      document: {
        icons: ["FileText", "File", "Files", "Folder", "FolderOpen", "ClipboardList", "BookOpen", "Notebook", "Scroll", "FileCheck"],
        keywords: ["file", "document", "folder", "paper", "text", "report", "pdf", "attachment", "docs"],
      },
      growth: {
        icons: ["TrendingUp", "ArrowUpRight", "ChartLine", "Sprout", "Rocket", "Target", "Goal", "Award", "Medal", "Crown"],
        keywords: ["growth", "increase", "improve", "rise", "success", "progress", "goal", "achieve", "win", "results"],
      },
      features: {
        icons: ["Sparkles", "CheckCircle", "BadgeCheck", "Award", "Zap", "Gem", "Diamond", "Crown", "Flame", "Star"],
        keywords: ["feature", "benefit", "advantage", "highlight", "special", "premium", "pro", "best", "top"],
      },
    };

    // Search across all categories
    const results: { icon: string; category: string; relevance: number }[] = [];

    for (const [cat, data] of Object.entries(ICON_DATABASE)) {
      // Skip if category filter is applied and doesn't match
      if (category && category !== "all" && cat !== category) continue;

      // Check if query matches any keywords
      const keywordMatch = data.keywords.some(kw =>
        kw.includes(searchTerm) || searchTerm.includes(kw)
      );

      // Check if query matches any icon names
      const iconMatches = data.icons.filter(icon =>
        icon.toLowerCase().includes(searchTerm)
      );

      if (keywordMatch) {
        // Add all icons from matching category
        data.icons.forEach(icon => {
          if (!results.find(r => r.icon === icon)) {
            results.push({ icon, category: cat, relevance: 2 });
          }
        });
      }

      // Add direct icon name matches with higher relevance
      iconMatches.forEach(icon => {
        const existing = results.find(r => r.icon === icon);
        if (existing) {
          existing.relevance = 3;
        } else {
          results.push({ icon, category: cat, relevance: 3 });
        }
      });
    }

    // Sort by relevance and limit results
    results.sort((a, b) => b.relevance - a.relevance);
    const topResults = results.slice(0, 10);

    // Common emoji replacements hint
    const emojiReplacements: Record<string, string> = {
      "⚡": "Zap",
      "🚀": "Rocket",
      "✅": "CheckCircle",
      "🎨": "Palette",
      "📊": "BarChart3",
      "⭐": "Star",
      "🔥": "Flame",
      "💡": "Lightbulb",
      "🛡️": "Shield",
      "❤️": "Heart",
      "👥": "Users",
      "📈": "TrendingUp",
      "🎯": "Target",
      "💰": "DollarSign",
    };

    return {
      success: true,
      query: searchTerm,
      results: topResults.map(r => ({
        icon: r.icon,
        category: r.category,
        usage: `{ "type": "icon", "icon": "${r.icon}", "style": { "color": "var(--color-primary)" } }`,
      })),
      totalFound: topResults.length,
      tip: "Use icon names in PascalCase format. NEVER use emojis!",
      emojiReplacements,
      categories: Object.keys(ICON_DATABASE),
    };
  },

  // ===== VERIFICATION TOOLS (USER-REQUEST ONLY) =====
  // ⚠️ WARNING: ONLY use these when user explicitly asks to verify or improve
  // Automatic verification loops make designs WORSE, not better

  evaluateSectionQuality: async (params, ctx) => {
    const { elementId, criteria } = params;

    if (!elementId) {
      return { success: false, error: "elementId is required" };
    }

    const element = findElementById(elementId, ctx.elements);
    if (!element) {
      return { success: false, error: `Element ${elementId} not found` };
    }

    // Trigger scanning animation
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-scan-start", {
          detail: { elementId, scanType: "analyzing", description: "AI evaluating section quality..." },
        })
      );
    }

    // Capture screenshot for visual evaluation
    let screenshot = null;
    if (typeof document !== "undefined") {
      try {
        let domElement = document.getElementById(elementId);
        if (!domElement) {
          domElement = document.querySelector(`[data-element-id="${elementId}"]`);
        }
        if (domElement) {
          const canvas = await html2canvas(domElement as HTMLElement, {
            scale: 1.5,
            backgroundColor: null,
            useCORS: true,
            logging: false,
            allowTaint: true,
            foreignObjectRendering: false,
          });
          screenshot = canvas.toDataURL("image/png").split(",")[1];
        }
      } catch (e) {
        console.error("Screenshot capture failed:", e);
      }
    }

    // Complete scan animation
    if (typeof window !== "undefined") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
    }

    // Quality evaluation criteria
    const evaluationCriteria = criteria || [
      "Visual hierarchy - Is there clear heading, subtext, and CTA distinction?",
      "Spacing - Is there adequate padding and breathing room?",
      "Alignment - Are elements properly aligned?",
      "Color contrast - Is text readable against backgrounds?",
      "Content quality - Is the copy compelling and clear?",
      "Icon usage - Are icons meaningful and not generic stars?",
      "Mobile-readiness - Will this look good on smaller screens?",
    ];

    // Return evaluation structure for AI to analyze
    return {
      success: true,
      elementId,
      elementType: element.type,
      elementName: element.name,
      hasScreenshot: !!screenshot,
      screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null,
      evaluationCriteria,
      structureAnalysis: {
        childCount: element.children?.length || 0,
        hasChildren: (element.children?.length || 0) > 0,
        depth: getElementDepth(element),
        containsText: hasTextContent(element),
        containsImage: hasImageElement(element),
        containsButton: hasButtonElement(element),
        containsIcon: hasIconElement(element),
      },
      instructions: `
EVALUATE THIS SECTION:

1. Review the screenshot (if available) and structure analysis
2. Score each criterion from 1-5 (1=poor, 5=excellent)
3. Identify specific issues if any
4. Report findings to user

⚠️ IMPORTANT: After evaluation, STOP and tell user the results.
Do NOT automatically call improveSectionWithAI - verification loops make designs worse.
Only improve if user explicitly requests it after seeing the evaluation.
      `,
    };
  },

  improveSectionWithAI: async (params, ctx) => {
    const { elementId, issues, maxIterations = 2 } = params;

    if (!elementId) {
      return { success: false, error: "elementId is required" };
    }

    if (!ctx.aiService?.editComponent) {
      return { success: false, error: "AI service not available for improvement" };
    }

    const element = findElementById(elementId, ctx.elements);
    if (!element) {
      return { success: false, error: `Element ${elementId} not found` };
    }

    // Track improvement iterations
    let currentElement = element;
    const improvementLog: { iteration: number; changes: string }[] = [];

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      // Show improvement activity
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mcp-scan-start", {
            detail: {
              elementId,
              scanType: "generating",
              description: `AI improving section (iteration ${iteration}/${maxIterations})...`,
            },
          })
        );
      }

      // Build improvement instruction
      const instruction = issues?.length
        ? `Fix these issues: ${issues.join("; ")}. Improve visual hierarchy, spacing, and overall design quality.`
        : "Improve this section: enhance visual hierarchy, optimize spacing, ensure good contrast, and make content more compelling.";

      try {
        const improved = await ctx.aiService.editComponent(
          JSON.parse(JSON.stringify(currentElement)),
          instruction
        );

        if (improved) {
          // Post-process icons
          const processedImproved = postProcessIconsInElements([improved])[0];

          // Update in state
          ctx.updateElement(elementId, processedImproved);
          currentElement = processedImproved;

          improvementLog.push({
            iteration,
            changes: `Applied AI improvements: ${instruction}`,
          });

          showToast(`Section improved (iteration ${iteration})`, "success");
        }
      } catch (e) {
        console.error(`Improvement iteration ${iteration} failed:`, e);
        improvementLog.push({
          iteration,
          changes: `Failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        });
      }

      // Complete animation between iterations
      if (typeof window !== "undefined") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
    }

    return {
      success: true,
      elementId,
      iterations: maxIterations,
      improvementLog,
      message: `Section improved through ${maxIterations} AI iteration(s)`,
      tip: "Improvement complete. STOP here - do not continue verifying (loops make designs worse).",
    };
  },

  autoVerifyAndImprove: async (params, ctx) => {
    const { elementId, qualityThreshold = 3.5, maxIterations = 2 } = params;

    if (!elementId) {
      return { success: false, error: "elementId is required" };
    }

    // WARNING: This tool should ONLY be used when user explicitly requests verification
    // Automatic verification loops degrade design quality

    return {
      success: true,
      warning: "⚠️ ONLY use this when user explicitly asks to verify. Automatic verification loops make designs WORSE.",
      workflow: {
        step1: {
          action: "Ask user first",
          description: "Only proceed if user explicitly requested verification",
        },
        step2: {
          action: "One improvement max",
          description: "If improving, do ONE improvement then STOP",
        },
      },
      qualityThreshold,
      maxIterations,
      tip: "STOP after one improvement. Do NOT loop. Verification loops make designs worse, not better.",
    };
  },
};

// Helper functions for element analysis
function getElementDepth(element: FunnelElement, depth = 1): number {
  if (!element.children?.length) return depth;
  return Math.max(...element.children.map((c) => getElementDepth(c, depth + 1)));
}

function hasTextContent(element: FunnelElement): boolean {
  if (element.type === "headline" || element.type === "paragraph") return true;
  if (element.content && element.content.trim().length > 0) return true;
  return element.children?.some(hasTextContent) || false;
}

function hasImageElement(element: FunnelElement): boolean {
  if (element.type === "image") return true;
  return element.children?.some(hasImageElement) || false;
}

function hasButtonElement(element: FunnelElement): boolean {
  if (element.type === "button") return true;
  return element.children?.some(hasButtonElement) || false;
}

function hasIconElement(element: FunnelElement): boolean {
  if (element.type === "icon") return true;
  return element.children?.some(hasIconElement) || false;
}

// Get executor by name
export function getExecutor(name: string): ToolExecutor | undefined {
  return TOOL_EXECUTORS[name];
}

// Get all executor names
export function getExecutorNames(): string[] {
  return Object.keys(TOOL_EXECUTORS);
}

// Execute a tool by name
export async function executeTool(
  name: string,
  params: any,
  ctx: ToolContext
): Promise<any> {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  return executor(params, ctx);
}
