"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

interface StreamUpdate {
  type: "start" | "chunk" | "partial" | "complete" | "error";
  tool?: string;
  message?: string;
  progress?: number;
  data?: any;
}

/**
 * MCPStreamingProgress - Shows real-time progress during MCP tool execution
 *
 * Listens for:
 * - mcp-stream-chunk: Stream updates from the executor
 * - mcp-stream-update: Partial updates with element counts
 */
export const MCPStreamingProgress: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [streamState, setStreamState] = useState<StreamUpdate | null>(null);
  const [elementsCount, setElementsCount] = useState(0);

  useEffect(() => {
    const handleStreamChunk = (e: CustomEvent<StreamUpdate>) => {
      const update = e.detail;
      setStreamState(update);

      if (update.type === "start") {
        setIsVisible(true);
        setElementsCount(0);
      } else if (update.type === "partial" && update.data?.elementsCount) {
        setElementsCount(update.data.elementsCount);
      } else if (update.type === "complete" || update.type === "error") {
        // Hide after a short delay
        setTimeout(() => {
          setIsVisible(false);
          setStreamState(null);
          setElementsCount(0);
        }, 1500);
      }
    };

    const handleStreamUpdate = (e: CustomEvent<{ type: string; elementsCount?: number; progress?: number }>) => {
      if (e.detail.elementsCount) {
        setElementsCount(e.detail.elementsCount);
      }
    };

    window.addEventListener("mcp-stream-chunk", handleStreamChunk as EventListener);
    window.addEventListener("mcp-stream-update", handleStreamUpdate as EventListener);

    return () => {
      window.removeEventListener("mcp-stream-chunk", handleStreamChunk as EventListener);
      window.removeEventListener("mcp-stream-update", handleStreamUpdate as EventListener);
    };
  }, []);

  if (!isVisible || !streamState) return null;

  const getIcon = () => {
    switch (streamState.type) {
      case "complete":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (streamState.type) {
      case "complete":
        return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
      default:
        return "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm ${getStatusColor()}`}
      >
        {getIcon()}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {streamState.tool === "generateLandingPage" ? "Generating Landing Page" : "AI Working"}
            </span>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {streamState.message || "Processing..."}
          </span>
          {elementsCount > 0 && streamState.type !== "complete" && (
            <span className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              {elementsCount} section{elementsCount !== 1 ? "s" : ""} created
            </span>
          )}
        </div>
        {streamState.progress !== undefined && streamState.type !== "complete" && (
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ml-2">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${streamState.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPStreamingProgress;
