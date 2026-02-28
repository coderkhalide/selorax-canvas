import Redis from "ioredis";

// Redis connection URL from environment or default
const REDIS_URL = process.env.REDIS_URL || "redis://default:TtLXdEf3Vintan@143.198.94.175:8730";

// Create a singleton Redis instance
let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisInstance.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }

  return redisInstance;
}

// Key prefixes for different data types
export const REDIS_KEYS = {
  MCP_COMMAND: "mcp:command:",
  MCP_RESPONSE: "mcp:response:",
  MCP_COMMANDS: "mcp:commands:", // Session-specific: mcp:commands:{sessionId}
  MCP_SESSION: "mcp:session:",   // Session metadata: mcp:session:{sessionId}
  MCP_STREAM: "mcp:stream:",     // Streaming updates channel: mcp:stream:{sessionId}
} as const;

// Get stream key for a session
export function getStreamKey(sessionId: string): string {
  return `${REDIS_KEYS.MCP_STREAM}${sessionId}`;
}

// Publish a streaming chunk to a session
export async function publishStreamChunk(sessionId: string, chunk: {
  type: "start" | "chunk" | "complete" | "error";
  tool?: string;
  data?: any;
  message?: string;
}): Promise<void> {
  const redis = getRedis();
  await redis.publish(getStreamKey(sessionId), JSON.stringify(chunk));
}

// TTL values in seconds
export const REDIS_TTL = {
  COMMAND: 60 * 5,       // 5 minutes
  RESPONSE: 60 * 5,      // 5 minutes
  SESSION: 60 * 60 * 24 * 10, // 10 days (default, can be overridden by env)
} as const;
