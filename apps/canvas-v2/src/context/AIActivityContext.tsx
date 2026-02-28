"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type AIActivityType = "creating" | "updating" | "generating";

export interface AIActivity {
  elementId: string | null;
  placeholderId?: string;
  activityType: AIActivityType;
  description?: string;
  startTime: number;
}

interface AIActivityContextType {
  activeActivities: Map<string, AIActivity>;
  isElementBeingWorkedOn: (elementId: string) => boolean;
  getActivityForElement: (elementId: string) => AIActivity | null;
  addActivity: (activity: AIActivity) => void;
  removeActivity: (idOrPlaceholderId: string) => void;
  hasAnyActivity: boolean;
}

const AIActivityContext = createContext<AIActivityContextType | null>(null);

// Auto-cleanup timeout (30 seconds) to prevent stuck activities
const ACTIVITY_TIMEOUT = 30000;

export function AIActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<Map<string, AIActivity>>(new Map());

  // Add a new activity
  const addActivity = useCallback((activity: AIActivity) => {
    const key = activity.elementId || activity.placeholderId || `activity_${Date.now()}`;

    setActivities((prev) => {
      const next = new Map(prev);
      next.set(key, activity);
      return next;
    });

    // Auto-cleanup after timeout to prevent stuck states
    setTimeout(() => {
      setActivities((prev) => {
        const existing = prev.get(key);
        // Only remove if it's the same activity (not replaced)
        if (existing && existing.startTime === activity.startTime) {
          const next = new Map(prev);
          next.delete(key);
          return next;
        }
        return prev;
      });
    }, ACTIVITY_TIMEOUT);
  }, []);

  // Remove an activity by elementId or placeholderId
  const removeActivity = useCallback((idOrPlaceholderId: string) => {
    setActivities((prev) => {
      const next = new Map(prev);
      next.delete(idOrPlaceholderId);
      return next;
    });
  }, []);

  // Check if an element is being worked on
  const isElementBeingWorkedOn = useCallback(
    (elementId: string) => {
      return activities.has(elementId);
    },
    [activities]
  );

  // Get activity for a specific element
  const getActivityForElement = useCallback(
    (elementId: string): AIActivity | null => {
      return activities.get(elementId) || null;
    },
    [activities]
  );

  // Check if there's any activity
  const hasAnyActivity = useMemo(() => activities.size > 0, [activities]);

  const value = useMemo(
    () => ({
      activeActivities: activities,
      isElementBeingWorkedOn,
      getActivityForElement,
      addActivity,
      removeActivity,
      hasAnyActivity,
    }),
    [activities, isElementBeingWorkedOn, getActivityForElement, addActivity, removeActivity, hasAnyActivity]
  );

  return (
    <AIActivityContext.Provider value={value}>
      {children}
    </AIActivityContext.Provider>
  );
}

export function useAIActivity() {
  const context = useContext(AIActivityContext);
  if (!context) {
    throw new Error("useAIActivity must be used within an AIActivityProvider");
  }
  return context;
}

export default AIActivityContext;
