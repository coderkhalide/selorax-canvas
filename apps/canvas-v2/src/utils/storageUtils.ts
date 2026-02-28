import { FunnelElement } from "../types";

const STORAGE_KEY = "funnel_history";
const MAX_HISTORY_ENTRIES = 50;
const MIN_HISTORY_ENTRIES = 10;
const STORAGE_WARNING_THRESHOLD = 0.8; // 80% of estimated limit

/**
 * Get the current size of localStorage in bytes
 */
export function getStorageSize(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

/**
 * Get estimated localStorage limit (typically 5-10MB, we use conservative 5MB)
 */
export function getStorageLimit(): number {
  return 5 * 1024 * 1024; // 5MB in bytes
}

/**
 * Get storage usage as a percentage (0-1)
 */
export function getStorageUsage(): number {
  return getStorageSize() / getStorageLimit();
}

/**
 * Check if we're approaching storage limit
 */
export function isApproachingStorageLimit(): boolean {
  return getStorageUsage() > STORAGE_WARNING_THRESHOLD;
}

/**
 * Prune old history entries to stay within limits
 */
export function pruneHistoryEntries<T>(
  entries: T[],
  maxCount: number = MAX_HISTORY_ENTRIES
): T[] {
  if (entries.length <= maxCount) {
    return entries;
  }

  // Keep the most recent entries
  return entries.slice(-maxCount);
}

/**
 * Save history to localStorage with automatic pruning
 */
export function saveHistoryToStorage(history: any): boolean {
  if (typeof window === "undefined") return false;
  try {
    let historyToSave = history;

    // If approaching limit, prune entries
    if (isApproachingStorageLimit() && history.entries) {
      historyToSave = {
        ...history,
        entries: pruneHistoryEntries(history.entries, MAX_HISTORY_ENTRIES),
      };
    }

    const serialized = JSON.stringify(historyToSave);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    // If storage is full, try with fewer entries
    if (error instanceof Error && error.name === "QuotaExceededError") {
      try {
        const prunedHistory = {
          ...history,
          entries: pruneHistoryEntries(history.entries, MIN_HISTORY_ENTRIES),
        };
        const serialized = JSON.stringify(prunedHistory);
        localStorage.setItem(STORAGE_KEY, serialized);
        console.warn(
          "Storage limit reached, pruned history to minimum entries"
        );
        return true;
      } catch (retryError) {
        console.error("Failed to save history even after pruning:", retryError);
        return false;
      }
    }
    console.error("Failed to save history to localStorage:", error);
    return false;
  }
}

/**
 * Load history from localStorage
 */
export function loadHistoryFromStorage(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    return JSON.parse(serialized);
  } catch (error) {
    console.error("Failed to load history from localStorage:", error);
    return null;
  }
}

/**
 * Clear history from localStorage
 */
export function clearHistoryFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear history from localStorage:", error);
  }
}

/**
 * Format storage size for display
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
