/**
 * Shared MCP Tool Definitions
 *
 * This file contains all tool definitions used by both:
 * - The stdio MCP server (for local Claude Desktop usage)
 * - The HTTP MCP server (for remote usage)
 */

import { z } from "zod";

// Tool definition type
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  // Zod schema for validation (used by stdio server)
  zodSchema?: z.ZodType<any>;
}

// Element types available in the funnel builder
export const ELEMENT_TYPES = [
  { type: "section", description: "Container section for page content" },
  { type: "row", description: "Horizontal row container" },
  { type: "col", description: "Column within a row" },
  { type: "headline", description: "Headline/title text" },
  { type: "paragraph", description: "Paragraph text content" },
  { type: "button", description: "Clickable button" },
  { type: "image", description: "Image element" },
  { type: "video", description: "Video embed" },
  { type: "input", description: "Form input field" },
  {
    type: "icon",
    description:
      "Icon element - uses Lucide icons in PascalCase. Choose based on content meaning: 'Truck' for delivery, 'Shield' for security, 'Zap' for speed, 'CheckCircle' for success. NEVER use 'Star' as default - only for ratings!",
  },
];

// MCP Resources
export const MCP_RESOURCES = [
  {
    uri: "funnel://components",
    name: "Custom Components",
    description: "List of all available custom components",
    mimeType: "application/json",
  },
  {
    uri: "funnel://elements",
    name: "Funnel Elements",
    description: "Current funnel elements tree",
    mimeType: "application/json",
  },
  {
    uri: "funnel://theme",
    name: "Theme",
    description: "Current color scheme and design system",
    mimeType: "application/json",
  },
  {
    uri: "funnel://selected",
    name: "Selected Element",
    description: "Currently selected element",
    mimeType: "application/json",
  },
];

