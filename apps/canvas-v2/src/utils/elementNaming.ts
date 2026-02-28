/**
 * Element Naming Utility
 * Generates semantic, unique names for funnel elements when AI doesn't provide them.
 */

// Naming patterns by element type - ordered by common usage
const NAMING_PATTERNS: Record<string, string[]> = {
  // Containers
  section: [
    "Hero Section",
    "Features Section",
    "CTA Section",
    "Testimonials Section",
    "Pricing Section",
    "FAQ Section",
    "About Section",
    "Contact Section",
    "Footer Section",
    "Benefits Section",
    "How It Works Section",
    "Gallery Section",
  ],
  row: ["Content Row", "Feature Row", "Hero Row", "Card Row", "Grid Row"],
  col: ["Left Column", "Right Column", "Center Column", "Content Column", "Image Column"],
  wrapper: ["Content Wrapper", "Group", "Container", "Card Wrapper", "Text Wrapper"],
  grid: ["Feature Grid", "Card Grid", "Image Grid", "Content Grid"],

  // Text elements
  headline: [
    "Main Headline",
    "Section Title",
    "Subheadline",
    "Feature Title",
    "CTA Title",
    "Card Title",
  ],
  paragraph: [
    "Description",
    "Body Text",
    "Sub-text",
    "Feature Description",
    "Card Description",
    "Intro Text",
  ],
  text: ["Text Block", "Caption", "Label", "Note"],

  // Interactive elements
  button: [
    "CTA Button",
    "Primary Button",
    "Secondary Button",
    "Action Button",
    "Learn More Button",
    "Submit Button",
  ],
  link: ["Text Link", "Navigation Link", "Learn More Link"],
  form: ["Contact Form", "Signup Form", "Lead Form"],
  input: ["Email Input", "Name Input", "Text Input"],

  // Media elements
  image: [
    "Hero Image",
    "Feature Image",
    "Product Image",
    "Background Image",
    "Icon Image",
    "Team Photo",
    "Gallery Image",
  ],
  video: ["Product Video", "Demo Video", "Background Video", "Explainer Video"],
  icon: ["Feature Icon", "Trust Badge", "Social Icon", "Check Icon"],

  // Custom components
  boxes: ["Features", "Benefits", "Highlights", "Services", "Steps"],
  carousel: ["Image Gallery", "Product Carousel", "Testimonial Slider", "Feature Carousel"],
  quotes: ["Testimonials", "Client Reviews", "Customer Quotes", "Success Stories"],
  countdown: ["Limited Time Timer", "Sale Countdown", "Launch Timer", "Event Countdown"],
  accordion: ["FAQ Accordion", "Details Accordion", "Info Accordion"],
  tabs: ["Feature Tabs", "Content Tabs", "Service Tabs"],
  pricing: ["Pricing Table", "Plan Comparison", "Pricing Cards"],
  sequence: ["Process Steps", "How It Works", "Timeline", "Journey Steps"],
  step: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
  gallery: ["Photo Gallery", "Product Gallery", "Portfolio Gallery"],
  socialproof: ["Trust Badges", "Client Logos", "As Seen In"],
  timer: ["Countdown Timer", "Sale Timer", "Limited Offer Timer"],
  spacer: ["Spacer", "Divider", "Gap"],
  divider: ["Section Divider", "Content Divider", "Line Divider"],

  // Lists
  list: ["Feature List", "Benefit List", "Checklist"],
  listItem: ["List Item", "Feature", "Benefit"],
};

// Track used names per generation session to ensure uniqueness
let usedNames: Set<string> = new Set();

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reset the naming session - call this before processing a new batch of elements
 */
export function resetNamingSession(): void {
  usedNames = new Set();
}

/**
 * Generate a semantic, unique name for an element
 * @param type - The element type (section, headline, button, etc.)
 * @param existingName - The current name (if any)
 * @param context - Optional context for smarter naming
 */
export function generateElementName(
  type: string,
  existingName?: string,
  context?: {
    parentType?: string;
    index?: number;
    content?: string;
  }
): string {
  // If already has a good name, keep it
  if (
    existingName &&
    existingName !== "AI Generated" &&
    existingName.trim().length > 0 &&
    existingName !== type // Don't accept just the type as a name
  ) {
    // Track it as used to prevent duplicates
    usedNames.add(existingName);
    return existingName;
  }

  // Normalize type to lowercase
  const normalizedType = type?.toLowerCase() || "element";

  // Get patterns for this type, or create a default
  const patterns = NAMING_PATTERNS[normalizedType] || [capitalize(normalizedType)];

  // Try to find an unused name from the patterns
  for (const pattern of patterns) {
    if (!usedNames.has(pattern)) {
      usedNames.add(pattern);
      return pattern;
    }
  }

  // All patterns used - generate numbered variant
  let counter = 2;
  const baseName = patterns[0];
  while (usedNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  const uniqueName = `${baseName} ${counter}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

/**
 * Process an element and its children recursively, ensuring all have names
 */
function processElementsRecursively(elements: any[]): any[] {
  return elements.map((el) => {
    const processedEl = {
      ...el,
      name: generateElementName(el.type, el.name, { content: el.content }),
    };

    // Process children if they exist
    if (el.children && Array.isArray(el.children) && el.children.length > 0) {
      processedEl.children = processElementsRecursively(el.children);
    }

    return processedEl;
  });
}

/**
 * Ensure all elements in a tree have unique, descriptive names
 * Call this after AI generates elements to guarantee proper naming
 * @param elements - Array of elements to process
 */
export function ensureElementNames(elements: any[]): any[] {
  resetNamingSession();
  return processElementsRecursively(elements);
}

/**
 * Get a suggested name for a specific element type
 * Useful for UI hints or autocomplete
 */
export function getSuggestedNames(type: string): string[] {
  const normalizedType = type?.toLowerCase() || "element";
  return NAMING_PATTERNS[normalizedType] || [capitalize(normalizedType)];
}

export default {
  generateElementName,
  ensureElementNames,
  resetNamingSession,
  getSuggestedNames,
};
