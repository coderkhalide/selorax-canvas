"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAIPrompt } from "@/hooks/useAIPrompt";
import { useFunnel } from "@/context/FunnelContext";

interface AIPromptBarProps {
  pageId?: string;
  tenantId?: string;
}

export function AIPromptBar({ pageId, tenantId }: AIPromptBarProps) {
  const { selectedId } = useFunnel();
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isStreaming, response, error, sendPrompt, clearResponse } =
    useAIPrompt({ pageId, tenantId, selectedNodeId: selectedId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const prompt = input;
    setInput("");
    setCollapsed(false); // reset so new response is visible
    await sendPrompt(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const hasOutput = response || error;

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedId
              ? "Ask AI to edit selected element..."
              : "Ask AI to edit this page..."
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50 py-0.5"
          style={{ minHeight: "24px", maxHeight: "120px" }}
        />
        {hasOutput && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            title={collapsed ? "Show response" : "Hide response"}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        )}
        {hasOutput && !isStreaming && (
          <button
            type="button"
            onClick={clearResponse}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            title="Clear response"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="flex-shrink-0 p-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          title="Send to Mastra AI"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Response area */}
      {hasOutput && !collapsed && (
        <div className="px-4 pb-3">
          {error ? (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
              {error}
            </p>
          ) : (
            <div className="text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {response}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-purple-500 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
