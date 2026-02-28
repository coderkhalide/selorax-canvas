import { useState } from "react";
import {
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Wrench,
  Database,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";

export type MCPConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface MCPStatusBadgeProps {
  status: MCPConnectionStatus;
  onReconnect: () => void;
  tools?: { name: string; description: string }[];
  resources?: { uri: string; name: string }[];
  error?: string | null;
}

export function MCPStatusBadge({
  status,
  onReconnect,
  tools = [],
  resources = [],
  error,
}: MCPStatusBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    connected: {
      icon: <Wifi className="w-3 h-3" />,
      label: "Connected",
      color: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100",
      dotColor: "bg-green-500",
    },
    connecting: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Connecting",
      color: "bg-amber-50 text-amber-600 border-amber-200",
      dotColor: "bg-amber-500",
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Error",
      color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
      dotColor: "bg-red-500",
    },
    disconnected: {
      icon: <WifiOff className="w-3 h-3" />,
      label: "Offline",
      color: "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100",
      dotColor: "bg-gray-400",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="relative inline-block">
      {/* Main Badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all ${config.color}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${status === "connecting" ? "animate-pulse" : ""}`}
        />
        {config.icon}
        <span>{config.label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-100"
            onClick={() => setIsExpanded(false)}
          />

          {/* Panel - Fixed position in center of screen on mobile, absolute on larger screens */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:top-full sm:translate-x-0 sm:translate-y-0 sm:mt-2 w-70 bg-white rounded-xl border border-gray-200 shadow-2xl z-101 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 bg-linear-to-r from-purple-50 to-blue-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${config.dotColor} ${status === "connecting" ? "animate-pulse" : ""}`}
                />
                <span className="font-semibold text-sm text-gray-800">
                  MCP Server
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/50 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Error Message */}
            {status === "error" && error && (
              <div className="mx-3 mt-2 p-2 text-xs text-red-600 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Content */}
            <div className="max-h-75 overflow-y-auto">
              {/* Tools Section */}
              {status === "connected" && tools.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      Tools ({tools.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-35 overflow-y-auto pr-1">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800">
                            {tool.name}
                          </p>
                          <p className="text-[10px] text-gray-500 line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resources Section */}
              {status === "connected" && resources.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      Resources ({resources.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {resources.map((resource) => (
                      <div
                        key={resource.uri}
                        className="flex items-center gap-1.5 p-1.5 rounded-md bg-blue-50 text-blue-700"
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span className="text-[10px] font-medium truncate">
                          {resource.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disconnected State */}
              {status === "disconnected" && (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <WifiOff className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Not Connected
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    MCP server is offline
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReconnect();
                      setIsExpanded(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Connect Now
                  </button>
                </div>
              )}

              {/* Connecting State */}
              {status === "connecting" && (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Connecting...
                  </p>
                  <p className="text-xs text-gray-500">
                    Establishing connection to MCP server
                  </p>
                </div>
              )}

              {/* Error State */}
              {status === "error" && (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Connection Failed
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Unable to reach MCP server
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReconnect();
                      setIsExpanded(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {status === "connected" && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  Model Context Protocol v1.0
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReconnect();
                  }}
                  className="text-[10px] text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MCPStatusBadge;
