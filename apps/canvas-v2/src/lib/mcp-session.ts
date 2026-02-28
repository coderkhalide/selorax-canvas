/**
 * MCP Session Token Utilities
 *
 * Handles token generation, validation, and session management for the MCP server.
 * Tokens are stored in Redis and used to isolate commands to specific browser sessions.
 *
 * Token format: {PREFIX}_{SESSION_ID}_{SECRET}
 * Example: fb_a1b2c3d4e5_x9y8z7w6v5
 */

import { getRedis, REDIS_KEYS, REDIS_TTL } from "./redis";
import crypto from "crypto";

// Configuration from environment
const TOKEN_PREFIX = process.env.MCP_TOKEN_PREFIX || "fb";
const SESSION_TTL = parseInt(process.env.MCP_SESSION_TTL || String(REDIS_TTL.SESSION), 10);

// Session data structure stored in Redis
export interface MCPSession {
  id: string;
  token: string;
  secret: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  userAgent?: string;
}

// Generate a random string for session ID or secret
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

/**
 * Generate a new session token
 * Format: {PREFIX}_{SESSION_ID}_{SECRET}
 */
export function generateToken(sessionId: string, secret: string): string {
  return `${TOKEN_PREFIX}_${sessionId}_${secret}`;
}

/**
 * Parse a token into its components
 * Returns null if token format is invalid
 */
export function parseToken(token: string): { prefix: string; sessionId: string; secret: string } | null {
  if (!token) return null;

  const firstSeparator = token.indexOf("_");
  const lastSeparator = token.lastIndexOf("_");
  if (firstSeparator <= 0 || lastSeparator <= firstSeparator) return null;

  const prefix = token.slice(0, firstSeparator);
  const sessionId = token.slice(firstSeparator + 1, lastSeparator);
  const secret = token.slice(lastSeparator + 1);
  if (!sessionId || !secret) return null;

  // Validate prefix matches expected
  if (prefix !== TOKEN_PREFIX) return null;

  return { prefix, sessionId, secret };
}

/**
 * Create a new MCP session
 * Stores session metadata in Redis and returns the session with token
 */
export async function createSession(userAgent?: string): Promise<MCPSession> {
  const redis = getRedis();

  const sessionId = generateRandomString(12);
  const secret = generateRandomString(16);
  const token = generateToken(sessionId, secret);

  const now = Date.now();
  const session: MCPSession = {
    id: sessionId,
    token,
    secret,
    createdAt: now,
    expiresAt: now + SESSION_TTL * 1000,
    lastActivity: now,
    userAgent,
  };

  // Store session in Redis
  const key = `${REDIS_KEYS.MCP_SESSION}${sessionId}`;
  await redis.set(key, JSON.stringify(session), "EX", SESSION_TTL);

  return session;
}

/**
 * Validate a session token
 * Returns the session if valid, null otherwise
 */
export async function validateToken(token: string): Promise<MCPSession | null> {
  if (!token) return null;

  const parsed = parseToken(token);
  if (!parsed) return null;

  const redis = getRedis();
  const key = `${REDIS_KEYS.MCP_SESSION}${parsed.sessionId}`;

  const data = await redis.get(key);
  if (!data) return null;

  try {
    const session: MCPSession = JSON.parse(data);

    // Verify the secret matches
    if (session.secret !== parsed.secret) return null;

    // Check if expired (Redis TTL should handle this, but double-check)
    if (Date.now() > session.expiresAt) {
      await redis.del(key);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Get session by ID (without token validation)
 * Used by browser-side code that already has the session
 */
export async function getSession(sessionId: string): Promise<MCPSession | null> {
  const redis = getRedis();
  const key = `${REDIS_KEYS.MCP_SESSION}${sessionId}`;

  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Update session's last activity timestamp
 * Also refreshes the Redis TTL
 */
export async function touchSession(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${REDIS_KEYS.MCP_SESSION}${sessionId}`;

  const data = await redis.get(key);
  if (!data) return false;

  try {
    const session: MCPSession = JSON.parse(data);
    const now = Date.now();
    session.lastActivity = now;
    session.expiresAt = now + SESSION_TTL * 1000;

    // Update session and refresh TTL
    await redis.set(key, JSON.stringify(session), "EX", SESSION_TTL);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete/revoke a session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  const sessionKey = `${REDIS_KEYS.MCP_SESSION}${sessionId}`;
  const commandsKey = `${REDIS_KEYS.MCP_COMMANDS}${sessionId}`;

  // Delete session and its command queue
  const deleted = await redis.del(sessionKey, commandsKey);
  return deleted > 0;
}

/**
 * Get the Redis key for a session's command queue
 */
export function getCommandQueueKey(sessionId: string): string {
  return `${REDIS_KEYS.MCP_COMMANDS}${sessionId}`;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Get session info suitable for client display (without secret)
 */
export function getSessionInfo(session: MCPSession): {
  sessionId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  expiresIn: number;
} {
  return {
    sessionId: session.id,
    token: session.token,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  };
}
