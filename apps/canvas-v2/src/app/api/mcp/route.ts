import { NextRequest, NextResponse } from "next/server";
import { getRedis, REDIS_KEYS, REDIS_TTL } from "@/lib/redis";
import { MCP_TOOLS, MCP_RESOURCES, ELEMENT_TYPES } from "@/mcp/tools";
import {
  validateToken,
  extractBearerToken,
  getCommandQueueKey,
  touchSession,
} from "@/lib/mcp-session";
import { SERVER_SIDE_TOOLS } from "@/mcp/server-tools";

/**
 * Funnel Builder - Remote MCP Server
 *
 * This implements the MCP (Model Context Protocol) over HTTP following the
 * Streamable HTTP transport specification. Clients can connect remotely
 * using just a URL and a session token.
 *
 * Configuration for Claude Desktop / MCP Clients:
 * ```json
 * {
 *   "mcpServers": {
 *     "funnel-builder": {
 *       "type": "streamable-http",
 *       "url": "https://your-domain.com/api/mcp",
 *       "headers": {
 *         "Authorization": "Bearer {YOUR_SESSION_TOKEN}"
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * Get your session token from the browser UI or POST /api/mcp-session
 */

// Server info
const SERVER_INFO = {
  name: "funnel-builder",
  version: "1.0.0",
  protocolVersion: "2024-11-05",
};

// Timeout settings per tool type
const TOOL_TIMEOUTS: Record<string, number> = {
  generateLandingPage: 180000, // 3m for full page generation + streaming fallback
  editElementById: 45000,     // 45s for AI edits
  updateLayout: 45000,        // 45s for layout optimization
  generatePage: 45000,        // 45s for page generation
  default: 35000,             // 35s for everything else
};

// Execute command via Redis queue and wait for response
async function executeCommand(
  tool: string,
  params: any,
  sessionId: string,
  timeout?: number
): Promise<any> {
  const effectiveTimeout = timeout || TOOL_TIMEOUTS[tool] || TOOL_TIMEOUTS.default;
  const redis = getRedis();
  const requestId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Queue the command to session-specific queue
  const command = {
    requestId,
    type: tool,
    payload: params,
    timestamp: Date.now(),
    sessionId,
  };

  const queueKey = getCommandQueueKey(sessionId);
  await redis.lpush(queueKey, JSON.stringify(command));
  await redis.expire(queueKey, REDIS_TTL.COMMAND);

  // Poll for response
  const start = Date.now();
  const responseKey = `${REDIS_KEYS.MCP_RESPONSE}${requestId}`;

  while (Date.now() - start < effectiveTimeout) {
    const data = await redis.getdel(responseKey);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.response;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  throw new Error(
    `Command '${tool}' timeout after ${effectiveTimeout}ms. ` +
    `This tool requires the browser tab to be open and running. ` +
    `Make sure the funnel builder is open in your browser and the MCP connection is enabled.`
  );
}

// Create JSON-RPC response
function jsonRpcResponse(id: string | number | null, result: any) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

// Create JSON-RPC error
function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: any
) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data && { data }),
    },
  };
}

