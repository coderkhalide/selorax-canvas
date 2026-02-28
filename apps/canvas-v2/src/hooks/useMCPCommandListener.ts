import { useEffect, useRef, useCallback, useState } from "react";
import { useFunnel } from "../context/FunnelContext";
import { useAIActivity } from "../context/AIActivityContext";
import { TOOL_EXECUTORS, ToolContext, AIService, StreamChunk } from "../mcp/executors";

// Import AI service functions from openai.ts
import {
  editComponent,
  editComponentStream,
  smartParsePartialJson,
  optimizeLayout,
  generateLandingPageWithTheme,
  generateLandingPageWithThemeStream,
  generateCopy,
} from "../services/openai";

interface MCPCommand {
  requestId: string;
  type: string;
  payload: any;
  timestamp: number;
  sessionId?: string;
}

// Session info stored in localStorage
export interface MCPSessionInfo {
  sessionId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}

const MCP_SESSION_KEY = "mcp_session";

// Get session from localStorage
function getStoredSession(): MCPSessionInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(MCP_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as MCPSessionInfo;
  } catch {
    return null;
  }
}

// Store session in localStorage
function storeSession(session: MCPSessionInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MCP_SESSION_KEY, JSON.stringify(session));
}

// Clear session from localStorage
function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MCP_SESSION_KEY);
}

