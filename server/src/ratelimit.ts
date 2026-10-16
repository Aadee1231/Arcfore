/** Simple in-memory fixed-window rate limiter (per-instance). For multi-instance
 *  deployments swap to a Postgres/Redis bucket — interface stays the same. */

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export function allow(key: string, limit: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const b = buckets.get(key);
  if (!b || nowMs - b.windowStart >= windowMs) {
    buckets.set(key, { windowStart: nowMs, count: 1 });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

/** Daily AI budget per user. */
export function allowAiCall(userId: string, dailyLimit: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  return allow(`ai:${userId}:${day}`, dailyLimit, 24 * 60 * 60 * 1000);
}

export function _resetForTests() {
  buckets.clear();
}
