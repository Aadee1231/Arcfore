import { Redis } from '@upstash/redis';
import { env } from './env.js';

/**
 * AI-call budget + rate limiting.
 *
 * Three enforcement layers, all daily windows:
 *   1. global cap  — bounds total OpenAI spend per day no matter what
 *   2. per-IP cap  — defends against rotated/spoofed x-device-id values
 *   3. per-client  — the user-facing daily quota (same semantics as before)
 *
 * Backend selection:
 *   - Upstash Redis (REST) when UPSTASH_REDIS_REST_URL/TOKEN are set — correct
 *     across serverless instances and cold starts.
 *   - In-memory map in non-production only (local dev / tests).
 *   - In production WITHOUT Redis, AI endpoints are blocked outright —
 *     device-id-keyed in-memory limits would silently reset per instance.
 */

export type AiBudgetMode = 'upstash-redis' | 'in-memory' | 'blocked';

export interface AiBudgetResult {
  allowed: boolean;
  reason?: 'rate_limited' | 'protection_not_configured';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_SEC = Math.ceil(DAY_MS / 1000) + 3600; // ~25h, covers the daily window

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

export function aiBudgetMode(): AiBudgetMode {
  if (getRedis()) return 'upstash-redis';
  return env.isProduction ? 'blocked' : 'in-memory';
}

// ---------- in-memory fallback (dev/test only) ----------

const buckets = new Map<string, { windowStart: number; count: number }>();

function memoryBump(key: string, windowMs: number): number {
  const nowMs = Date.now();
  const b = buckets.get(key);
  if (!b || nowMs - b.windowStart >= windowMs) {
    buckets.set(key, { windowStart: nowMs, count: 1 });
    return 1;
  }
  b.count += 1;
  return b.count;
}

// ---------- redis counters ----------

/** Increment a daily counter; sets TTL only on first hit of the window. */
async function redisBump(key: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const used = await r.incr(key);
  if (used === 1) await r.expire(key, WINDOW_SEC);
  return used;
}

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Consume one unit of AI budget for this call.
 * `clientLimit` is the per-endpoint ceiling (coach passes a higher multiple,
 * matching the previous behavior where all endpoints shared one counter).
 */
export async function checkAiBudget(opts: {
  clientId: string;
  clientIp: string;
  clientLimit: number;
}): Promise<AiBudgetResult> {
  const mode = aiBudgetMode();
  if (mode === 'blocked') return { allowed: false, reason: 'protection_not_configured' };

  const day = dayStamp();
  const checks: { key: string; limit: number }[] = [
    { key: `rl:global:${day}`, limit: env.aiDailyGlobalLimit },
    { key: `rl:ip:${opts.clientIp}:${day}`, limit: env.aiDailyLimitPerIp },
    { key: `rl:c:${opts.clientId}:${day}`, limit: opts.clientLimit },
  ];

  for (const { key, limit } of checks) {
    const used = mode === 'upstash-redis' ? await redisBump(key) : memoryBump(key, DAY_MS);
    if (used > limit) return { allowed: false, reason: 'rate_limited' };
  }
  return { allowed: true };
}

export function _resetForTests() {
  buckets.clear();
  redis = undefined;
}
