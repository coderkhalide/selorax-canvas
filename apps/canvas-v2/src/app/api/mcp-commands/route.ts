import { NextRequest, NextResponse } from "next/server";
import { getRedis, REDIS_KEYS, REDIS_TTL } from "@/lib/redis";
import { getCommandQueueKey, getSession } from "@/lib/mcp-session";

/**
 * MCP Commands Queue API
 *
 * This API manages the command queue between the MCP HTTP server and the browser.
 * Commands are now session-specific to isolate different browser sessions.
 *
 * Commands flow: MCP Server -> Redis Queue (session-specific) -> Browser
 */

export interface MCPCommand {
  requestId: string;
  type: string;
  payload: any;
  timestamp: number;
  sessionId?: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
};

/**
 * GET /api/mcp-commands
 *
 * Fetch pending commands for a browser session.
 * Requires X-Session-Id header to identify the browser session.
 *
 * Headers:
 *   X-Session-Id: {sessionId}
 *
 * Response:
 * {
 *   command: MCPCommand | null,
 *   timestamp: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get("x-session-id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "X-Session-Id header required", command: null },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid session", command: null },
        { status: 401, headers: corsHeaders }
      );
    }

    const redis = getRedis();
    const queueKey = getCommandQueueKey(sessionId);

    // Pop command from session-specific queue (FIFO order)
    const data = await redis.rpop(queueKey);

    if (!data) {
      return NextResponse.json(
        { command: null, timestamp: Date.now() },
        { headers: corsHeaders }
      );
    }

    const command = JSON.parse(data) as MCPCommand;
    console.log(`[MCP Command] Popped: ${command.type} (${command.requestId}) for session ${sessionId}`);

    return NextResponse.json(
      { command, timestamp: Date.now() },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("MCP Command GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch command", command: null },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mcp-commands
 *
 * Add new command to a session's queue.
 * Used internally by MCP server or for testing.
 *
 * Body:
 * {
 *   type: string,
 *   payload: any,
 *   sessionId: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, sessionId } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Command type is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401, headers: corsHeaders }
      );
    }

    const requestId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const command: MCPCommand = {
      requestId,
      type,
      payload: payload || {},
      timestamp: Date.now(),
      sessionId,
    };

    const redis = getRedis();
    const queueKey = getCommandQueueKey(sessionId);

    // Push to session-specific queue (FIFO: left-push, right-pop)
    await redis.lpush(queueKey, JSON.stringify(command));
    await redis.expire(queueKey, REDIS_TTL.COMMAND);

    console.log(`[MCP Command] Queued: ${type} (${requestId}) for session ${sessionId}`);

    return NextResponse.json(
      {
        success: true,
        requestId,
        message: `Command '${type}' queued for session ${sessionId}`,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("MCP Command POST Error:", error);
    return NextResponse.json(
      { error: "Failed to queue command" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/mcp-commands
 *
 * Clear all commands for a session.
 *
 * Headers:
 *   X-Session-Id: {sessionId}
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.headers.get("x-session-id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "X-Session-Id header required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const redis = getRedis();
    const queueKey = getCommandQueueKey(sessionId);
    await redis.del(queueKey);

    return NextResponse.json(
      { success: true, message: `Command queue cleared for session ${sessionId}` },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("MCP Command DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to clear commands" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * OPTIONS /api/mcp-commands
 *
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
