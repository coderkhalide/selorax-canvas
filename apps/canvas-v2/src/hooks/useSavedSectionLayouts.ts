import { useState, useEffect, useCallback } from 'react';
import { listLandingPagesFromPocketBase } from '../app/actions/pocketbase';
import {
  extractMatchingSections,
  MatchedSection,
  LandingPageItem,
} from '../lib/sectionMatcher';
import { FunnelElement } from '../types';

// Cache disabled: always hit PocketBase for real-time data

interface UseSavedSectionLayoutsResult {
  matchingSections: MatchedSection[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to fetch and filter matching sections from all saved landing pages
 * @param selectedElement - The currently selected element to match against
 * @param isOpen - Whether the layout sidebar is open (to avoid unnecessary fetches)
 * @param excludePageId - Optional page ID to exclude from results (current page)
 */
export function useSavedSectionLayouts(
  selectedElement: FunnelElement | null,
  isOpen: boolean,
  excludePageId?: string
): UseSavedSectionLayoutsResult {
  const [matchingSections, setMatchingSections] = useState<MatchedSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetName = selectedElement?.name || '';

  const fetchAndMatch = useCallback(
    async () => {
      console.log('[useSavedSectionLayouts] fetchAndMatch called', { targetName, isOpen });

      // Don't fetch if sidebar is closed or no target name
      if (!targetName || !isOpen) {
        console.log('[useSavedSectionLayouts] Skipping - sidebar closed or no target name');
        setMatchingSections([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch from PocketBase
        console.log('[useSavedSectionLayouts] Fetching from PocketBase...');
        console.log('[useSavedSectionLayouts] Calling server action NOW');

        let result;
        try {
          result = await listLandingPagesFromPocketBase(1, 100);
          console.log('[useSavedSectionLayouts] PocketBase result received:', {
            success: result.success,
            itemsCount: result.items?.length,
            error: result.error,
            totalItems: result.totalItems
          });
          console.log('[useSavedSectionLayouts] Full result:', JSON.stringify(result).slice(0, 1000));
        } catch (fetchError) {
          console.error('[useSavedSectionLayouts] Server action call FAILED:', fetchError);
          throw fetchError;
        }

        if (result.success) {
          const pages = result.items as LandingPageItem[];
          console.log('[useSavedSectionLayouts] Loaded pages:', pages.length);

          // Log all section names for debugging
          pages.forEach(page => {
            const sections = page.data?.elements?.filter(el => el.type === 'section') || [];
            console.log(`[useSavedSectionLayouts] Page "${page.name}" sections:`, sections.map(s => s.name));
          });

          // Extract matching sections
          const matches = extractMatchingSections(
            pages,
            targetName,
            excludePageId
          );
          console.log('[useSavedSectionLayouts] Found matches:', matches.length, matches);
          setMatchingSections(matches);
        } else {
          console.error('[useSavedSectionLayouts] API error:', result.error);
          setError(result.error || 'Failed to fetch landing pages');
          setMatchingSections([]);
        }
      } catch (err) {
        console.error('[useSavedSectionLayouts] Error fetching saved sections:', err);
        setError('Failed to load saved sections');
        setMatchingSections([]);
      } finally {
        setIsLoading(false);
      }
    },
    [targetName, isOpen, excludePageId]
  );

  // Fetch when sidebar opens or target name changes
  useEffect(() => {
    fetchAndMatch();
  }, [fetchAndMatch]);

  // Refresh function for manual reload
  const refresh = useCallback(() => {
    fetchAndMatch();
  }, [fetchAndMatch]);

  return {
    matchingSections,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Utility to clear the cache manually (useful for testing or after saving a page)
 */
export function clearSavedSectionsCache(): void {
  // no-op (kept for compatibility)
}
