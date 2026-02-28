import React, { useState, useRef, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  Clock,
  Loader2,
  Power,
} from "lucide-react";
import { MCPSessionInfo } from "../hooks/useMCPCommandListener";

interface MCPSessionStatusProps {
  isConnected: boolean;
  isInitializing: boolean;
  isEnabled: boolean;
  session: MCPSessionInfo | null;
  onRegenerate: () => Promise<MCPSessionInfo | null>;
  onToggleEnabled: () => void;
}

export const MCPSessionStatus: React.FC<MCPSessionStatusProps> = ({
  isConnected,
  isInitializing,
  isEnabled,
  session,
  onRegenerate,
  onToggleEnabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: "token" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  // Format expiration time
  const formatExpiration = (expiresAt: number) => {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "< 1h remaining";
  };

  // Mask token for display
  const maskToken = (token: string) => {
    if (token.length <= 12) return token;
    return `${token.slice(0, 8)}...${token.slice(-4)}`;
  };

  // Get connection URL
  const getConnectionUrl = () => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/mcp`;
  };

  // Status indicator color
  const getStatusColor = () => {
    if (!isEnabled) return "bg-gray-400";
    if (isInitializing) return "bg-yellow-400";
    if (isConnected) return "bg-green-500";
    return "bg-red-500";
  };

  const getStatusText = () => {
    if (!isEnabled) return "Disabled";
    if (isInitializing) return "Connecting...";
    if (isConnected) return "Connected";
    return "Disconnected";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors"
        title="MCP Session Status"
      >
        {!isEnabled ? (
          <WifiOff className="w-3.5 h-3.5 text-gray-400" />
        ) : isInitializing ? (
          <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
        ) : isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
        )}
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-xs font-medium text-gray-600 hidden sm:inline">
          MCP
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`}
                />
                <span className="text-sm font-medium text-gray-800">
                  {getStatusText()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {session && isEnabled && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatExpiration(session.expiresAt)}</span>
                  </div>
                )}
                <button
                  onClick={onToggleEnabled}
                  className={`p-1.5 rounded-md transition-colors ${
                    isEnabled
                      ? "bg-green-100 text-green-600 hover:bg-green-200"
                      : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                  }`}
                  title={isEnabled ? "Disconnect from Claude" : "Connect to Claude"}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {!isEnabled ? (
              <div className="text-center py-4">
                <WifiOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-1">MCP Connection Disabled</p>
                <p className="text-xs text-gray-400 mb-3">
                  Enable to allow Claude to control this page
                </p>
                <button
                  onClick={onToggleEnabled}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium text-white transition-colors"
                >
                  Connect to Claude
                </button>
              </div>
            ) : session ? (
              <>
                {/* Session Token */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Session Token
                  </label>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs font-mono text-gray-700 truncate cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => setShowToken(!showToken)}
                      title={showToken ? "Click to hide" : "Click to reveal"}
                    >
                      {showToken ? session.token : maskToken(session.token)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(session.token, "token")}
                      className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
                      title="Copy token"
                    >
                      {copied === "token" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Connection URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    MCP Server URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs font-mono text-gray-700 truncate">
                      {getConnectionUrl()}
                    </code>
                    <button
                      onClick={() => copyToClipboard(getConnectionUrl(), "url")}
                      className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
                      title="Copy URL"
                    >
                      {copied === "url" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Claude Desktop Config */}
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                  <p className="text-xs text-blue-800 font-medium mb-1">
                    Claude Desktop Config:
                  </p>
                  <code className="text-[10px] text-blue-700 block whitespace-pre-wrap break-all">
                    {`{
  "funnel-builder": {
    "url": "${getConnectionUrl()}",
    "headers": {
      "Authorization": "Bearer ${session.token}"
    }
  }
}`}
                  </code>
                </div>

                {/* Regenerate Button */}
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 rounded-md text-sm font-medium text-gray-700 disabled:text-gray-400 transition-colors"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRegenerating ? "Regenerating..." : "Regenerate Token"}
                </button>

                {/* Session Info */}
                <div className="text-xs text-gray-400 text-center">
                  Session ID: {session.sessionId}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No active session</p>
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 rounded-md text-sm font-medium text-white transition-colors"
                >
                  {isRegenerating ? "Creating..." : "Create Session"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPSessionStatus;