// Handle MCP methods
async function handleMethod(
  method: string,
  params: any,
  id: string | number | null,
  sessionId: string
): Promise<any> {
  switch (method) {
    // ===== Lifecycle Methods =====

    case "initialize": {
      // Return session info - client already authenticated via Bearer token
      return jsonRpcResponse(id, {
        protocolVersion: SERVER_INFO.protocolVersion,
        serverInfo: {
          name: SERVER_INFO.name,
          version: SERVER_INFO.version,
        },
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        sessionId,
      });
    }

    case "initialized": {
      return jsonRpcResponse(id, {});
    }

    case "ping": {
      return jsonRpcResponse(id, {});
    }

    // ===== Tool Methods =====

    case "tools/list": {
      return jsonRpcResponse(id, {
        tools: MCP_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    }

    case "tools/call": {
      const { name, arguments: args } = params || {};

      if (!name) {
        return jsonRpcError(id, -32602, "Tool name is required");
      }

      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) {
        return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
      }

      // Handle local tools that don't need browser round-trip
      if (name === "checkConnection") {
        return jsonRpcResponse(id, {
          content: [
            {
              type: "text",
              text: `Connected to ${SERVER_INFO.name} v${SERVER_INFO.version} (session: ${sessionId})`,
            },
          ],
        });
      }

      if (name === "getElementTypes") {
        return jsonRpcResponse(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({ types: ELEMENT_TYPES }, null, 2),
            },
          ],
        });
      }

      // Handle server-side tools (no browser needed - avoids Redis timeout)
      const serverHandler = SERVER_SIDE_TOOLS[name];
      if (serverHandler) {
        try {
          const result = serverHandler(args || {});
          return jsonRpcResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
        } catch (error) {
          return jsonRpcResponse(id, {
            content: [
              {
                type: "text",
                text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          });
        }
      }

      // Execute in browser via session-specific Redis queue (requires active browser tab)
      try {
        const result = await executeCommand(name, args || {}, sessionId);

        // Handle screenshot response
        if (
          (name === "screenshotElement" || name === "verifyElement") &&
          result?.imageData
        ) {
          return jsonRpcResponse(id, {
            content: [
              { type: "image", data: result.imageData, mimeType: "image/png" },
            ],
          });
        }

        // Handle verify element with screenshot
        if (name === "verifyElement" && result?.screenshot) {
          return jsonRpcResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { exists: result.exists, element: result.element },
                  null,
                  2
                ),
              },
              ...(result.screenshot
                ? [
                    {
                      type: "image",
                      data: result.screenshot,
                      mimeType: "image/png",
                    },
                  ]
                : []),
            ],
          });
        }

        return jsonRpcResponse(id, {
          content: [
            {
              type: "text",
              text: result?.message || JSON.stringify(result, null, 2),
            },
          ],
        });
      } catch (error) {
        return jsonRpcResponse(id, {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        });
      }
    }

    // ===== Resource Methods =====

    case "resources/list": {
      return jsonRpcResponse(id, { resources: MCP_RESOURCES });
    }

    case "resources/read": {
      const { uri } = params || {};
      if (!uri) {
        return jsonRpcError(id, -32602, "Resource URI is required");
      }

      try {
        const result = await executeCommand("getResource", { uri }, sessionId);
        return jsonRpcResponse(id, {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        });
      } catch (error) {
        return jsonRpcError(id, -32603, `Failed to read resource: ${uri}`);
      }
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// CORS headers for remote access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Session-Id",
  "Access-Control-Expose-Headers": "X-Session-Id",
};

