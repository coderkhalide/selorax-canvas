import Redis from 'ioredis';

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — Redis disabled');
    return null;
  }
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  // DigitalOcean managed Redis uses rediss:// (TLS) — normalise if bare redis:// is provided
  const effectiveUrl = !isLocal && url.startsWith('redis://') ? url.replace('redis://', 'rediss://') : url;

  const client = new Redis(effectiveUrl, {
    maxRetriesPerRequest: null, // don't retry commands — fail fast so routes fallback to MySQL
    lazyConnect: true,
    tls: !isLocal ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('[Redis] Max retries reached — running without cache');
        return null; // stop reconnecting
      }
      return Math.min(times * 500, 2000);
    },
  });
  client.on('connect',      () => console.log('[Redis] Connected'));
  client.on('ready',        () => console.log('[Redis] Ready'));
  client.on('error',        (err: Error) => console.error('[Redis] Error:', err.message));
  client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
  return client;
}

export const redis = createRedisClient();
