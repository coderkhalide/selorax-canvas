"use server";

import OpenAI from "openai";

const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown blocks if present
  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```"))
    cleaned = cleaned.substring(0, cleaned.length - 3);

  // Attempt to find JSON object if there's preamble text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    // Attempt to find JSON array
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  }

  return cleaned.trim();
};

export async function openRouterCompletion(
  apiKey: string,
  model: string,
  messages: any[],
  jsonMode: boolean = false,
) {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL:
      process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ||
      "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_OPENROUTER_SITE_URL || "https://selorax.app",
      "X-Title":
        process.env.NEXT_PUBLIC_OPENROUTER_APP_NAME ||
        "SeloraX Landing Page Builder",
    },
  });

  try {
    // Only use response_format: { type: "json_object" } for known supported models (mostly OpenAI & some mapped ones)
    // For others, we rely on prompt engineering and cleanup.
    // OpenRouter often handles this, but explicit is safer to avoid 400s.
    const isGptModel = model.toLowerCase().includes("gpt");
    const supportsJsonMode = isGptModel || jsonMode;

    // However, some models (like Claude) might return 400 if json_object is passed but not supported in the way OpenAI expects.
    // OpenRouter documentation says they map it, but let's be safe.
    // If the user reports issues, we might want to relax this.
    // Let's try to use it if jsonMode is true, but catch the specific error if it fails.

    let response;
    try {
      response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.7,
        response_format: supportsJsonMode ? { type: "json_object" } : undefined,
      });
    } catch (innerError: any) {
      // If it fails with a 400 about response_format, try again without it
      if (
        innerError?.status === 400 &&
        innerError?.message?.includes("response_format")
      ) {
        console.warn(
          "Model does not support response_format: json_object, retrying without it...",
        );
        response = await openai.chat.completions.create({
          model: model,
          messages: messages,
          temperature: 0.7,
        });
      } else {
        throw innerError;
      }
    }

    const content = response.choices[0]?.message?.content || "";

    if (jsonMode) {
      const cleaned = cleanJsonOutput(content);
      // Validate JSON
      try {
        JSON.parse(cleaned);
        return cleaned;
      } catch (e) {
        console.error("Failed to parse JSON from model response:", content);
        throw new Error(
          "Model returned invalid JSON. Please try again or use a different model.",
        );
      }
    }

    return content;
  } catch (error: any) {
    console.error("OpenRouter Action Error:", error);
    throw new Error(error?.message || "Failed to fetch from OpenRouter");
  }
}

// Tool definition type for OpenRouter
export interface OpenRouterTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<string>;
}

// Streaming chat completion with tool calling support for Funnel Agent
export async function openRouterAgentChat(
  apiKey: string,
  model: string,
  messages: any[],
  tools: OpenRouterTool[],
  onTextDelta: (text: string) => void,
  onToolCall: (toolName: string, args: any) => void,
  onToolResult: (toolName: string, result: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
) {
  if (!apiKey) {
    onError("API Key is required");
    return;
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL:
      process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ||
      "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_OPENROUTER_SITE_URL || "https://selorax.app",
      "X-Title":
        process.env.NEXT_PUBLIC_OPENROUTER_APP_NAME ||
        "SeloraX Landing Page Builder",
    },
  });

  // Convert our tool definitions to OpenAI format
  const openaiTools = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  // Create a map for quick tool lookup
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  try {
    let currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: model,
        messages: currentMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        stream: true,
      });

      let currentContent = "";
      let toolCalls: any[] = [];

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;

        // Handle text content
        if (delta?.content) {
          currentContent += delta.content;
          onTextDelta(delta.content);
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: toolCall.id || "",
                function: { name: "", arguments: "" },
              };
            }
            if (toolCall.id) toolCalls[index].id = toolCall.id;
            if (toolCall.function?.name) {
              toolCalls[index].function.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              toolCalls[index].function.arguments +=
                toolCall.function.arguments;
            }
          }
        }
      }

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        onComplete();
        return;
      }

      // Add assistant message with tool calls
      currentMessages.push({
        role: "assistant",
        content: currentContent || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: tc.function,
        })),
      });

      // Execute each tool call and add results
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const tool = toolMap.get(toolName);

        if (!tool) {
          const errorResult = `Tool "${toolName}" not found.`;
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorResult,
          });
          onToolResult(toolName, errorResult);
          continue;
        }

        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          onToolCall(toolName, args);

          const result = await tool.execute(args);
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
          onToolResult(toolName, result);
        } catch (e: any) {
          const errorResult = `Error executing tool: ${e?.message || "Unknown error"}`;
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorResult,
          });
          onToolResult(toolName, errorResult);
        }
      }

      // Continue the loop to let the model respond to tool results
    }

    onComplete();
  } catch (error: any) {
    console.error("OpenRouter Agent Error:", error);
    onError(error?.message || "Failed to complete agent chat");
  }
}
