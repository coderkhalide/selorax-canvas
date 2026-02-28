"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface AIPlaceholderElementProps {
  placeholderId: string;
  description?: string;
}

export const AIPlaceholderElement: React.FC<AIPlaceholderElementProps> = ({
  placeholderId,
  description,
}) => {
  return (
    <div
      id={placeholderId}
      className="w-full min-h-[120px] rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-2 border-dashed border-purple-300 dark:border-purple-700 flex flex-col items-center justify-center gap-3 animate-pulse-subtle ai-placeholder-glow"
    >
      {/* Sparkle animation container */}
      <div className="relative">
        <Sparkles className="w-8 h-8 text-purple-500 animate-sparkle" />
        {/* Radiating sparkle effect */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-12 h-12 rounded-full bg-purple-400/20 animate-ping" />
        </div>
      </div>

      {/* Loading text */}
      <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
        AI is creating your element...
      </div>

      {description && (
        <div className="text-xs text-purple-500 dark:text-purple-400 max-w-xs text-center">
          {description}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex gap-1.5">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-1" />
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce-2" />
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce-3" />
      </div>
    </div>
  );
};

export default AIPlaceholderElement;
