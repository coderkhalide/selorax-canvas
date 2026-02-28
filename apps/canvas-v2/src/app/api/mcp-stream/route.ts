import { NextRequest } from "next/server";
import Redis from "ioredis";
import { validateToken, extractBearerToken } from "@/lib/mcp-session";
import { getStreamKey, publishStreamChunk } from "@/lib/redis";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * GET /api/mcp-stream
 *
 * SSE endpoint for real-time streaming updates during MCP tool execution.
 * Connect to this endpoint to receive live updates when AI tools are processing.
 *
 * Requires Authorization header with session token.
 */
export async function GET(request: NextRequest) {
  // Extract and validate Bearer token
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Authorization header with Bearer token required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const session = await validateToken(token);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired session token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const streamKey = getStreamKey(session.id);

  // Create a new Redis connection for subscribing (can't use shared connection for pub/sub)
  const REDIS_URL = process.env.REDIS_URL || "redis://default:TtLXdEf3Vintan@143.198.94.175:8730";
  const subscriber = new Redis(REDIS_URL);

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", sessionId: session.id })}\n\n`)
      );

      // Subscribe to the session's stream channel
      await subscriber.subscribe(streamKey);

      // Handle incoming messages
      subscriber.on("message", (channel, message) => {
        if (channel === streamKey) {
          try {
            const data = JSON.parse(message);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.error("[MCP Stream] Failed to parse message:", e);
          }
        }
      });

      // Send keepalive every 15 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        subscriber.unsubscribe(streamKey);
        subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

/**
 * POST /api/mcp-stream
 *
 * Publish a streaming chunk to external clients listening via SSE.
 * This allows browser-side executors to push real-time updates to external clients.
 *
 * Body: { sessionId: string, chunk: { type, tool, data, message } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, chunk } = body;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!chunk || !chunk.type) {
      return new Response(
        JSON.stringify({ error: "chunk with type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Publish to Redis for external clients
    await publishStreamChunk(sessionId, chunk);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[MCP Stream] Publish error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to publish stream chunk" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * OPTIONS /api/mcp-stream
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
