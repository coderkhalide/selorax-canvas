import React, { useState, useCallback, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { getRuntimeApiKey } from "../services/runtimeApiKey";
import { z } from "zod";
import { useFunnel } from "../context/FunnelContext";
import { useAIActivity } from "../context/AIActivityContext";
import * as geminiService from "../services/gemini";
import * as openaiService from "../services/openai";
import { getOpenRouterModel } from "../services/openai";
import { generateSchemeFromBaseColor } from "../utils/themeGenerator";

// Import centralized MCP tools and executors
import { MCP_TOOLS, MCP_RESOURCES } from "../mcp/tools";
import { TOOL_EXECUTORS, ToolContext, AIService } from "../mcp/executors";

// Define UI Message type
export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolInvocations?: Array<{
    state: "call" | "result";
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
  }>;
  tool_calls?: any[];
  tool_call_id?: string;
  attachments?: string[];
}

// Define Thinking Step type for Chain of Thought UI
export interface ThinkingStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
}

// System prompt for the MCP-powered agent
const SYSTEM_PROMPT = `You are an intelligent, autonomous Funnel Builder Agent powered by MCP (Model Context Protocol).

YOUR PROCESS (The "Todo List" Approach):
1. **ANALYZE:** When a user gives a command, break it down. "Make the hero section blue" -> Find hero -> Update style.
2. **EXPLORE:** Use tools like 'getCapabilities' or 'getDesignSystem' if you need context.
3. **LOCATE:** If the user talks about a specific element (e.g. "the pricing header") but hasn't selected it, use 'findElement' to get its ID.
4. **SHOW ACTIVITY:** Use 'aiActivityStart' to show visual feedback before editing.
5. **EXECUTE:** Use 'editElementById' or 'updateCopy' to make changes.
6. **CLEAR ACTIVITY:** Use 'aiActivityEnd' to clear visual feedback after editing.
7. **STOP:** Tell user it's done. Do NOT verify or screenshot (causes loops that make designs worse).

=== PAGE GENERATION (INTELLIGENT WORKFLOW) ===
When creating a new landing page, 'generateLandingPage' is SELF-THINKING:
- It automatically analyzes content to detect industry (SaaS, ecommerce, consulting, etc.)
- Selects the right psychology framework (AIDA for SaaS, PAS for ecommerce, 4Ps for coaching)
- Generates UNIQUE layout combinations each time (different hero, features, CTA styles)
- Uses concrete design templates - not generic patterns

For maximum creativity, you can:
1. Use think() first to reason about the content and audience
2. Call createDesignStrategy() to preview the layout decisions
3. Call generateLandingPage() - it applies intelligent layouts automatically

Each generation produces a DIFFERENT design. Tell users about the design choices made!

MCP TOOLS AVAILABLE:
- 'generateLandingPage': Creates UNIQUE landing pages - self-thinking, different layouts each time
- 'createDesignStrategy': Preview design decisions before generating
- 'getCapabilities': Lists all available custom components
- 'getDesignSystem': Gets current theme colors/fonts
- 'findElement': Searches elements by type or text content
- 'editElementById': Modifies a specific element by ID (AI-powered)
- 'editElement': Modifies the currently selected element (AI-powered)
- 'updateLayout': Updates the entire page layout (AI-powered)
- 'updateCopy': Generates text content (AI-powered)
- 'think': For planning and reasoning
- 'setElements': Replace all page elements
- 'addElement': Add a single element
- 'updateElement': Update element properties
- 'deleteElement': Remove an element
- 'changeTheme': Change color theme
- 'setHeadline': Update headline text
- 'setButtonText': Update button text
- 'setImageUrl': Update image URL
- 'screenshotElement': Capture element screenshot
- 'verifyElement': Verify element exists and get its current state
- 'getCurrentElements': Get current page structure
- 'aiActivityStart': Show visual loading feedback on an element (REQUIRED before editing)
- 'aiActivityEnd': Clear visual feedback after editing (REQUIRED after editing)
- 'getSelectedElement': Get info about the currently selected element
- 'getParentSection': Get the parent section containing an element
- 'searchIcon': Search for Lucide icons by concept/keyword. ALWAYS use this instead of emojis!

MCP RESOURCES AVAILABLE:
- funnel://components - All custom components
- funnel://elements - Current page elements
- funnel://theme - Current color scheme
- funnel://selected - Currently selected element

VISUAL FEEDBACK WORKFLOW (IMPORTANT):
When modifying any element, follow this pattern:
1. aiActivityStart({ elementId: "target-id", activityType: "updating", description: "What you're doing" })
2. [Your editing tool call - editElementById, updateElement, etc.]
3. aiActivityEnd({ elementId: "target-id", success: true })
4. DONE - Stop here! Do NOT verify or screenshot unless user asks.

Example: User says "make the button blue"
1. findElement({ type: "button" }) -> get button ID
2. aiActivityStart({ elementId: "btn-123", activityType: "updating", description: "Changing button to blue" })
3. editElementById({ id: "btn-123", instruction: "change background color to blue" })
4. aiActivityEnd({ elementId: "btn-123", success: true })
5. STOP - Tell user it's done. DO NOT take screenshot or verify.

CRITICAL RULES:
1. ACTION-FIRST: Do not ask for permission or clarification unless absolutely necessary.
2. BE CONCISE: Keep your responses short.
3. GRANULARITY: Prefer 'editElementById' over regenerating the whole page.
4. CONTEXT AWARE: You have access to the selected element. Use it to infer intent.
5. VISUAL FEEDBACK: ALWAYS use aiActivityStart/aiActivityEnd when editing elements.
6. DO NOT VERIFY/SCREENSHOT: After completing a task, STOP. Do not take screenshots or verify unless user explicitly asks. Verification loops make designs worse.
7. ICONS NOT EMOJIS: NEVER use emojis. Use 'searchIcon' to find Lucide icons.
8. ONE AND DONE: Complete the task once and stop. Do not iterate or "improve" without user request.

DESIGN QUALITY (Apply to EVERY edit and generation):
- SPACING: Section padding min 80px top/bottom. Element gaps 16-24px. Generous whitespace.
- TYPOGRAPHY: Hero headlines 48-64px bold, lineHeight 1.1. Body 16-18px, lineHeight 1.6. Section titles 32-40px.
- VISUAL DEPTH: Cards need box-shadow (0 4px 20px rgba(0,0,0,0.08)). Buttons border-radius 8-12px. Images border-radius 12-16px.
- COLORS: Use CSS variables only. 60-30-10 rule (60% bg, 30% secondary, 10% accent/CTA).
- HIERARCHY: One dominant headline per section. Muted support text. Primary color CTAs.
- SPECIFICITY: When calling editElementById, include CONCRETE CSS values in your instruction (e.g., "set padding to 80px 24px, fontSize 48px, fontWeight 700, add boxShadow 0 4px 20px rgba(0,0,0,0.08)").

ICON SELECTION (CRITICAL):
- Icons MUST match the content meaning
- "Fast Delivery" → "Truck"
- "100% Authentic" → "BadgeCheck"
- "Easy Returns" → "Undo2"
- "24/7 Support" → "Headphones"
- "Secure Payment" → "Lock"
- "Free Shipping" → "Package"
- Use 'searchIcon' tool to find the right icon for the content!`;