/**
 * POST /api/mcp
 *
 * Main MCP endpoint for Streamable HTTP transport.
 * Requires Authorization header with session token.
 *
 * Headers:
 * - Content-Type: application/json
 * - Authorization: Bearer {session_token}
 *
 * Body: JSON-RPC 2.0 request
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and validate Bearer token
    const authHeader = request.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        jsonRpcError(null, -32000, "Authorization header with Bearer token required"),
        { status: 401, headers: corsHeaders }
      );
    }

    const session = await validateToken(token);
    if (!session) {
      return NextResponse.json(
        jsonRpcError(null, -32001, "Invalid or expired session token"),
        { status: 401, headers: corsHeaders }
      );
    }

    // Touch session to update last activity
    await touchSession(session.id);

    const body = await request.json();

    // Handle batch requests (array of messages)
    if (Array.isArray(body)) {
      const responses = await Promise.all(
        body.map(async (msg) => {
          if (msg.jsonrpc !== "2.0") {
            return jsonRpcError(msg.id, -32600, "Invalid JSON-RPC version");
          }
          return handleMethod(msg.method, msg.params, msg.id, session.id);
        })
      );
      return NextResponse.json(responses, { headers: corsHeaders });
    }

    // Handle single request
    const method = body.method;
    const params = body.params || {};
    const id = body.id ?? null;

    if (body.jsonrpc && body.jsonrpc !== "2.0") {
      return NextResponse.json(
        jsonRpcError(id, -32600, "Invalid JSON-RPC version"),
        { headers: corsHeaders }
      );
    }

    if (!method) {
      return NextResponse.json(
        jsonRpcError(id, -32600, "Method is required"),
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await handleMethod(method, params, id, session.id);

    // Add session ID to response headers
    const headers = {
      ...corsHeaders,
      "X-Session-Id": session.id,
    };

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("MCP API Error:", error);
    return NextResponse.json(
      jsonRpcError(null, -32603, "Internal server error", String(error)),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/mcp
 *
 * Server information and SSE stream endpoint.
 *
 * Query params:
 * - ?stream=true - Open SSE stream for server notifications
 * - ?health=true - Health check
 * - (none) - Server info and connection instructions
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // Health check
  if (url.searchParams.get("health") === "true") {
    return NextResponse.json(
      {
        status: "ok",
        server: SERVER_INFO,
        tools: MCP_TOOLS.length,
        resources: MCP_RESOURCES.length,
      },
      { headers: corsHeaders }
    );
  }

  // SSE stream for real-time notifications
  if (url.searchParams.get("stream") === "true") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected", server: SERVER_INFO })}\n\n`
          )
        );

        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }, 30000);

        request.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Default: Return server info and connection instructions
  return NextResponse.json(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocolVersion: SERVER_INFO.protocolVersion,
      description: "Funnel Builder Remote MCP Server",
      status: "ready",

      // Authentication info
      authentication: {
        type: "Bearer",
        header: "Authorization",
        tokenEndpoint: `${url.origin}/api/mcp-session`,
        instructions: "1. POST to /api/mcp-session to get a token, 2. Include 'Authorization: Bearer {token}' header in all MCP requests",
      },

      // Connection instructions
      connection: {
        type: "streamable-http",
        url: `${url.origin}/api/mcp`,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer {YOUR_SESSION_TOKEN}",
        },
      },

      // Claude Desktop configuration
      claudeDesktopConfig: {
        mcpServers: {
          "funnel-builder": {
            type: "streamable-http",
            url: `${url.origin}/api/mcp`,
            headers: {
              "Authorization": "Bearer {YOUR_SESSION_TOKEN}",
            },
          },
        },
      },

      // Available methods
      methods: [
        "initialize",
        "initialized",
        "ping",
        "tools/list",
        "tools/call",
        "resources/list",
        "resources/read",
      ],

      // Available tools
      tools: MCP_TOOLS.map((t) => t.name),

      // Available resources
      resources: MCP_RESOURCES.map((r) => r.uri),

      // Endpoints
      endpoints: {
        "POST /api/mcp": "JSON-RPC 2.0 endpoint (requires Bearer token)",
        "POST /api/mcp-session": "Create new session token",
        "GET /api/mcp-session": "Validate session token",
        "GET /api/mcp": "Server info (this page)",
        "GET /api/mcp?health=true": "Health check",
        "GET /api/mcp?stream=true": "SSE stream for notifications",
      },
    },
    { headers: corsHeaders }
  );
}

/**
 * DELETE /api/mcp
 *
 * Close/revoke session (redirects to session endpoint)
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json(
      { error: "Authorization header required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const session = await validateToken(token);
  if (!session) {
    return NextResponse.json(
      { success: true, message: "Session already invalid or expired" },
      { headers: corsHeaders }
    );
  }

  // Import revokeSession dynamically to avoid circular dependency
  const { revokeSession } = await import("@/lib/mcp-session");
  await revokeSession(session.id);

  return NextResponse.json(
    { success: true, message: "Session revoked" },
    { headers: corsHeaders }
  );
}

/**
 * OPTIONS /api/mcp
 *
 * CORS preflight handler.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: corsHeaders,
  });
}
