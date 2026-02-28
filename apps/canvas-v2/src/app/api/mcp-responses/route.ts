import { NextRequest, NextResponse } from "next/server";
import { getRedis, REDIS_KEYS, REDIS_TTL } from "@/lib/redis";

// POST - Store response from frontend
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, response } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    const redis = getRedis();
    const key = `${REDIS_KEYS.MCP_RESPONSE}${requestId}`;

    // Store response with TTL
    await redis.set(
      key,
      JSON.stringify({ response, timestamp: Date.now() }),
      "EX",
      REDIS_TTL.RESPONSE
    );

    console.log(`[MCP Response] Stored response for ${requestId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MCP Response Error:", error);
    return NextResponse.json(
      { error: "Failed to store response" },
      { status: 500 }
    );
  }
}

// GET - Retrieve response by requestId
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json(
      { error: "requestId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const redis = getRedis();
    const key = `${REDIS_KEYS.MCP_RESPONSE}${requestId}`;

    // Get and delete in one operation (atomic)
    const data = await redis.getdel(key);

    if (data) {
      const parsed = JSON.parse(data);
      console.log(`[MCP Response] Retrieved and deleted response for ${requestId}`);
      return NextResponse.json({ response: parsed.response });
    }

    // No response yet - return null (MCP will continue polling)
    return NextResponse.json({ response: null });
  } catch (error) {
    console.error("MCP Response GET Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve response" },
      { status: 500 }
    );
  }
}

// DELETE - Clear all responses (for debugging/cleanup)
export async function DELETE() {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`${REDIS_KEYS.MCP_RESPONSE}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return NextResponse.json({
      success: true,
      message: `Response store cleared (${keys.length} keys deleted)`
    });
  } catch (error) {
    console.error("MCP Response DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to clear responses" },
      { status: 500 }
    );
  }
}
