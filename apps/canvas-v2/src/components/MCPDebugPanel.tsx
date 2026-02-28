"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Bug, Camera, Sparkles, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

interface MCPEvent {
  id: string;
  timestamp: number;
  type: "command" | "screenshot" | "ai-activity";
  command?: string;
  elementId?: string;
  imageData?: string;
  error?: string;
  args?: any;
}

export const MCPDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [events, setEvents] = useState<MCPEvent[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (eventsEndRef.current && !isMinimized) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, isMinimized]);

  useEffect(() => {
    // Listen for screenshot events
    const handleScreenshotStart = (e: CustomEvent<{ elementId: string }>) => {
      setEvents((prev) => [
        ...prev,
        {
          id: `evt_${Date.now()}`,
          timestamp: Date.now(),
          type: "screenshot",
          command: "screenshotElement (start)",
          elementId: e.detail.elementId,
        },
      ]);
      // Auto-open panel on activity
      setIsOpen(true);
    };

    const handleScreenshotComplete = (e: CustomEvent<{ elementId: string; imageData?: string; error?: string }>) => {
      setEvents((prev) => [
        ...prev,
        {
          id: `evt_${Date.now()}`,
          timestamp: Date.now(),
          type: "screenshot",
          command: e.detail.error ? "screenshotElement (failed)" : "screenshotElement (complete)",
          elementId: e.detail.elementId,
          imageData: e.detail.imageData,
          error: e.detail.error,
        },
      ]);
    };

    // Listen for MCP commands (we'll add these events to the command listener)
    const handleMCPCommand = (e: CustomEvent<{ command: string; args?: any }>) => {
      setEvents((prev) => [
        ...prev,
        {
          id: `evt_${Date.now()}`,
          timestamp: Date.now(),
          type: "command",
          command: e.detail.command,
          args: e.detail.args,
        },
      ]);
      setIsOpen(true);
    };

    // Listen for AI activity
    const handleAIActivity = (e: CustomEvent<{ type: string; elementId?: string; description?: string }>) => {
      setEvents((prev) => [
        ...prev,
        {
          id: `evt_${Date.now()}`,
          timestamp: Date.now(),
          type: "ai-activity",
          command: `AI ${e.detail.type}`,
          elementId: e.detail.elementId,
          args: { description: e.detail.description },
        },
      ]);
    };

    window.addEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
    window.addEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);
    window.addEventListener("mcp-command", handleMCPCommand as EventListener);
    window.addEventListener("mcp-ai-activity", handleAIActivity as EventListener);

    return () => {
      window.removeEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
      window.removeEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);
      window.removeEventListener("mcp-command", handleMCPCommand as EventListener);
      window.removeEventListener("mcp-ai-activity", handleAIActivity as EventListener);
    };
  }, []);

  const clearEvents = () => setEvents([]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "screenshot":
        return <Camera className="w-3.5 h-3.5 text-purple-500" />;
      case "ai-activity":
        return <Sparkles className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Bug className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-900 text-white p-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        title="Open MCP Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[10001] flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-2xl">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-gray-900/80 text-white p-1.5 rounded-full hover:bg-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={`data:image/png;base64,${selectedImage}`}
              alt="Screenshot preview"
              className="max-w-full h-auto"
            />
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <div
        className={`fixed bottom-4 right-4 z-[9999] bg-gray-900 text-white rounded-lg shadow-2xl transition-all ${
          isMinimized ? "w-64" : "w-96"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">MCP Debug</span>
            <span className="text-xs text-gray-400">({events.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearEvents}
              className="p-1 hover:bg-gray-700 rounded"
              title="Clear events"
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              {isMinimized ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Events List */}
        {!isMinimized && (
          <div className="max-h-80 overflow-y-auto p-2 space-y-2">
            {events.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No MCP events yet...
                <br />
                <span className="text-xs">Events will appear here when MCP tools are called</span>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800 rounded p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {getEventIcon(event.type)}
                      <span className="font-medium text-gray-200">{event.command}</span>
                    </div>
                    <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                  </div>

                  {event.elementId && (
                    <div className="text-gray-400">
                      Element: <span className="text-purple-400">{event.elementId}</span>
                    </div>
                  )}

                  {event.error && (
                    <div className="text-red-400">Error: {event.error}</div>
                  )}

                  {event.args && Object.keys(event.args).length > 0 && (
                    <div className="text-gray-500 truncate">
                      Args: {JSON.stringify(event.args)}
                    </div>
                  )}

                  {event.imageData && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => setSelectedImage(event.imageData!)}
                        className="relative group"
                      >
                        <img
                          src={`data:image/png;base64,${event.imageData}`}
                          alt="Screenshot"
                          className="w-full max-h-32 object-cover rounded border border-gray-700 hover:border-purple-500 transition-colors"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                          <span className="text-white text-xs">Click to enlarge</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>
    </>
  );
};

export default MCPDebugPanel;