// All MCP tools with their schemas
export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: "checkConnection",
    description:
      "Check if the funnel builder web app is running and accessible",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getElementTypes",
    description:
      "Get a list of available element types that can be used in the funnel builder",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "setElements",
    description:
      "Replace all elements with a new set. CRITICAL: Every element MUST have a unique 'id' field (e.g., 'hero-section', 'feature-card-1'). ICON AUTO-FIX: Star icons are automatically replaced with semantic icons based on text (delivery→Truck, security→Shield, speed→Zap, returns→Undo2, organic→Leaf). Use atomic design: section > wrapper > row > col. Use CSS variables like var(--color-primary).",
    inputSchema: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          description:
            "The complete elements array to set - EVERY element must have a unique 'id' field. Follow atomic design: section > wrapper > row > col structure",
          items: { type: "object" },
        },
      },
      required: ["elements"],
    },
  },
  {
    name: "addElement",
    description:
      "Add a NEW element to the funnel. Use this ONLY for adding brand new content, NOT for updating existing elements. To update existing elements, use editElementById or updateElement instead. CRITICAL: The element MUST have a unique 'id' field. ICON AUTO-FIX: Star icons are automatically replaced with semantic icons based on text content.",
    inputSchema: {
      type: "object",
      properties: {
        element: {
          description:
            "A single NEW element to add - MUST have a unique 'id' field. Do NOT use this to replace existing elements - use editElementById instead.",
        },
        parentId: {
          type: "string",
          description:
            "Parent element ID to add this element inside (optional). If not provided, adds to the end of the root elements.",
        },
        insertAtIndex: {
          type: "number",
          description:
            "Position index to insert the element at within the parent (optional). If not provided, adds at the end. Use this to control element order.",
        },
      },
      required: ["element"],
    },
  },
  {
    name: "updateElement",
    description:
      "Update specific properties of an element IN-PLACE (text, styles, or simple properties). The element stays at its current position. Use this for quick property changes. For complex AI-powered updates, use editElementById instead. NEVER delete and recreate elements for updates - that moves them to the bottom!",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the element to update",
        },
        updates: {
          type: "object",
          description:
            "The properties to update. For icon elements, use 'icon' property with Lucide icon name (e.g., { icon: 'Sprout' }). Other common updates: { content: 'text' }, { style: {...} }. This updates the element IN-PLACE.",
        },
      },
      required: ["id", "updates"],
    },
  },
  {
    name: "changeTheme",
    description: "Change the color theme of the entire funnel",
    inputSchema: {
      type: "object",
      properties: {
        color: {
          type: "string",
          description:
            "The theme color (hex code or color name like 'blue', 'purple', 'red')",
        },
      },
      required: ["color"],
    },
  },
  {
    name: "setHeadline",
    description: "Set or update a headline text in the funnel",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The headline text",
        },
        elementId: {
          type: "string",
          description:
            "Specific element ID to update, or updates first headline found",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "setButtonText",
    description: "Set or update a button text in the funnel",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The button text",
        },
        elementId: {
          type: "string",
          description: "Specific button ID, or updates first button found",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "generatePage",
    description:
      "Generate a complete landing page. CRITICAL: Every element MUST have a unique 'id' field. ICON AUTO-FIX: Star icons are automatically replaced with semantic icons (delivery→Truck, security→Shield, speed→Zap, returns→Undo2, organic→Leaf). Structure: Hero > Features > Social Proof > CTA. Use atomic design (section > wrapper > row > col).",
    inputSchema: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          description:
            "Complete page elements - EVERY element must have a unique 'id' field. Use atomic structure: section > wrapper > row > col",
          items: { type: "object" },
        },
        themeColor: {
          type: "string",
          description: "Theme color (hex or name) - applied as CSS variables",
        },
        themeName: {
          type: "string",
          description: "Theme name for identification",
        },
      },
      required: ["elements"],
    },
  },
  {
    name: "getSelectedElement",
    description:
      "Get detailed information about the currently selected element in the UI",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getParentSection",
    description:
      "Get the full parent section containing the specified or selected element",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "Element ID to find parent section for",
        },
      },
    },
  },
  {
    name: "verifyElement",
    description:
      "ONLY use when user explicitly asks to verify or check an element. Do NOT use automatically after editing - this causes loops that make designs worse. Simply checks if an element exists.",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the element to verify",
        },
        includeScreenshot: {
          type: "boolean",
          description:
            "Whether to include a screenshot (avoid unless requested)",
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "screenshotElement",
    description:
      "ONLY use when user explicitly asks to see or screenshot an element. Do NOT use automatically after creating/editing - seeing screenshots triggers unnecessary 'improvements' that make designs worse. Complete your task and stop.",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the element to screenshot",
        },
        scale: {
          type: "number",
          description: "Screenshot scale factor (default: 2)",
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "aiActivityStart",
    description:
      "Signal that AI is starting work on an element (shows visual feedback)",
    inputSchema: {
      type: "object",
      properties: {
        activityType: {
          type: "string",
          enum: ["creating", "updating", "generating"],
          description: "Type of AI activity",
        },
        elementId: {
          type: "string",
          description: "Element ID being worked on",
        },
        placeholderId: {
          type: "string",
          description: "Placeholder ID for new elements",
        },
        description: {
          type: "string",
          description: "Brief description of what AI is doing",
        },
      },
      required: ["activityType"],
    },
  },
  {
    name: "aiActivityEnd",
    description: "Signal that AI has finished working on an element",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "Element ID that AI finished working on",
        },
        placeholderId: {
          type: "string",
          description: "Placeholder ID if this was a new element",
        },
        success: {
          type: "boolean",
          description: "Whether the operation completed successfully",
        },
      },
      required: ["success"],
    },
  },
  {
    name: "getDesignSystem",
    description:
      "Get the current design system including theme colors, CSS variables, and available color schemes. ALWAYS call this before generating elements to match the existing design.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getCapabilities",
    description:
      "Get all available capabilities including element types, custom components (like carousel, gallery, boxes, accordion), and nesting rules. Call this to understand what components are available for modern designs.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getCurrentElements",
    description:
      "Get the current page structure with all elements. Useful for understanding existing content before modifications.",
    inputSchema: {
      type: "object",
      properties: {
        includeStyles: {
          type: "boolean",
          description:
            "Include element styles in response (default: false for smaller payload)",
        },
      },
    },
  },
  {
    name: "findElement",
    description:
      "Search for elements by type, name, or content. Returns matching elements with their IDs for targeted updates.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Element type to search for (e.g., 'headline', 'button', 'section', 'image')",
        },
        name: {
          type: "string",
          description: "Element name to search for (partial match)",
        },
        content: {
          type: "string",
          description: "Content text to search for (partial match)",
        },
      },
    },
  },
  {
    name: "setImageUrl",
    description:
      "Set or update an image element's URL. Can target a specific element or update the first image found.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The image URL to set",
        },
        elementId: {
          type: "string",
          description:
            "Specific image element ID (optional, updates first image found if not provided)",
        },
        alt: {
          type: "string",
          description: "Alt text for the image",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "deleteElement",
    description:
      "⚠️ DANGER: Only use this to PERMANENTLY REMOVE elements. NEVER use this for updates! If the user asks to 'update' or 'change' a section, use updateElement or editElementById instead - those tools update IN-PLACE without deleting. Using delete + add will move content to the bottom of the page!",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the element to permanently delete",
        },
      },
      required: ["elementId"],
    },
  },
  // AI-powered tools (require OpenRouter/Gemini service)
  {
    name: "editElementById",
    description:
      "⭐ PRIMARY UPDATE TOOL - Use this when user asks to 'update', 'change', 'modify', or 'edit' any element. Updates the element IN-PLACE at its current position without removing it. The element stays exactly where it is - only the content/style changes. NEVER use deleteElement + addElement for updates - that moves content to the bottom! TWO MODES: (1) Instruction mode: provide 'instruction' for browser AI to edit. (2) Direct mode: provide 'updatedElement' JSON object to apply directly (faster, no AI roundtrip needed). In direct mode, provide the COMPLETE element with all children, styles, and content. The original element 'id' is preserved automatically.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "The ID of the element to edit (use getSelectedElement to get the selected element's ID if user selected one)",
        },
        instruction: {
          type: "string",
          description:
            "How to modify the element (e.g., 'change headline to...', 'make button blue', 'update paragraph text'). Used for AI-powered edits.",
        },
        updatedElement: {
          type: "object",
          description:
            "DIRECT MODE: Provide the complete updated element JSON to apply directly without browser AI. Must include 'type' field and follow atomic design (section > wrapper > row > col). The element's root 'id' is preserved automatically. Every child must have a unique 'id'. Use CSS variables for colors.",
        },
        preserveChildren: {
          type: "boolean",
          description:
            "Keep existing child elements and structure (default: true). Set to false for major restructuring.",
          default: true,
        },
      },
      required: ["id"],
    },
  },
  {
    name: "editElement",
    description:
      "Edit the currently selected element using AI IN-PLACE. The element stays at its current position and is updated without being removed. Delegates to editElementById with the selected element's ID. Use this when the user has an element selected and wants to update it.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description:
            "How to modify the selected element (e.g., 'change the text', 'make it bigger', 'update the colors')",
        },
      },
      required: ["instruction"],
    },
  },
  {
    name: "updateLayout",
    description:
      "Update or optimize the entire funnel layout using AI. Use for global structural changes.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description:
            "Instructions for the layout optimization (e.g., 'make it more modern', 'improve spacing')",
        },
      },
      required: ["instruction"],
    },
  },
  {
    name: "generateLandingPage",
    description: `Generate a complete landing page using AI. This tool is SELF-THINKING - it automatically:
1. Analyzes your content to detect industry type (SaaS, ecommerce, consulting, etc.)
2. Selects the appropriate psychology framework (AIDA, PAS, or 4Ps)
3. Generates UNIQUE layout combinations each time (different hero, features, CTA styles)
4. Uses concrete design templates - not generic patterns

Each call produces a DIFFERENT design. Supported styles: modern-minimal (clean, whitespace), bold-energetic (vibrant, high contrast), luxury-premium (elegant, refined), playful-fun (colorful, friendly), corporate-professional (trust-building), creative-artistic (unique, expressive).`,
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "What the page is for - product/service description, target audience, key benefits. The tool analyzes this to create intelligent design decisions.",
        },
        color: {
          type: "string",
          description:
            "Theme color (hex like #3B82F6 or name like 'blue') - becomes CSS variables",
        },
        style: {
          type: "string",
          enum: [
            "modern-minimal",
            "bold-energetic",
            "luxury-premium",
            "playful-fun",
            "corporate-professional",
            "creative-artistic",
          ],
          description:
            "Optional design style. If not provided, the tool selects based on content analysis.",
        },
        industry: {
          type: "string",
          enum: [
            "saas",
            "ecommerce",
            "consulting",
            "education",
            "healthcare",
            "finance",
            "creative",
            "general",
          ],
          description:
            "Optional industry type. If not provided, auto-detected from content.",
        },
        autoVerify: {
          type: "boolean",
          description:
            "Automatically check quality after generation and fix critical issues like empty sections (default: true). Set to false to skip quality check.",
          default: true,
        },
      },
      required: ["content"],
    },
  },
  {
    name: "createDesignStrategy",
    description:
      "Preview the design strategy that would be used for a landing page. Call this to see what layout combinations will be used BEFORE generating. Returns the framework, hero style, features layout, CTA style, and section order. Useful for understanding or explaining the design approach.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to analyze for design strategy",
        },
        industry: {
          type: "string",
          enum: [
            "saas",
            "ecommerce",
            "consulting",
            "education",
            "healthcare",
            "finance",
            "creative",
            "general",
          ],
          description: "Optional industry override",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "updateCopy",
    description:
      "Generate or update text copy using AI. Can update the selected element or return generated text.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "The copy generation prompt (e.g., 'write a compelling headline for a SaaS product')",
        },
        context: {
          type: "string",
          description: "Additional context for the copy generation",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "think",
    description:
      "ALWAYS use this first to plan your approach before taking action. Break down the user's request, consider which tools to use, and plan your steps. This helps you work like an intelligent agent. Returns confirmation to proceed with your plan.",
    inputSchema: {
      type: "object",
      properties: {
        thought: {
          type: "string",
          description:
            "Your thought process: 1) What is being asked? 2) What tools do I need? 3) What is my step-by-step plan?",
        },
      },
      required: ["thought"],
    },
  },

  // ===== DESIGN KNOWLEDGE TOOLS =====
  // These tools expose design guidelines to help Claude work as an intelligent design agent

  {
    name: "getDesignGuidelines",
    description:
      "Get comprehensive design guidelines for creating modern landing pages. CALL THIS FIRST before generating any page content. Returns atomic design principles, section structure rules, styling tokens, CSS variable patterns, icon guidelines, and content writing best practices.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getAgentInstructions",
    description:
      "Get step-by-step workflow instructions for working as an effective design agent. Returns the recommended process (think → learn → explore → execute → verify), critical rules, and best practices for creating high-quality designs.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "planDesign",
    description:
      "Plan your design approach before implementation. Analyzes the request and returns a structured plan with recommended sections, component choices, and styling decisions. Use this after getting design guidelines to create a concrete plan.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description:
            "The user's design request or what kind of page/section to create",
        },
        currentTheme: {
          type: "string",
          description: "Current theme color (optional, for context)",
        },
      },
      required: ["request"],
    },
  },

  {
    name: "searchIcon",
    description:
      "Search for Lucide icons by concept, keyword, or use case. ALWAYS use this tool to find the right icon instead of using emojis. Returns icon names in PascalCase format ready to use in icon elements.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The concept or keyword to search for (e.g., 'speed', 'security', 'analytics', 'design', 'fast', 'check')",
        },
        category: {
          type: "string",
          enum: [
            "all",
            "speed",
            "security",
            "analytics",
            "design",
            "communication",
            "navigation",
            "status",
            "media",
            "commerce",
            "social",
          ],
          description: "Optional category to filter icons",
        },
      },
      required: ["query"],
    },
  },

  // ===== SELF-VERIFICATION & IMPROVEMENT TOOLS =====
  // ⚠️ VERIFICATION TOOLS - USER REQUEST ONLY
  // Do NOT use automatically - verification loops make designs WORSE

  {
    name: "evaluateSectionQuality",
    description:
      "⚠️ ONLY use when user explicitly asks to verify/check a section. Do NOT use automatically after creating sections. Takes screenshot and analyzes quality - report results to user and STOP. Do not auto-improve.",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the section/element to evaluate",
        },
        criteria: {
          type: "array",
          description:
            "Custom evaluation criteria (optional, uses defaults if not provided)",
          items: { type: "string" },
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "improveSectionWithAI",
    description:
      "⚠️ ONLY use when user explicitly asks to improve. Do NOT use automatically after evaluation. Do ONE improvement then STOP - do not loop. Verification loops degrade design quality.",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the section to improve",
        },
        issues: {
          type: "array",
          description: "Specific issues to fix",
          items: { type: "string" },
        },
        maxIterations: {
          type: "number",
          description: "Maximum improvement iterations (default: 2)",
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "autoVerifyAndImprove",
    description:
      "⚠️ DEPRECATED - verification loops make designs WORSE. Only use if user explicitly requests. After one improvement, STOP - do not continue looping.",
    inputSchema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "The ID of the section to verify and improve",
        },
        qualityThreshold: {
          type: "number",
          description:
            "Minimum quality score (1-5) before improvement is triggered (default: 3.5)",
        },
        maxIterations: {
          type: "number",
          description: "Maximum improvement iterations (default: 2)",
        },
      },
      required: ["elementId"],
    },
  },
  {
    name: "generateIntelligentLayout",
    description:
      "AI automatically analyzes content and generates optimal layout decisions. Returns intelligent row/column structure, image positioning, and design recommendations based on content type, business context, and target audience.",
    inputSchema: {
      type: "object",
      properties: {
        contentType: {
          type: "string",
          enum: [
            "hero",
            "features",
            "testimonials",
            "pricing",
            "faq",
            "cta",
            "gallery",
            "form",
            "navigation",
            "footer",
          ],
          description: "Type of content section being designed",
        },
        businessType: {
          type: "string",
          enum: [
            "tech",
            "ecommerce",
            "education",
            "service",
            "saas",
            "agency",
            "health",
            "finance",
            "nonprofit",
            "realestate",
          ],
          description: "Industry/business context for design decisions",
        },
        designStyle: {
          type: "string",
          enum: [
            "modern",
            "minimal",
            "corporate",
            "playful",
            "luxury",
            "clean",
            "bold",
            "elegant",
            "friendly",
            "professional",
          ],
          description: "Preferred design aesthetic style",
        },
        targetAudience: {
          type: "string",
          enum: [
            "young",
            "professional",
            "enterprise",
            "consumer",
            "creative",
            "technical",
            "senior",
            "family",
            "business",
            "general",
          ],
          description: "Target audience demographics",
        },
        contentComplexity: {
          type: "string",
          enum: ["simple", "moderate", "complex", "detailed"],
          description: "Complexity level of the content",
        },
      },
      required: ["contentType", "businessType"],
    },
  },
  {
    name: "generateHighConversionFunnel",
    description:
      "Creates industry-standard sales funnel that converts visitors into buyers automatically. Includes psychological triggers, persuasive content, and professional design patterns.",
    inputSchema: {
      type: "object",
      properties: {
        productType: {
          type: "string",
          enum: [
            "physical",
            "digital",
            "service",
            "subscription",
            "course",
            "ebook",
            "software",
          ],
          description: "Type of product being sold",
        },
        targetAudience: {
          type: "string",
          enum: [
            "men",
            "women",
            "business",
            "students",
            "professionals",
            "parents",
            "seniors",
          ],
          description: "Primary target audience for the product",
        },
        pricePoint: {
          type: "number",
          description: "Price of the product in local currency",
        },
        keyBenefits: {
          type: "array",
          items: { type: "string" },
          description: "Main benefits and value propositions of the product",
        },
        industry: {
          type: "string",
          enum: [
            "health",
            "fitness",
            "beauty",
            "education",
            "technology",
            "finance",
            "home",
            "food",
          ],
          description: "Industry category for design context",
        },
      },
      required: ["productType", "targetAudience", "keyBenefits"],
    },
  },
  {
    name: "generateHealthProductFunnel",
    description:
      "Automatically creates complete sales funnel for health/herbal products with natural design, trust signals, and medical credibility elements.",
    inputSchema: {
      type: "object",
      properties: {
        productName: {
          type: "string",
          description: "Name of the health/herbal product",
        },
        mainBenefit: {
          type: "string",
          description: "Primary health benefit offered",
        },
        ingredients: {
          type: "array",
          items: { type: "string" },
          description: "Key natural ingredients used",
        },
        targetGender: {
          type: "string",
          enum: ["men", "women", "unisex"],
          description: "Target gender audience",
        },
        ageGroup: {
          type: "string",
          enum: ["young", "adult", "senior", "all"],
          description: "Target age demographic",
        },
      },
      required: ["productName", "mainBenefit", "ingredients"],
    },
  },
];

// Get tool by name
export function getToolByName(name: string): MCPToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

// Get all tool names
export function getToolNames(): string[] {
  return MCP_TOOLS.map((t) => t.name);
}
