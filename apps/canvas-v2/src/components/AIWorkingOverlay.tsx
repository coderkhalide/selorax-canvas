"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { AIActivityType } from "../context/AIActivityContext";

interface AIWorkingOverlayProps {
  activityType: AIActivityType;
  description?: string;
  variant?: "shimmer" | "pulse" | "sparkle";
}

const activityLabels: Record<AIActivityType, string> = {
  creating: "Creating",
  updating: "Updating",
  generating: "Generating",
};

export const AIWorkingOverlay: React.FC<AIWorkingOverlayProps> = ({
  activityType,
  description,
  variant = "shimmer",
}) => {
  const label = description || `AI ${activityLabels[activityType]}...`;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-lg">
      {/* Animated gradient border */}
      <div className="absolute inset-0 ai-working-border rounded-lg" />

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 ai-shimmer-overlay" />

      {/* Activity badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-purple-600/90 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full shadow-lg ai-badge-glow">
        <Sparkles className="w-3 h-3 animate-sparkle" />
        <span className="font-medium">{label}</span>
      </div>

      {/* Corner sparkles */}
      <div className="absolute top-1 right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-75" />
      <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping opacity-75 animation-delay-200" />
    </div>
  );
};

export default AIWorkingOverlay;
