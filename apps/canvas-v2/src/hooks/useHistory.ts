import { useState, useCallback, useEffect, useRef } from "react";
import { FunnelElement, HistoryEntry, HistoryState } from "../types";
import {
  saveHistoryToStorage,
  loadHistoryFromStorage,
  clearHistoryFromStorage,
  getStorageUsage,
  formatStorageSize,
  getStorageSize,
} from "../utils/storageUtils";

interface HistorySnapshot {
  elements: FunnelElement[];
  globalCss: string;
  theme?: {
    currentSchemeId: string;
    schemes: Record<string, any>; // using any to avoid circular deps or complex imports, or ColorScheme if available
  };
}

interface UseHistoryReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentHistoryIndex: number;
  historyEntries: HistoryEntry[];
  storageUsage: number;
  storageSize: string;

  // Actions
  pushHistory: (snapshot: HistorySnapshot, description: string) => void;
  undo: () => HistorySnapshot | null;
  redo: () => HistorySnapshot | null;
  goToHistory: (index: number) => HistorySnapshot | null;
  clearHistory: () => void;
}

const MAX_HISTORY_SIZE = 100;

export function useHistory(initialSnapshot: HistorySnapshot): UseHistoryReturn {
  const [historyState, setHistoryState] = useState<HistoryState>(() => {
    // Initialize with current state
    const initialEntry: HistoryEntry = {
      id: `history-${Date.now()}`,
      timestamp: Date.now(),
      description: "Initial state",
      snapshot: initialSnapshot,
    };

    return {
      entries: [initialEntry],
      currentIndex: 0,
    };
  });

  // Load history from storage on mount
  useEffect(() => {
    const saved = loadHistoryFromStorage();
    if (saved && saved.entries && Array.isArray(saved.entries)) {
      setHistoryState(saved);
    }
  }, []);

  const [storageUsage, setStorageUsage] = useState(0);
  const [storageSize, setStorageSize] = useState("0 KB");

  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save to localStorage whenever history changes (debounced)
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveHistoryToStorage(historyState);
      setStorageUsage(getStorageUsage());
      setStorageSize(formatStorageSize(getStorageSize()));
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [historyState]);

  const pushHistory = useCallback(
    (snapshot: HistorySnapshot, description: string) => {
      setHistoryState((prev) => {
        // Remove any entries after current index (when user makes changes after undo)
        const newEntries = prev.entries.slice(0, prev.currentIndex + 1);

        // Create new entry
        const newEntry: HistoryEntry = {
          id: `history-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          timestamp: Date.now(),
          description,
          snapshot,
        };

        // Add new entry
        newEntries.push(newEntry);

        // Limit history size
        const limitedEntries =
          newEntries.length > MAX_HISTORY_SIZE
            ? newEntries.slice(-MAX_HISTORY_SIZE)
            : newEntries;

        return {
          entries: limitedEntries,
          currentIndex: limitedEntries.length - 1,
        };
      });
    },
    []
  );

  const undo = useCallback((): HistorySnapshot | null => {
    if (historyState.currentIndex <= 0) {
      return null;
    }

    const newIndex = historyState.currentIndex - 1;
    setHistoryState((prev) => ({
      ...prev,
      currentIndex: newIndex,
    }));

    return historyState.entries[newIndex].snapshot;
  }, [historyState]);

  const redo = useCallback((): HistorySnapshot | null => {
    if (historyState.currentIndex >= historyState.entries.length - 1) {
      return null;
    }

    const newIndex = historyState.currentIndex + 1;
    setHistoryState((prev) => ({
      ...prev,
      currentIndex: newIndex,
    }));

    return historyState.entries[newIndex].snapshot;
  }, [historyState]);

  const goToHistory = useCallback(
    (index: number): HistorySnapshot | null => {
      if (index < 0 || index >= historyState.entries.length) {
        return null;
      }

      setHistoryState((prev) => ({
        ...prev,
        currentIndex: index,
      }));

      return historyState.entries[index].snapshot;
    },
    [historyState]
  );

  const clearHistory = useCallback(() => {
    const initialEntry: HistoryEntry = {
      id: `history-${Date.now()}`,
      timestamp: Date.now(),
      description: "History cleared",
      snapshot: historyState.entries[historyState.currentIndex].snapshot,
    };

    setHistoryState({
      entries: [initialEntry],
      currentIndex: 0,
    });

    clearHistoryFromStorage();
    setStorageUsage(0);
    setStorageSize("0 KB");
  }, [historyState]);

  return {
    canUndo: historyState.currentIndex > 0,
    canRedo: historyState.currentIndex < historyState.entries.length - 1,
    historyLength: historyState.entries.length,
    currentHistoryIndex: historyState.currentIndex,
    historyEntries: historyState.entries,
    storageUsage,
    storageSize,
    pushHistory,
    undo,
    redo,
    goToHistory,
    clearHistory,
  };
}
