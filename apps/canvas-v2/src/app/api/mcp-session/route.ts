import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  validateToken,
  getSession,
  revokeSession,
  extractBearerToken,
  getSessionInfo,
  touchSession,
} from "@/lib/mcp-session";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id",
};

/**
 * POST /api/mcp-session
 *
 * Create a new MCP session. Called by the browser to get a session token.
 *
 * Request body (optional):
 * {
 *   userAgent?: string  // Browser user agent for identification
 * }
 *
 * Response:
 * {
 *   sessionId: string,
 *   token: string,        // Full token to use in Authorization header
 *   createdAt: number,
 *   expiresAt: number,
 *   expiresIn: number     // Seconds until expiration
 * }
 */
export async function POST(request: NextRequest) {
  try {
    let userAgent: string | undefined;

    try {
      const body = await request.json();
      userAgent = body.userAgent;
    } catch {
      // Body is optional, use header as fallback
      userAgent = request.headers.get("user-agent") || undefined;
    }

    const session = await createSession(userAgent);
    const info = getSessionInfo(session);

    return NextResponse.json(info, { headers: corsHeaders });
  } catch (error) {
    console.error("[MCP Session] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/mcp-session
 *
 * Get current session info. Requires Authorization header with token.
 *
 * Headers:
 *   Authorization: Bearer {token}
 *   OR
 *   X-Session-Id: {sessionId} (for browser that already has token stored)
 *
 * Response:
 * {
 *   sessionId: string,
 *   token: string,
 *   createdAt: number,
 *   expiresAt: number,
 *   expiresIn: number,
 *   valid: boolean
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Try Bearer token first
    const authHeader = request.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (token) {
      const session = await validateToken(token);
      if (session) {
        // Touch session to update last activity
        await touchSession(session.id);
        const refreshedSession = (await getSession(session.id)) || session;

        return NextResponse.json(
          { ...getSessionInfo(refreshedSession), valid: true },
          { headers: corsHeaders }
        );
      }
      return NextResponse.json(
        { valid: false, error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Try X-Session-Id header (for browser-side validation)
    const sessionId = request.headers.get("x-session-id");
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        await touchSession(sessionId);
        const refreshedSession = (await getSession(sessionId)) || session;
        return NextResponse.json(
          { ...getSessionInfo(refreshedSession), valid: true },
          { headers: corsHeaders }
        );
      }
      return NextResponse.json(
        { valid: false, error: "Session not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: "Authorization header or X-Session-Id required" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[MCP Session] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/mcp-session
 *
 * Revoke/delete a session. Requires Authorization header with token.
 *
 * Headers:
 *   Authorization: Bearer {token}
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
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
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const revoked = await revokeSession(session.id);

    return NextResponse.json(
      {
        success: revoked,
        message: revoked ? "Session revoked" : "Session not found",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[MCP Session] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * OPTIONS /api/mcp-session
 *
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}