interface UseFunnelAgentMCPOptions {
  pageId?: string;
  tenantId?: string;
}

export function useFunnelAgentMCP({ pageId, tenantId }: UseFunnelAgentMCPOptions = {}) {
  const {
    elements,
    setElements,
    selectedId: selectedElementId,
    updateElement,
    addScheme,
    aiProvider,
    schemes,
    currentSchemeId,
    deleteElement,
  } = useFunnel();

  const { addActivity, removeActivity } = useAIActivity();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("connected"); // Always connected since we use local executors
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpTools, setMcpTools] = useState<{ name: string; description: string }[]>([]);
  const [mcpResources, setMcpResources] = useState<{ uri: string; name: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Google GenAI client - created lazily when needed
  const getGoogleClient = useCallback(() => {
    const apiKey = getRuntimeApiKey("gemini");
    if (!apiKey) {
      throw new Error("Missing Gemini API key");
    }
    return new GoogleGenAI({ apiKey });
  }, []);

  // AI service based on provider
  const aiService: AIService = aiProvider === "openai" ? openaiService : geminiService;

  // Initialize MCP tools list on mount
  useEffect(() => {
    // Set tools from centralized definitions
    setMcpTools(MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })));
    setMcpResources(MCP_RESOURCES.map((r) => ({ uri: r.uri, name: r.name })));
    setMcpStatus("connected");
  }, []);

  // Create tool context for executors
  const createToolContext = useCallback((): ToolContext => {
    return {
      elements,
      setElements,
      updateElement,
      deleteElement,
      selectedId: selectedElementId,
      schemes,
      currentSchemeId,
      addScheme,
      aiService,
      addActivity,
      removeActivity,
      addThinkingStep: (step) => {
        setThinkingSteps((prev) => [...prev, step]);
      },
    };
  }, [
    elements,
    setElements,
    updateElement,
    deleteElement,
    selectedElementId,
    schemes,
    currentSchemeId,
    addScheme,
    aiService,
    addActivity,
    removeActivity,
  ]);

  // Tools that modify elements and should show visual feedback
  const MODIFICATION_TOOLS = [
    'editElementById',
    'editElement',
    'updateElement',
    'updateLayout',
    'setElements',
    'addElement',
    'deleteElement',
    'setHeadline',
    'setButtonText',
    'setImageUrl',
    'changeTheme',
    'generateLandingPage',
    'generatePage',
  ];

  // Execute a tool by name using centralized executors
  // Automatically wraps modification tools with aiActivityStart/aiActivityEnd for visual feedback
  const executeTool = useCallback(
    async (name: string, args: any): Promise<any> => {
      const startTime = Date.now();

      // Debug: Dispatch tool call event
      if (typeof window !== "undefined") {
        console.log(`[Agent] 🔧 Tool Call: ${name}`, args);
        window.dispatchEvent(
          new CustomEvent("agent-tool-call", {
            detail: { tool: name, args, timestamp: startTime, provider: aiProvider },
          })
        );
      }

      const executor = TOOL_EXECUTORS[name];
      if (!executor) {
        const error = { success: false, error: `Unknown tool: ${name}` };
        console.error(`[Agent] ❌ Unknown tool: ${name}`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("agent-tool-result", {
              detail: { tool: name, args, result: error, duration: Date.now() - startTime, success: false },
            })
          );
        }
        return error;
      }

      const ctx = createToolContext();

      // Page-level tools that don't have an elementId but should still show activity
      const PAGE_LEVEL_TOOLS = ['generateLandingPage', 'generatePage', 'setElements'];
      const isPageLevelTool = PAGE_LEVEL_TOOLS.includes(name);

      // Determine element ID for activity tracking
      const elementId = args.id || args.elementId || ctx.selectedId;
      // Show activity for page-level tools OR element-level modifications
      const shouldShowActivity = MODIFICATION_TOOLS.includes(name) && (elementId || isPageLevelTool);

      // For page-level tools, use a placeholder ID
      const activityId = isPageLevelTool ? 'page-generation' : elementId;

      // Activity descriptions for page-level tools
      const pageToolDescriptions: Record<string, string> = {
        generateLandingPage: '🚀 Generating landing page...',
        generatePage: '📄 Building page layout...',
        setElements: '✨ Updating page structure...',
      };

      // Show activity before modification
      if (shouldShowActivity) {
        try {
          await TOOL_EXECUTORS.aiActivityStart?.(
            {
              elementId: isPageLevelTool ? null : elementId,
              placeholderId: isPageLevelTool ? activityId : undefined,
              activityType: isPageLevelTool ? 'generating' : 'updating',
              description: pageToolDescriptions[name] || `Running ${name}`,
            },
            ctx
          );
        } catch (e) {
          // Don't fail if activity tracking fails
          console.warn('[Agent] Failed to start activity:', e);
        }
      }

      try {
        const result = await executor(args, ctx);
        const duration = Date.now() - startTime;

        // Debug: Dispatch tool result event
        if (typeof window !== "undefined") {
          const resultPreview = typeof result === 'string'
            ? result.slice(0, 100)
            : JSON.stringify(result).slice(0, 100);
          console.log(`[Agent] ✅ Tool Result: ${name} (${duration}ms)`, resultPreview);
          window.dispatchEvent(
            new CustomEvent("agent-tool-result", {
              detail: { tool: name, args, result, duration, success: true },
            })
          );
        }

        // Clear activity after modification
        if (shouldShowActivity) {
          try {
            await TOOL_EXECUTORS.aiActivityEnd?.(
              {
                elementId: isPageLevelTool ? null : elementId,
                placeholderId: isPageLevelTool ? activityId : undefined,
                success: result?.success !== false,
              },
              ctx
            );
          } catch (e) {
            console.warn('[Agent] Failed to end activity:', e);
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Debug: Dispatch error event
        if (typeof window !== "undefined") {
          console.error(`[Agent] ❌ Tool Error: ${name} (${duration}ms)`, error);
          window.dispatchEvent(
            new CustomEvent("agent-tool-result", {
              detail: { tool: name, args, error: String(error), duration, success: false },
            })
          );
        }

        // Clear activity on error
        if (shouldShowActivity) {
          try {
            await TOOL_EXECUTORS.aiActivityEnd?.(
              {
                elementId: isPageLevelTool ? null : elementId,
                placeholderId: isPageLevelTool ? activityId : undefined,
                success: false,
              },
              ctx
            );
          } catch (e) {
            console.warn('[Agent] Failed to end activity on error:', e);
          }
        }
        throw error;
      }
    },
    [createToolContext, aiProvider]
  );

  // Helper to get selected element context
  const getSelectedElementContext = useCallback(() => {
    if (!selectedElementId) return null;
    const findElement = (els: any[]): any => {
      for (const el of els) {
        if (el.id === selectedElementId) return el;
        if (el.children) {
          const found = findElement(el.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findElement(elements);
  }, [selectedElementId, elements]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const addThinkingStep = (
    label: string,
    status: ThinkingStep["status"] = "running",
    details?: string
  ) => {
    const id = Date.now().toString() + Math.random().toString();
    setThinkingSteps((prev) => [...prev, { id, label, status, details }]);
    return id;
  };

  const updateThinkingStep = (id: string, updates: Partial<ThinkingStep>) => {
    setThinkingSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  // Get OpenAI-compatible tool definitions from MCP_TOOLS
  const getOpenAITools = useCallback(() => {
    return MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }, []);

  // Process message with OpenRouter (Client-Side Agent Loop with MCP)
  const processWithOpenRouter = async (
    content: string,
    contextMsg: string,
    attachments?: string[]
  ) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const apiKey = getRuntimeApiKey("openai");
    const model = getOpenRouterModel();
    const openAiTools = getOpenAITools();

    // Initial message construction with multimodal support
    const currentUserMessageContent: any[] = [
      { type: "text", text: content + contextMsg },
    ];
    if (attachments && attachments.length > 0) {
      attachments.forEach((url) => {
        currentUserMessageContent.push({
          type: "image_url",
          image_url: { url: url },
        });
      });
    }

    let conversationHistory: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => {
        const msg: any = { role: m.role };

        if (m.attachments && m.attachments.length > 0 && m.role === "user") {
          const parts: any[] = [{ type: "text", text: m.content }];
          m.attachments.forEach((url) => {
            parts.push({ type: "image_url", image_url: { url } });
          });
          msg.content = parts;
        } else {
          msg.content = m.content;
        }

        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        return msg;
      }),
      { role: "user", content: currentUserMessageContent },
    ];

    let maxIterations = 5;
    let iterationCount = 0;

    // Agent Loop with MCP tools
    while (iterationCount < maxIterations) {
      iterationCount++;
      try {
        const response = await fetch("/api/funnel-agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tenantId ? { "x-tenant-id": tenantId } : {}),
          },
          body: JSON.stringify({
            messages: conversationHistory,
            model,
            apiKey,
            tools: openAiTools,
            pageId,
            tenantId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("OpenRouter Proxy Error Response:", errorText);
          throw new Error(
            `Failed to fetch from OpenRouter Proxy: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
        if (!response.body)
          throw new Error("ReadableStream not supported by browser");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let toolCallsBuffer: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.content) {
                  fullContent += data.content;
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === "assistant" && !last.tool_calls) {
                      return [
                        ...prev.slice(0, -1),
                        { ...last, content: fullContent },
                      ];
                    } else {
                      return [
                        ...prev,
                        {
                          id: Date.now().toString(),
                          role: "assistant",
                          content: fullContent,
                        },
                      ];
                    }
                  });
                }

                if (data.tool_calls) {
                  for (const tc of data.tool_calls) {
                    const index = tc.index;
                    if (!toolCallsBuffer[index]) {
                      toolCallsBuffer[index] = {
                        id: tc.id || "",
                        type: "function",
                        function: { name: "", arguments: "" },
                      };
                    }
                    if (tc.id) toolCallsBuffer[index].id = tc.id;
                    if (tc.function?.name)
                      toolCallsBuffer[index].function.name = tc.function.name;
                    if (tc.function?.arguments)
                      toolCallsBuffer[index].function.arguments +=
                        tc.function.arguments;
                  }
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }

        // If no tool calls, we are done
        if (toolCallsBuffer.length === 0) {
          break;
        }

        // We have tool calls
        conversationHistory.push({
          role: "assistant",
          content: fullContent || null,
          tool_calls: toolCallsBuffer,
        });

        // Execute MCP tools locally using centralized executors
        for (const toolCall of toolCallsBuffer) {
          const toolName = toolCall.function.name;
          const toolId = toolCall.id;

          addThinkingStep(`MCP Tool: ${toolName}`, "running");

          let resultStr = "";
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeTool(toolName, args);
            resultStr =
              typeof result === "string" ? result : JSON.stringify(result);
          } catch (e: any) {
            resultStr = `Error executing MCP tool: ${e.message}`;
          }

          // Complete thinking step
          setThinkingSteps((prev) => {
            const lastRunning = [...prev]
              .reverse()
              .find((s) => s.status === "running");
            if (lastRunning) {
              return prev.map((s) =>
                s.id === lastRunning.id
                  ? {
                      ...s,
                      status: "completed",
                      details: `Result: ${resultStr.slice(0, 50)}...`,
                    }
                  : s
              );
            }
            return prev;
          });

          // Add result to history for recursion
          conversationHistory.push({
            role: "tool",
            tool_call_id: toolId,
            content: resultStr,
          });
        }

        // Loop continues to next iteration
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("MCP Agent Loop Error:", err);
        addThinkingStep("Error in MCP Agent Loop", "failed", err.message);
        break;
      }
    }

    setIsLoading(false);
    setIsThinking(false);
  };

  // Build Gemini tool schemas (NO execute functions - we handle execution manually)
  const buildGeminiToolSchemas = useCallback(() => {
    return {
      getCapabilities: {
        description: "Get a list of all available custom components and their capabilities",
        inputSchema: z.object({ reason: z.string().optional() }),
      },
      getDesignSystem: {
        description: "Get the current design system (colors, fonts, etc.)",
        inputSchema: z.object({ reason: z.string().optional() }),
      },
      findElement: {
        description: "Find an element by its type or content text. Returns a list of matching elements with their IDs",
        inputSchema: z.object({
          type: z.string().optional(),
          name: z.string().optional(),
          content: z.string().optional(),
        }),
      },
      editElementById: {
        description: "Edit ANY element by its ID using AI. Use findElement first to get the ID if needed",
        inputSchema: z.object({
          id: z.string(),
          instruction: z.string(),
        }),
      },
      editElement: {
        description: "Edit the properties or style of the currently selected element using AI",
        inputSchema: z.object({ instruction: z.string() }),
      },
      updateLayout: {
        description: "Update or optimize the entire funnel layout using AI",
        inputSchema: z.object({ instruction: z.string() }),
      },
      generateLandingPage: {
        description: "Generate a complete landing page from scratch using AI",
        inputSchema: z.object({
          content: z.string(),
          color: z.string().optional(),
        }),
      },
      updateCopy: {
        description: "Generate or update text copy using AI",
        inputSchema: z.object({
          prompt: z.string(),
          context: z.string().optional(),
        }),
      },
      think: {
        description: "A tool for thinking, planning, and reasoning before taking action",
        inputSchema: z.object({ thought: z.string() }),
      },
      setElements: {
        description: "Replace all elements in the funnel builder with a new set of elements",
        inputSchema: z.object({
          elements: z.array(z.any()),
        }),
      },
      updateElement: {
        description: "Update a specific element by ID",
        inputSchema: z.object({
          id: z.string(),
          updates: z.any(),
        }),
      },
      deleteElement: {
        description: "Delete an element by ID",
        inputSchema: z.object({
          elementId: z.string(),
        }),
      },
      changeTheme: {
        description: "Change the color theme of the entire funnel",
        inputSchema: z.object({
          color: z.string(),
        }),
      },
      setHeadline: {
        description: "Set or update a headline text in the funnel",
        inputSchema: z.object({
          text: z.string(),
          elementId: z.string().optional(),
        }),
      },
      setButtonText: {
        description: "Set or update a button text in the funnel",
        inputSchema: z.object({
          text: z.string(),
          elementId: z.string().optional(),
        }),
      },
      getCurrentElements: {
        description: "Get the current page structure with all elements",
        inputSchema: z.object({
          includeStyles: z.boolean().optional(),
        }),
      },
      verifyElement: {
        description: "Verify that an element exists and is valid",
        inputSchema: z.object({
          elementId: z.string(),
          includeScreenshot: z.boolean().optional(),
        }),
      },
      screenshotElement: {
        description: "Take a screenshot of a specific element by ID and return base64 image data",
        inputSchema: z.object({
          elementId: z.string(),
          scale: z.number().optional(),
        }),
      },
      aiActivityStart: {
        description: "Show visual feedback that AI is working on an element (blue overlay)",
        inputSchema: z.object({
          elementId: z.string().optional(),
          activityType: z.enum(["creating", "updating", "generating"]),
          description: z.string().optional(),
          placeholderId: z.string().optional(),
        }),
      },
      aiActivityEnd: {
        description: "Clear visual feedback after AI finishes working",
        inputSchema: z.object({
          elementId: z.string().optional(),
          placeholderId: z.string().optional(),
          success: z.boolean(),
        }),
      },
      addElement: {
        description: "Add a single element to the funnel",
        inputSchema: z.object({
          element: z.any(),
          parentId: z.string().optional(),
        }),
      },
      setImageUrl: {
        description: "Set or update an image element's URL",
        inputSchema: z.object({
          url: z.string(),
          elementId: z.string().optional(),
          alt: z.string().optional(),
        }),
      },
      getSelectedElement: {
        description: "Get detailed info about the currently selected element in the UI",
        inputSchema: z.object({}),
      },
      getParentSection: {
        description: "Get the full parent section containing the specified element",
        inputSchema: z.object({
          elementId: z.string().optional(),
        }),
      },
      generatePage: {
        description: "Generate a complete landing page with elements array",
        inputSchema: z.object({
          elements: z.array(z.any()),
          themeColor: z.string().optional(),
          themeName: z.string().optional(),
        }),
      },
      checkConnection: {
        description: "Check if the funnel builder is connected and accessible",
        inputSchema: z.object({}),
      },
      getElementTypes: {
        description: "Get a list of available element types",
        inputSchema: z.object({}),
      },
      searchIcon: {
        description: "Search for Lucide icons by concept, keyword, or use case. ALWAYS use this tool to find the right icon instead of using emojis. Returns icon names in PascalCase format ready to use in icon elements.",
        inputSchema: z.object({
          query: z.string(),
          category: z.enum(["all", "speed", "security", "analytics", "design", "communication", "navigation", "status", "media", "commerce", "social"]).optional(),
        }),
      },
    };
  }, []);

  // Process message with Gemini using @google/genai SDK
  const processWithGemini = async (
    content: string,
    contextMsg: string,
    attachments?: string[]
  ) => {
    const modelsToTry = [
      "gemini-2.5-flash",
    ];

    // Build tool declarations for Gemini (cast to any for SDK compatibility)
    const toolDeclarations: any[] = MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));

    // Build conversation history for Gemini format
    const validMessages = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    const historyContents: any[] = validMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Current user message
    const userParts: any[] = [{ text: content + contextMsg }];
    if (attachments && attachments.length > 0) {
      for (const url of attachments) {
        userParts.push({
          inlineData: {
            data: url.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/png",
          },
        });
      }
    }

    const maxIterations = 5;
    let lastError: any = null;

    // Try models in order
    for (const modelName of modelsToTry) {
      // Reset iteration count for each model attempt
      let iterationCount = 0;

      try {
        console.log(`[Gemini] Trying model: ${modelName}`);
        const client = getGoogleClient();

        // Build fresh contents array for each model attempt
        let contents: any[] = [
          ...historyContents,
          { role: "user", parts: userParts },
        ];

        // MANUAL AGENT LOOP WITH STREAMING
        while (iterationCount < maxIterations) {
          iterationCount++;
          console.log(`[Gemini] Iteration ${iterationCount}/${maxIterations}`);

          // Call Gemini with streaming
          const stream = await client.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [{ functionDeclarations: toolDeclarations }],
            },
          });

          // Process stream for real-time updates
          let textResponse = "";
          const functionCalls: any[] = [];
          const allParts: any[] = [];
          const messageId = Date.now().toString();

          // Create assistant message placeholder for streaming
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              content: "",
            },
          ]);

          for await (const chunk of stream) {
            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];

            for (const part of parts) {
              allParts.push(part);

              if (part.text) {
                textResponse += part.text;
                // Update UI in real-time with each text chunk
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.findIndex((m) => m.id === messageId);
                  if (lastIdx !== -1) {
                    updated[lastIdx] = { ...updated[lastIdx], content: textResponse };
                  }
                  return updated;
                });
              }

              if (part.functionCall) {
                functionCalls.push(part.functionCall);
              }
            }
          }

          // Remove empty message if no text response
          if (!textResponse && functionCalls.length > 0) {
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          }

          // No function calls? We're done
          if (functionCalls.length === 0) {
            console.log("[Gemini] No more function calls, agent loop complete");
            return; // Success
          }

          console.log(`[Gemini] Executing ${functionCalls.length} tool(s)...`);

          // Add model response to contents
          contents.push({
            role: "model",
            parts: allParts,
          });

          // Execute each function call
          const functionResponses: any[] = [];

          for (const fc of functionCalls) {
            const toolName = fc.name;
            const toolArgs = fc.args || {};

            const stepId = addThinkingStep(`MCP Tool: ${toolName}`, "running");

            try {
              const toolResult = await executeTool(toolName, toolArgs);
              const resultStr = typeof toolResult === "string"
                ? toolResult
                : JSON.stringify(toolResult);

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { result: resultStr },
                },
              });

              updateThinkingStep(stepId, {
                status: "completed",
                details: `Result: ${resultStr.slice(0, 50)}${resultStr.length > 50 ? "..." : ""}`,
              });

              console.log(`[Gemini] Tool ${toolName} completed`);
            } catch (e: any) {
              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { error: e.message || String(e) },
                },
              });

              updateThinkingStep(stepId, {
                status: "failed",
                details: e.message || String(e),
              });

              console.error(`[Gemini] Tool ${toolName} failed:`, e);
            }
          }

          // Add function responses to contents
          contents.push({
            role: "user",
            parts: functionResponses,
          });

          // Loop continues
        }

        console.log("[Gemini] Max iterations reached");
        return; // Success

      } catch (e: any) {
        console.error(`[Gemini] Model ${modelName} failed:`, e);
        lastError = e;

        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          addThinkingStep(
            `All models failed. Last error: ${e.message}`,
            "failed"
          );
        } else {
          addThinkingStep(
            `Model ${modelName} failed, retrying with fallback...`,
            "running"
          );
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  };

  const processMessage = async (content: string, attachments?: string[]) => {
    const apiKey = getRuntimeApiKey(aiProvider);
    if (!apiKey) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: `Please enter ${aiProvider === "openai" ? "an OpenRouter" : "a Gemini"} API key.`,
              type: "error",
            },
          })
        );
      }
      return;
    }
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: content,
      attachments: attachments,
    };

    let contextMsg = "";
    const selectedEl = getSelectedElementContext();
    if (selectedEl) {
      contextMsg = `\n\n[Context: User has selected element: ${JSON.stringify(selectedEl)}]`;
    }

    // Add MCP context
    contextMsg += `\n[MCP Status: Connected - ${MCP_TOOLS.length} tools available]`;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsThinking(true);
    setThinkingSteps([]);

    addThinkingStep("Analyzing request via MCP...", "completed");

    // Handle theme color detection
    const lower = content.toLowerCase();
    const mentionsTheme =
      lower.includes("theme") ||
      lower.includes("color") ||
      lower.includes("থিম");
    let colorCandidate: string | null = null;
    const hexMatch = content.match(/#([0-9a-fA-F]{3,8})\b/);
    if (hexMatch) colorCandidate = hexMatch[0];
    if (!colorCandidate) {
      const rgbMatch = content.match(/rgba?\([^)]+\)/i);
      if (rgbMatch) colorCandidate = rgbMatch[0];
    }
    if (!colorCandidate) {
      const names = [
        "blue", "green", "red", "orange", "purple", "pink", "indigo",
        "teal", "cyan", "amber", "lime", "emerald", "violet", "sky",
        "rose", "brown", "black", "white", "gray", "নীল", "সবুজ", "লাল",
      ];
      for (const n of names) {
        if (lower.includes(n)) {
          colorCandidate = n;
          break;
        }
      }
    }
    if (mentionsTheme && colorCandidate) {
      const stepId = addThinkingStep("Generating theme from color", "running");
      const scheme = generateSchemeFromBaseColor(
        colorCandidate,
        `Auto ${colorCandidate}`,
        "theme-ai-generated"
      );
      if (scheme) {
        addScheme(scheme, true);
        updateThinkingStep(stepId, {
          status: "completed",
          details: `Applied ${scheme.name}`,
        });
      } else {
        updateThinkingStep(stepId, {
          status: "failed",
          details: "Invalid color",
        });
      }
    }

    try {
      if (aiProvider === "openai") {
        await processWithOpenRouter(content, contextMsg, attachments);
      } else {
        await processWithGemini(content, contextMsg, attachments);
        setIsLoading(false);
        setIsThinking(false);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I encountered an error.",
        },
      ]);
      addThinkingStep("System Error", "failed", String(e));
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, attachments?: string[]) => {
    e?.preventDefault();
    processMessage(input, attachments);
  };

  const clearMessages = () => {
    setMessages([]);
    setThinkingSteps([]);
  };

  // Initialize MCP (now just sets status since we use local executors)
  const initializeMCP = useCallback(async () => {
    setMcpStatus("connected");
    setMcpTools(MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })));
    setMcpResources(MCP_RESOURCES.map((r) => ({ uri: r.uri, name: r.name })));
  }, []);

  return {
    // Original API
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    clearMessages,
    thinkingSteps,
    isThinking,
    processMessage,

    // MCP-specific API
    mcpStatus,
    mcpError,
    mcpTools,
    mcpResources,
    initializeMCP,

    // Tool execution
    executeTool,
  };
}