// Create a new session via API
async function createSession(): Promise<MCPSessionInfo | null> {
  try {
    const response = await fetch("/api/mcp-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAgent: navigator.userAgent }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const session: MCPSessionInfo = {
      sessionId: data.sessionId,
      token: data.token,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
    storeSession(session);
    return session;
  } catch (error) {
    console.error("[MCP] Failed to create session:", error);
    return null;
  }
}

// Validate existing session
async function validateSession(session: MCPSessionInfo): Promise<MCPSessionInfo | null> {
  try {
    const response = await fetch("/api/mcp-session", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    if (!response.ok) return null;

    const data = await response.json();

    if (data.valid !== true) {
      return null;
    }

    const refreshedSession: MCPSessionInfo = {
      sessionId: data.sessionId || session.sessionId,
      token: data.token || session.token,
      createdAt: data.createdAt || session.createdAt,
      expiresAt: data.expiresAt || session.expiresAt,
    };

    storeSession(refreshedSession);
    return refreshedSession;
  } catch {
    return null;
  }
}

// Send response back to MCP server
async function sendResponse(requestId: string, response: any) {
  try {
    await fetch("/api/mcp-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, response }),
    });
  } catch (error) {
    console.error("[MCP] Failed to send response:", error);
  }
}

/**
 * Hook that listens for MCP commands from Claude Code and executes them.
 * This enables real-time updates from terminal Claude to the browser.
 * Now with session-based authentication and isolation.
 * @param enabled - Whether polling is enabled (default: false, user must opt-in)
 */
export function useMCPCommandListener(enabled: boolean = false) {
  const {
    elements,
    setElements,
    selectedId,
    updateElement,
    addScheme,
    schemes,
    currentSchemeId,
    deleteElement: contextDeleteElement,
  } = useFunnel();

  const { addActivity, removeActivity } = useAIActivity();

  // Session state
  const [session, setSession] = useState<MCPSessionInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const lastTimestampRef = useRef<number>(Date.now());
  const isProcessingRef = useRef<boolean>(false);
  const sessionRef = useRef<MCPSessionInfo | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Create AI service object for tool executors
  const aiService: AIService = {
    editComponent,
    editComponentStream,
    smartParsePartialJson,
    optimizeLayout,
    generateLandingPageWithTheme,
    generateLandingPageWithThemeStream,
    generateCopy,
  };

  // Stream chunk handler - dispatches custom events for UI updates
  // AND publishes to Redis for external clients when sessionId is present
  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    // 1. Dispatch browser event for local UI
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mcp-stream-chunk", { detail: chunk })
      );
    }

    // 2. Publish to Redis for external clients (async, non-blocking)
    const sessionId = sessionRef.current?.sessionId;
    if (sessionId) {
      fetch("/api/mcp-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, chunk }),
      }).catch(err => {
        console.error("[MCP] Failed to publish stream chunk to Redis:", err);
      });
    }
  }, []);

  // Create tool context for executors
  const createToolContext = useCallback((): ToolContext => {
    return {
      elements,
      setElements,
      updateElement,
      deleteElement: contextDeleteElement,
      selectedId,
      schemes,
      currentSchemeId,
      addScheme,
      addActivity,
      removeActivity,
      // Include AI service so AI-powered tools work
      aiService,
      // Session ID for tracking
      sessionId: sessionRef.current?.sessionId,
      // Stream chunk callback for real-time updates
      onStreamChunk: handleStreamChunk,
    };
  }, [
    elements,
    setElements,
    updateElement,
    contextDeleteElement,
    selectedId,
    schemes,
    currentSchemeId,
    addScheme,
    addActivity,
    removeActivity,
    aiService,
    handleStreamChunk,
  ]);

  // Execute a single command using centralized executors
  const executeCommand = useCallback(
    async (cmd: MCPCommand) => {
      console.log(`[MCP] Executing: ${cmd.type}`, cmd.payload);

      // Dispatch debug event for all commands
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("mcp-command", {
            detail: { command: cmd.type, args: cmd.payload },
          }),
        );
      }

      try {
        // Get the executor for this command
        const executor = TOOL_EXECUTORS[cmd.type];

        if (!executor) {
          console.warn(`[MCP] Unknown command: ${cmd.type}`);
          await sendResponse(cmd.requestId, {
            success: false,
            error: `Unknown command: ${cmd.type}`,
          });
          return;
        }

        // Create context for the executor
        const ctx = createToolContext();

        // Execute the tool
        const result = await executor(cmd.payload || {}, ctx);

        // Send response back to MCP server
        await sendResponse(cmd.requestId, result);
      } catch (error) {
        console.error(`[MCP] Command failed:`, error);
        // Send error response if there's a requestId
        if (cmd.requestId) {
          await sendResponse(cmd.requestId, {
            success: false,
            error: String(error),
          });
        }
      }
    },
    [createToolContext],
  );

  // Poll for new commands (session-specific)
  const pollCommands = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!sessionRef.current) return;

    try {
      const response = await fetch("/api/mcp-commands", {
        headers: {
          "X-Session-Id": sessionRef.current.sessionId,
        },
      });

      if (!response.ok) {
        // Session might be invalid
        if (response.status === 401) {
          console.warn("[MCP] Session invalid, will recreate...");
          setIsConnected(false);
        }
        return;
      }

      setIsConnected(true);

      const data = await response.json();
      const command: MCPCommand | null = data.command;

      if (command) {
        isProcessingRef.current = true;
        await executeCommand(command);
        isProcessingRef.current = false;
      }
    } catch {
      isProcessingRef.current = false;
    }
  }, [executeCommand]);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsInitializing(true);

      // Try to get existing session from localStorage
      let existingSession = getStoredSession();

      if (existingSession) {
        // Validate the session is still active
        const validatedSession = await validateSession(existingSession);
        if (validatedSession && isMounted) {
          setSession(validatedSession);
          setIsConnected(true);
          console.log("[MCP] Restored session:", validatedSession.sessionId);
        } else {
          // Session expired or invalid, clear it
          clearStoredSession();
          existingSession = null;
        }
      }

      // Create new session if needed
      if (!existingSession && isMounted) {
        const newSession = await createSession();
        if (newSession && isMounted) {
          setSession(newSession);
          setIsConnected(true);
          console.log("[MCP] Created new session:", newSession.sessionId);
        }
      }

      if (isMounted) {
        setIsInitializing(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Start polling when session is ready and enabled
  // IMPORTANT: Keep polling even when tab is hidden (reduced frequency)
  // because Claude Code sends commands from terminal while browser is in background
  useEffect(() => {
    if (!session || isInitializing || !enabled) return;

    let intervalId: NodeJS.Timeout | null = null;
    let currentInterval = 1000; // 1s when visible

    const startPolling = (interval: number) => {
      if (intervalId) clearInterval(intervalId);
      currentInterval = interval;
      intervalId = setInterval(pollCommands, interval);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Reduce frequency when hidden but DON'T stop - Claude Code needs this
        startPolling(2000); // 2s when hidden
        console.log("[MCP] Tab hidden - reduced polling to 2s");
      } else {
        // Resume fast polling when visible
        startPolling(1000); // 1s when visible
        console.log("[MCP] Tab visible - polling at 1s");
      }
    };

    // Start polling immediately regardless of visibility
    lastTimestampRef.current = Date.now();
    startPolling(document.hidden ? 2000 : 1000);
    console.log("[MCP] Started polling for commands on session:", session.sessionId);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, isInitializing, enabled, pollCommands]);

  // Function to regenerate session token
  const regenerateSession = useCallback(async () => {
    clearStoredSession();
    setSession(null);
    setIsConnected(false);

    const newSession = await createSession();
    if (newSession) {
      setSession(newSession);
      setIsConnected(true);
      console.log("[MCP] Regenerated session:", newSession.sessionId);
    }
    return newSession;
  }, []);

  return {
    isListening: !!session && !isInitializing && enabled,
    isConnected,
    isInitializing,
    session,
    regenerateSession,
  };
}

export default useMCPCommandListener;
