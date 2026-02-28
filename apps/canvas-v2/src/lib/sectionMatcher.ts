import { FunnelElement } from '../types';

export interface LandingPageItem {
  id: string;
  name: string;
  created: string;
  updated?: string;
  data: { elements?: FunnelElement[] } | null;
}

export interface MatchedSection {
  id: string;
  sectionElement: FunnelElement;
  sourcePage: {
    id: string;
    name: string;
    created: string;
  };
}

/**
 * Normalize section name for flexible matching
 * "Hero_Section" → "hero"
 * "Features Section" → "features"
 */
export function normalizeSectionName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(Boolean)[0] || '';
}

/**
 * Check if two section names match (flexible matching by first keyword)
 * "Hero_Section" matches "Hero Banner", "Main Hero", etc.
 */
export function matchesSectionName(sourceName: string, targetName: string): boolean {
  const sourceKey = normalizeSectionName(sourceName);
  const targetKey = normalizeSectionName(targetName);
  return sourceKey === targetKey && sourceKey !== '';
}

/**
 * Extract all sections matching the target name from landing pages
 */
export function extractMatchingSections(
  pages: LandingPageItem[],
  targetName: string,
  excludePageId?: string
): MatchedSection[] {
  const matches: MatchedSection[] = [];
  const normalizedTarget = normalizeSectionName(targetName);

  console.log('[sectionMatcher] extractMatchingSections called', {
    targetName,
    normalizedTarget,
    pagesCount: pages.length,
    excludePageId
  });

  for (const page of pages) {
    // Skip excluded page (usually the current page being edited)
    if (excludePageId && page.id === excludePageId) {
      console.log('[sectionMatcher] Skipping excluded page:', page.name);
      continue;
    }

    const elements = page.data?.elements || [];
    console.log(`[sectionMatcher] Page "${page.name}" has ${elements.length} top-level elements`);

    // Find top-level sections that match by name
    for (const element of elements) {
      console.log(`[sectionMatcher] Element: type="${element.type}", name="${element.name}"`);

      if (element.type === 'section' && element.name) {
        const normalizedSource = normalizeSectionName(element.name);
        const isMatch = matchesSectionName(element.name, targetName);
        console.log(`[sectionMatcher] Comparing "${element.name}" (${normalizedSource}) with "${targetName}" (${normalizedTarget}): ${isMatch}`);

        if (isMatch) {
          matches.push({
            id: `${page.id}-${element.id}`,
            sectionElement: element,
            sourcePage: {
              id: page.id,
              name: page.name,
              created: page.created,
            },
          });
        }
      }
    }
  }

  console.log('[sectionMatcher] Total matches found:', matches.length);
  return matches;
}

/**
 * Generate a unique element ID
 */
function generateUniqueId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recursively regenerate all IDs in an element tree to ensure uniqueness
 * This prevents ID collisions when copying sections between pages
 */
export function regenerateElementIds(element: FunnelElement): FunnelElement {
  const processElement = (el: FunnelElement): FunnelElement => {
    const newElement: FunnelElement = {
      ...el,
      id: generateUniqueId(),
    };

    if (newElement.children && Array.isArray(newElement.children)) {
      newElement.children = newElement.children.map(processElement);
    }

    return newElement;
  };

  return processElement(element);
}
