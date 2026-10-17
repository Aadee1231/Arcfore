import { Redis } from '@upstash/redis';
import { env } from './env.js';

/**
 * Course-data cache: in-memory TTL map + in-flight request dedupe, with an
 * optional Upstash Redis L2 shared across serverless instances (when
 * UPSTASH_REDIS_REST_* are configured). Protects the GCA free-tier budget
 * (30 req/day). The app additionally caches course detail in its local SQLite
 * DB, so repeated lookups across restarts don't hit the API.
 */

const l1 = new Map<string, { payload: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    redis =
      env.upstashRedisUrl && env.upstashRedisToken
        ? new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
        : null;
  }
  return redis;
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const nowMs = Date.now();
  const hit = l1.get(key);
  if (hit && hit.expiresAt > nowMs) return hit.payload as T;

  const r = getRedis();
  if (r) {
    try {
      const l2 = await r.get<T>(key);
      if (l2 != null) {
        l1.set(key, { payload: l2, expiresAt: nowMs + ttlSeconds * 1000 });
        return l2;
      }
    } catch {
      // Redis hiccup — fall through to the provider fetch
    }
  }

  // dedupe concurrent fetches for the same key
  const existing = inflight.get(key);
  if (existing) return (await existing) as T;

  const p = (async () => {
    const payload = await fetcher();
    l1.set(key, { payload, expiresAt: nowMs + ttlSeconds * 1000 });
    if (r) {
      try {
        await r.set(key, payload as never, { ex: ttlSeconds });
      } catch {
        // best-effort L2 write
      }
    }
    return payload;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

export function _resetForTests() {
  l1.clear();
  inflight.clear();
  redis = undefined;
}
