import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Course-data cache: Postgres `api_cache` table when Supabase is configured,
 * plus an in-memory L1 for hot keys. Protects the GCA free-tier budget
 * (30 req/day) by deduping in-flight requests too.
 */

const l1 = new Map<string, { payload: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  sb: SupabaseClient | null,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const nowMs = Date.now();
  const hit = l1.get(key);
  if (hit && hit.expiresAt > nowMs) return hit.payload as T;

  if (sb) {
    try {
      const { data } = await sb
        .from('api_cache')
        .select('payload, expires_at')
        .eq('key', key)
        .gt('expires_at', new Date(nowMs).toISOString())
        .maybeSingle();
      if (data?.payload != null) {
        const payload = data.payload as T;
        l1.set(key, { payload, expiresAt: new Date(data.expires_at).getTime() });
        return payload;
      }
    } catch {
      // cache read failure shouldn't block the request
    }
  }

  // dedupe concurrent fetches for the same key
  const existing = inflight.get(key);
  if (existing) return (await existing) as T;

  const p = (async () => {
    const payload = await fetcher();
    const expiresAt = nowMs + ttlSeconds * 1000;
    l1.set(key, { payload, expiresAt });
    if (sb) {
      try {
        await sb.from('api_cache').upsert({
          key,
          payload: payload as Record<string, unknown>,
          expires_at: new Date(expiresAt).toISOString(),
        });
      } catch {
        // non-fatal
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
}
