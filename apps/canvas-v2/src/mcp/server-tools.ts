/**
 * Server-side MCP Tool Handlers
 *
 * These tools are handled directly in the API route without requiring
 * browser round-trip through Redis. They contain no browser dependencies.
 *
 * This fixes the timeout issue for static/computational tools when the
 * browser tab is in the background.
 */

// ===== THINK TOOL =====
export function handleThink(params: any) {
  return {
    success: true,
    message: "Thought recorded. Now proceed with your plan.",
    nextSteps: [
      "Call getDesignGuidelines() if you need design patterns",
      "Call getDesignSystem() to get current theme colors",
      "Call getCapabilities() to see available components",
      "Execute your plan step by step",
      "STOP when done - do NOT verify or screenshot (causes loops that make designs worse)",
    ],
  };
}

// ===== GET AGENT INSTRUCTIONS =====
export function handleGetAgentInstructions() {
  return {
    success: true,
    workflow: {
      step1:
        "THINK: Use the 'think' tool to plan your approach - break down the request, consider which tools you need",
      step2:
        "LEARN: Call 'getDesignGuidelines' to understand design patterns and best practices",
      step3:
        "CONTEXT: Call 'getDesignSystem' to get current theme colors and CSS variables",
      step4:
        "EXPLORE: Call 'getCapabilities' to see available element types and components",
      step5:
        "PLAN: Use 'planDesign' to create a structured implementation plan",
      step6:
        "EXECUTE: Implement the design using 'generatePage' or 'setElements' with atomic structure",
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
      "NO AUTO-VERIFY: Do NOT take screenshots or verify unless user explicitly asks. Verification loops make designs worse!",
      "ONE AND DONE: Complete task once and STOP. Do not iterate or 'improve' without user request.",
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
    importantNote:
      "Verification loops (screenshot → improve → screenshot → improve) make designs WORSE. Only verify if user explicitly asks.",
  };
}

// ===== GET DESIGN GUIDELINES =====
export function handleGetDesignGuidelines() {
  return {
    success: true,
    guidelines:
      "See quickReference and condensedGuidelines for key patterns. Use atomic design: section > wrapper > row > col. Every element needs a unique id.",
    quickReference: {
      atomicDesign: "section > wrapper > row > col (ALWAYS use this structure)",
      uniqueIdRule:
        "EVERY element MUST have a unique 'id' field - NO EXCEPTIONS. Use kebab-case: 'hero-section', 'feature-card-1', 'cta-btn'",
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
      customComponentsRule:
        "AVOID custom components for simple grids. Build atomically with row/col instead. Only use custom components (carousel, countdown, circle) for complex interactivity.",
      iconRule:
        "NEVER use emojis. Use 'icon' elements with Lucide names matching content meaning (Truck for delivery, Shield for security, Zap for speed).",
      namingRule:
        "Name elements descriptively: 'Hero Section', 'Features Grid', 'CTA Button' - never generic names",
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
        heroHeadline:
          "48-72px, fontWeight 700-800, lineHeight 1.1-1.2, letterSpacing -0.02em",
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
        cardShadow:
          "0 4px 20px rgba(0,0,0,0.06) or 0 20px 40px rgba(0,0,0,0.08)",
        buttonRadius: "8-12px",
        cardRadius: "12-20px",
        imageRadius: "16-24px",
        gradient: "linear-gradient(135deg, color1, color2)",
      },
      colorRules: {
        rule: "60-30-10: 60% background, 30% secondary, 10% accent",
        cta: "var(--color-primary-button-background) with var(--color-primary-button-text)",
        alternating:
          "Alternate section backgrounds: white, subtle gray, gradient, dark",
      },
    },
    jsonExamples: {
      heroSection: {
        description: "Well-structured hero section with proper atomic design",
        json: {
          id: "hero-section",
          type: "section",
          name: "Hero Section",
          style: {
            width: "100%",
            padding: "80px 20px",
            backgroundColor: "var(--color-background)",
          },
          children: [
            {
              id: "hero-wrapper",
              type: "wrapper",
              name: "Hero Wrapper",
              style: {
                maxWidth: "1200px",
                margin: "0 auto",
                padding: "0 20px",
              },
              children: [
                {
                  id: "hero-row",
                  type: "row",
                  name: "Hero Row",
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "40px",
                    alignItems: "center",
                  },
                  children: [
                    {
                      id: "hero-content-col",
                      type: "col",
                      name: "Content Column",
                      style: { flex: "1 1 55%", minWidth: "300px" },
                      children: [
                        {
                          id: "hero-headline",
                          type: "headline",
                          name: "Main Headline",
                          content: "Transform Your Business Today",
                          style: {
                            fontSize: "48px",
                            fontWeight: "700",
                            lineHeight: "1.1",
                            color: "var(--color-foreground-heading)",
                            letterSpacing: "-0.02em",
                          },
                        },
                        {
                          id: "hero-desc",
                          type: "paragraph",
                          name: "Hero Description",
                          content:
                            "Join thousands of companies saving time and growing faster.",
                          style: {
                            fontSize: "18px",
                            lineHeight: "1.6",
                            color: "var(--color-foreground-muted)",
                            marginTop: "16px",
                            maxWidth: "500px",
                          },
                        },
                        {
                          id: "hero-cta",
                          type: "button",
                          name: "CTA Button",
                          content: "Start Free Trial",
                          style: {
                            marginTop: "24px",
                            padding: "14px 32px",
                            fontSize: "16px",
                            fontWeight: "600",
                            backgroundColor:
                              "var(--color-primary-button-background)",
                            color: "var(--color-primary-button-text)",
                            borderRadius: "10px",
                            border: "none",
                          },
                        },
                      ],
                    },
                    {
                      id: "hero-image-col",
                      type: "col",
                      name: "Image Column",
                      style: { flex: "1 1 40%", minWidth: "280px" },
                      children: [
                        {
                          id: "hero-img",
                          type: "image",
                          name: "Hero Image",
                          src: "https://placehold.co/600x400",
                          style: {
                            width: "100%",
                            borderRadius: "16px",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      featureCard: {
        description: "Feature card with icon, title, and description",
        json: {
          id: "feature-card-1",
          type: "wrapper",
          name: "Feature Card",
          style: {
            padding: "32px",
            backgroundColor: "var(--color-input-background)",
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            textAlign: "center",
          },
          children: [
            {
              id: "feature-icon-1",
              type: "icon",
              name: "Feature Icon",
              content: "Zap",
              style: {
                color: "var(--color-primary)",
                width: "32px",
                height: "32px",
                marginBottom: "16px",
              },
            },
            {
              id: "feature-title-1",
              type: "headline",
              name: "Feature Title",
              content: "Lightning Fast",
              style: {
                fontSize: "20px",
                fontWeight: "600",
                color: "var(--color-foreground-heading)",
                marginBottom: "8px",
              },
            },
            {
              id: "feature-desc-1",
              type: "paragraph",
              name: "Feature Description",
              content: "Experience blazing fast performance.",
              style: {
                fontSize: "15px",
                lineHeight: "1.6",
                color: "var(--color-foreground-muted)",
              },
            },
          ],
        },
      },
    },
  };
}

// ===== SEARCH ICON =====
const ICON_DATABASE: Record<string, { icons: string[]; keywords: string[] }> = {
  speed: {
    icons: [
      "Zap",
      "Timer",
      "Gauge",
      "Rocket",
      "FastForward",
      "Clock",
      "Hourglass",
      "Activity",
    ],
    keywords: [
      "fast",
      "quick",
      "speed",
      "performance",
      "lightning",
      "instant",
      "rapid",
      "swift",
    ],
  },
  security: {
    icons: [
      "Shield",
      "ShieldCheck",
      "ShieldAlert",
      "Lock",
      "LockKeyhole",
      "KeyRound",
      "Key",
      "Fingerprint",
      "ScanFace",
      "ShieldOff",
    ],
    keywords: [
      "secure",
      "security",
      "safe",
      "protection",
      "protect",
      "privacy",
      "encrypted",
      "trust",
      "guard",
    ],
  },
  analytics: {
    icons: [
      "BarChart3",
      "BarChart2",
      "LineChart",
      "PieChart",
      "TrendingUp",
      "TrendingDown",
      "Activity",
      "ChartLine",
      "ChartBar",
      "ChartPie",
      "ChartArea",
    ],
    keywords: [
      "analytics",
      "data",
      "statistics",
      "metrics",
      "chart",
      "graph",
      "report",
      "insights",
      "dashboard",
      "tracking",
    ],
  },
  design: {
    icons: [
      "Palette",
      "Paintbrush",
      "Brush",
      "Layers",
      "Layout",
      "LayoutGrid",
      "Sparkles",
      "Wand2",
      "PenTool",
      "Figma",
      "Framer",
    ],
    keywords: [
      "design",
      "creative",
      "art",
      "style",
      "beautiful",
      "aesthetic",
      "template",
      "customize",
      "visual",
      "ui",
    ],
  },
  communication: {
    icons: [
      "MessageCircle",
      "MessageSquare",
      "Mail",
      "Send",
      "Phone",
      "PhoneCall",
      "Video",
      "Headphones",
      "Mic",
      "AtSign",
      "Inbox",
    ],
    keywords: [
      "message",
      "chat",
      "email",
      "contact",
      "call",
      "support",
      "talk",
      "communication",
      "reach",
      "connect",
    ],
  },
  navigation: {
    icons: [
      "ArrowRight",
      "ArrowLeft",
      "ArrowUp",
      "ArrowDown",
      "ChevronRight",
      "ChevronLeft",
      "ExternalLink",
      "Link",
      "Navigation",
      "Compass",
      "Map",
    ],
    keywords: [
      "arrow",
      "direction",
      "navigate",
      "go",
      "next",
      "previous",
      "link",
      "explore",
      "direction",
    ],
  },
  status: {
    icons: [
      "CheckCircle",
      "Check",
      "CheckCheck",
      "CircleCheck",
      "BadgeCheck",
      "XCircle",
      "X",
      "AlertCircle",
      "AlertTriangle",
      "Info",
      "HelpCircle",
    ],
    keywords: [
      "success",
      "check",
      "done",
      "complete",
      "verified",
      "approved",
      "correct",
      "error",
      "warning",
      "info",
      "help",
    ],
  },
  media: {
    icons: [
      "Image",
      "Camera",
      "Video",
      "Film",
      "Play",
      "Pause",
      "Music",
      "Mic",
      "Volume2",
      "Youtube",
      "Tv",
    ],
    keywords: [
      "image",
      "photo",
      "video",
      "media",
      "play",
      "music",
      "audio",
      "camera",
      "film",
      "gallery",
    ],
  },
  commerce: {
    icons: [
      "ShoppingCart",
      "ShoppingBag",
      "CreditCard",
      "DollarSign",
      "Wallet",
      "Receipt",
      "Tag",
      "Percent",
      "Gift",
      "Package",
      "Truck",
    ],
    keywords: [
      "buy",
      "shop",
      "cart",
      "price",
      "money",
      "payment",
      "sale",
      "discount",
      "order",
      "delivery",
      "ecommerce",
    ],
  },
  social: {
    icons: [
      "Users",
      "UserPlus",
      "User",
      "Heart",
      "ThumbsUp",
      "Share2",
      "Globe",
      "HeartHandshake",
      "Award",
      "Trophy",
    ],
    keywords: [
      "user",
      "people",
      "community",
      "social",
      "share",
      "like",
      "follow",
      "team",
      "group",
      "network",
      "friends",
    ],
  },
  technology: {
    icons: [
      "Cpu",
      "Server",
      "Database",
      "Cloud",
      "Code",
      "Terminal",
      "Smartphone",
      "Laptop",
      "Monitor",
      "Wifi",
      "Settings",
    ],
    keywords: [
      "tech",
      "technology",
      "code",
      "software",
      "hardware",
      "computer",
      "server",
      "cloud",
      "api",
      "developer",
    ],
  },
  ai: {
    icons: [
      "Sparkles",
      "Brain",
      "Cpu",
      "Wand2",
      "Bot",
      "Lightbulb",
      "Zap",
      "Stars",
      "Gem",
      "Rocket",
    ],
    keywords: [
      "ai",
      "artificial",
      "intelligence",
      "smart",
      "auto",
      "magic",
      "automated",
      "machine",
      "learning",
      "powered",
    ],
  },
  time: {
    icons: [
      "Clock",
      "Timer",
      "Calendar",
      "CalendarDays",
      "Hourglass",
      "Watch",
      "AlarmClock",
      "History",
      "TimerReset",
    ],
    keywords: [
      "time",
      "schedule",
      "date",
      "calendar",
      "clock",
      "deadline",
      "appointment",
      "event",
      "countdown",
    ],
  },
  document: {
    icons: [
      "FileText",
      "File",
      "Files",
      "Folder",
      "FolderOpen",
      "ClipboardList",
      "BookOpen",
      "Notebook",
      "Scroll",
      "FileCheck",
    ],
    keywords: [
      "file",
      "document",
      "folder",
      "paper",
      "text",
      "report",
      "pdf",
      "attachment",
      "docs",
    ],
  },
  growth: {
    icons: [
      "TrendingUp",
      "ArrowUpRight",
      "ChartLine",
      "Sprout",
      "Rocket",
      "Target",
      "Goal",
      "Award",
      "Medal",
      "Crown",
    ],
    keywords: [
      "growth",
      "increase",
      "improve",
      "rise",
      "success",
      "progress",
      "goal",
      "achieve",
      "win",
      "results",
    ],
  },
  features: {
    icons: [
      "Sparkles",
      "CheckCircle",
      "BadgeCheck",
      "Award",
      "Zap",
      "Gem",
      "Diamond",
      "Crown",
      "Flame",
      "Star",
    ],
    keywords: [
      "feature",
      "benefit",
      "advantage",
      "highlight",
      "special",
      "premium",
      "pro",
      "best",
      "top",
    ],
  },
};

export function handleSearchIcon(params: any) {
  const { query, category } = params;
  const searchTerm = query?.toLowerCase() || "";

  const results: { icon: string; category: string; relevance: number }[] = [];

  for (const [cat, data] of Object.entries(ICON_DATABASE)) {
    if (category && category !== "all" && cat !== category) continue;

    const keywordMatch = data.keywords.some(
      (kw) => kw.includes(searchTerm) || searchTerm.includes(kw),
    );

    const iconMatches = data.icons.filter((icon) =>
      icon.toLowerCase().includes(searchTerm),
    );

    if (keywordMatch) {
      data.icons.forEach((icon) => {
        if (!results.find((r) => r.icon === icon)) {
          results.push({ icon, category: cat, relevance: 2 });
        }
      });
    }

    iconMatches.forEach((icon) => {
      const existing = results.find((r) => r.icon === icon);
      if (existing) {
        existing.relevance = 3;
      } else {
        results.push({ icon, category: cat, relevance: 3 });
      }
    });
  }

  results.sort((a, b) => b.relevance - a.relevance);
  const topResults = results.slice(0, 10);

  return {
    success: true,
    query: searchTerm,
    results: topResults.map((r) => ({
      icon: r.icon,
      category: r.category,
      usage: `{ "type": "icon", "icon": "${r.icon}", "style": { "color": "var(--color-primary)" } }`,
    })),
    totalFound: topResults.length,
    tip: "Use icon names in PascalCase format. NEVER use emojis!",
    categories: Object.keys(ICON_DATABASE),
  };
}

// ===== CREATE DESIGN STRATEGY =====

// Industry detection (extracted from executors.ts)
function detectIndustry(content: string): string {
  const lower = content.toLowerCase();
  if (lower.match(/\b(saas|software|app|platform|tool|dashboard|api|automat)/))
    return "saas";
  if (lower.match(/\b(shop|store|product|buy|cart|ecommerce|fashion|clothing)/))
    return "ecommerce";
  if (lower.match(/\b(consult|agency|service|coach|mentor|freelanc)/))
    return "consulting";
  if (lower.match(/\b(course|learn|educat|school|training|tutor|student)/))
    return "education";
  if (lower.match(/\b(health|medical|doctor|clinic|wellness|fitness|gym)/))
    return "healthcare";
  if (lower.match(/\b(financ|invest|bank|crypto|trading|money|insurance)/))
    return "finance";
  if (lower.match(/\b(design|creative|portfolio|art|photo|music|film)/))
    return "creative";
  return "general";
}

function getFramework(industry: string): string {
  const frameworks: Record<string, string> = {
    saas: "AIDA",
    ecommerce: "4Ps",
    consulting: "PAS",
    education: "AIDA",
    healthcare: "PAS",
    finance: "PAS",
    creative: "AIDA",
    general: "AIDA",
  };
  return frameworks[industry] || "AIDA";
}

function getSectionOrder(framework: string): string[] {
  const orders: Record<string, string[]> = {
    AIDA: [
      "Hero (Attention)",
      "Features (Interest)",
      "Social Proof (Desire)",
      "CTA (Action)",
    ],
    PAS: ["Problem", "Agitation", "Solution", "Social Proof", "CTA"],
    "4Ps": ["Promise", "Picture", "Proof", "Push"],
  };
  return orders[framework] || orders["AIDA"];
}

const heroStyles = [
  "split",
  "centered",
  "background-image",
  "gradient-hero",
  "minimal-hero",
  "asymmetric",
  "video-hero",
];
const featuresLayouts = [
  "icon-grid",
  "alternating",
  "card-grid",
  "bento",
  "numbered-steps",
  "icon-list",
];
const ctaStyles = [
  "centered-cta",
  "split-cta",
  "gradient-cta",
  "minimal-cta",
  "social-cta",
];
const socialProofStyles = [
  "testimonial-grid",
  "logo-bar",
  "stats-bar",
  "single-spotlight",
  "case-study",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function handleCreateDesignStrategy(params: any) {
  const { content, industry: userIndustry } = params;

  if (!content) {
    return {
      success: false,
      error: "Content is required to create a design strategy",
    };
  }

  const industry = userIndustry || detectIndustry(content);
  const framework = getFramework(industry);
  const sectionOrder = getSectionOrder(framework);

  const strategy = {
    framework,
    industry,
    heroStyle: randomPick(heroStyles),
    featuresLayout: randomPick(featuresLayouts),
    socialProofStyle: randomPick(socialProofStyles),
    ctaStyle: randomPick(ctaStyles),
    sectionOrder,
    uniqueId: Math.random().toString(36).slice(2, 8),
  };

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
    nextStep:
      "Now call generateLandingPage with this content. The layout instructions are automatically applied.",
  };
}

// ===== PLAN DESIGN =====
export function handlePlanDesign(params: any) {
  const { request } = params;

  if (!request) {
    return { success: false, error: "Request description is required" };
  }

  const industry = detectIndustry(request);
  const framework = getFramework(industry);
  const sectionOrder = getSectionOrder(framework);

  const strategy = {
    framework,
    industry,
    heroStyle: randomPick(heroStyles),
    featuresLayout: randomPick(featuresLayouts),
    socialProofStyle: randomPick(socialProofStyles),
    ctaStyle: randomPick(ctaStyles),
    sectionOrder,
    uniqueId: Math.random().toString(36).slice(2, 8),
  };

  const recommendedSections = sectionOrder.map((sectionName) => {
    const lower = sectionName.toLowerCase();
    if (
      lower.includes("hero") ||
      lower.includes("problem") ||
      lower.includes("promise")
    ) {
      return {
        name: sectionName,
        type: "section",
        layout: strategy.heroStyle,
        purpose:
          "Capture attention with bold headline, value proposition, and CTA",
        elements: [
          "headline (48-64px)",
          "paragraph (18px)",
          "button (CTA)",
          "image or video",
        ],
        structure: "section > wrapper > row > col",
      };
    }
    if (
      lower.includes("feature") ||
      lower.includes("benefit") ||
      lower.includes("how") ||
      lower.includes("pain") ||
      lower.includes("solution") ||
      lower.includes("transformation")
    ) {
      return {
        name: sectionName,
        type: "section",
        layout: strategy.featuresLayout,
        purpose: "Showcase key benefits, features, or process steps",
        elements: [
          "icon (Lucide)",
          "headline (20-24px)",
          "paragraph (15-16px)",
        ],
        structure: "section > wrapper > row > col (3-4 columns)",
      };
    }
    if (
      lower.includes("testimonial") ||
      lower.includes("proof") ||
      lower.includes("logo") ||
      lower.includes("result") ||
      lower.includes("about")
    ) {
      return {
        name: sectionName,
        type: "section",
        layout: strategy.socialProofStyle,
        purpose: "Build trust through social proof, testimonials, or results",
        elements: [
          "paragraph (quote)",
          "headline (author name)",
          "image (avatar)",
        ],
        structure: "section > wrapper > row > col",
      };
    }
    return {
      name: sectionName,
      type: "section",
      layout: strategy.ctaStyle,
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
        uniqueIds:
          "EVERY element MUST have a unique 'id' field (kebab-case: 'hero-section', 'feature-card-1')",
        structure: "Use atomic design: section > wrapper > row > col",
        colors:
          "Use var(--color-primary) for CTAs, var(--color-background) for sections",
        spacing:
          "Sections: 80-120px padding. Cards: 24-32px gap. Content: 16-24px gap.",
        typography:
          "Hero: 48-64px bold. Section titles: 32-40px. Body: 16-18px, lineHeight 1.6.",
        visualDepth:
          "Cards: box-shadow 0 4px 20px rgba(0,0,0,0.06). Buttons: borderRadius 8-12px. Images: borderRadius 16px.",
      },
    },
    nextSteps: [
      "Call generateLandingPage() with the content - layout instructions are automatically applied",
      "Or use setElements() to manually build with the recommended structure",
      "STOP when done - do NOT verify or screenshot (causes loops that make designs worse)",
    ],
  };
}

// ===== INTELLIGENT LAYOUT DECISION ENGINE =====
export function handleGenerateIntelligentLayout(params: any) {
  const {
    contentType,
    businessType,
    designStyle,
    targetAudience,
    contentComplexity,
  } = params;

  if (!contentType || !businessType) {
    return {
      success: false,
      error:
        "Content type and business type are required for intelligent layout decisions",
    };
  }

  // Layout decision matrix based on content type and business context
  const layoutDecisions: Record<string, any> = {
    hero: {
      tech: {
        rows: 1,
        columns: 2,
        imagePosition: "right",
        layout: "split",
        priority: "imageFirst",
      },
      ecommerce: {
        rows: 1,
        columns: 2,
        imagePosition: "left",
        layout: "split",
        priority: "contentFirst",
      },
      education: {
        rows: 1,
        columns: 1,
        imagePosition: "background",
        layout: "centered",
        priority: "contentFirst",
      },
      service: {
        rows: 1,
        columns: 2,
        imagePosition: "left",
        layout: "split",
        priority: "contentFirst",
      },
      saas: {
        rows: 1,
        columns: 2,
        imagePosition: "right",
        layout: "split",
        priority: "imageFirst",
      },
      default: {
        rows: 1,
        columns: 2,
        imagePosition: "right",
        layout: "split",
        priority: "balanced",
      },
    },
    features: {
      tech: {
        rows: "auto",
        columns: 3,
        layout: "grid",
        spacing: "even",
        cardStyle: "minimal",
      },
      ecommerce: {
        rows: "auto",
        columns: 4,
        layout: "grid",
        spacing: "compact",
        cardStyle: "product",
      },
      education: {
        rows: "auto",
        columns: 2,
        layout: "alternating",
        spacing: "generous",
        cardStyle: "friendly",
      },
      service: {
        rows: "auto",
        columns: 3,
        layout: "grid",
        spacing: "balanced",
        cardStyle: "professional",
      },
      saas: {
        rows: "auto",
        columns: 3,
        layout: "grid",
        spacing: "modern",
        cardStyle: "clean",
      },
      default: {
        rows: "auto",
        columns: 3,
        layout: "grid",
        spacing: "balanced",
        cardStyle: "standard",
      },
    },
    testimonials: {
      tech: {
        rows: 1,
        columns: 3,
        layout: "grid",
        cardStyle: "minimal",
        maxTestimonials: 3,
      },
      ecommerce: {
        rows: 2,
        columns: 2,
        layout: "grid",
        cardStyle: "product",
        maxTestimonials: 4,
      },
      education: {
        rows: 1,
        columns: 2,
        layout: "alternating",
        cardStyle: "friendly",
        maxTestimonials: 4,
      },
      service: {
        rows: 1,
        columns: 3,
        layout: "grid",
        cardStyle: "professional",
        maxTestimonials: 3,
      },
      saas: {
        rows: 1,
        columns: 3,
        layout: "carousel",
        cardStyle: "clean",
        maxTestimonials: 6,
      },
      default: {
        rows: 1,
        columns: 3,
        layout: "grid",
        cardStyle: "standard",
        maxTestimonials: 3,
      },
    },
  };

  // Get the specific decision based on content type and business type
  const contentDecision = layoutDecisions[contentType] || layoutDecisions.hero;
  const decision = contentDecision[businessType] || contentDecision.default;

  // Add intelligent recommendations based on design style and audience
  const recommendations = {
    typography:
      designStyle === "modern"
        ? "sans-serif, clean lines"
        : designStyle === "corporate"
          ? "serif, professional"
          : "balanced, readable",

    colorScheme:
      targetAudience === "young"
        ? "vibrant, high contrast"
        : targetAudience === "professional"
          ? "muted, professional"
          : "brand-appropriate, accessible",

    spacing:
      contentComplexity === "complex"
        ? "generous whitespace"
        : contentComplexity === "simple"
          ? "compact, efficient"
          : "balanced, comfortable",
  };

  return {
    success: true,
    decision: {
      ...decision,
      contentType,
      businessType,
      designStyle: designStyle || "modern",
      targetAudience: targetAudience || "general",
      contentComplexity: contentComplexity || "moderate",
    },
    recommendations,
    implementation: {
      structure: `Use ${decision.rows} row(s) with ${decision.columns} column(s)`,
      layout:
        decision.layout === "split"
          ? "50% content | 50% image with flex layout"
          : decision.layout === "grid"
            ? "CSS grid layout with even spacing"
            : "Flexbox layout with alignment",
      nextSteps:
        "Apply this layout structure using atomic design: section > wrapper > row > col",
    },
  };
}

// ===== AI ACTIVITY SIGNALS =====
export function handleAiActivityStart(params: any) {
  return {
    success: true,
    message: `AI activity started: ${params.activityType || "working"} - ${params.description || "processing"}`,
  };
}

export function handleAiActivityEnd(params: any) {
  return {
    success: params.success !== false,
    message: `AI activity completed${params.success === false ? " with errors" : " successfully"}`,
  };
}

/**
 * Map of tool names to their server-side handlers.
 * These tools are handled directly without browser round-trip.
 */
export const SERVER_SIDE_TOOLS: Record<string, (params: any) => any> = {
  think: handleThink,
  getDesignGuidelines: handleGetDesignGuidelines,
  getAgentInstructions: handleGetAgentInstructions,
  searchIcon: handleSearchIcon,
  createDesignStrategy: handleCreateDesignStrategy,
  planDesign: handlePlanDesign,
  generateIntelligentLayout: handleGenerateIntelligentLayout,
  aiActivityStart: handleAiActivityStart,
  aiActivityEnd: handleAiActivityEnd,
};
