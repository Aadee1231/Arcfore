import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'VERCEL',
  'NODE_ENV',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'AI_DAILY_LIMIT_PER_CLIENT',
  'AI_DAILY_LIMIT_PER_IP',
  'AI_DAILY_GLOBAL_LIMIT',
  'AI_REQUIRE_AUTH',
] as const;

async function freshModule(vars: Record<string, string> = {}) {
  vi.resetModules();
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  return await import('../src/ratelimit.js');
}

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('aiBudgetMode', () => {
  it('uses in-memory outside production when Redis is not configured', async () => {
    const m = await freshModule();
    expect(m.aiBudgetMode()).toBe('in-memory');
  });

  it('blocks AI in production without Redis', async () => {
    const m = await freshModule({ VERCEL: '1' });
    expect(m.aiBudgetMode()).toBe('blocked');
    const res = await m.checkAiBudget({ clientId: 'device:x', clientIp: '1.2.3.4', clientLimit: 10 });
    expect(res).toEqual({ allowed: false, reason: 'protection_not_configured' });
  });
});

describe('checkAiBudget (in-memory)', () => {
  it('allows up to the client limit, then rate-limits', async () => {
    const m = await freshModule();
    const call = () =>
      m.checkAiBudget({ clientId: 'device:a', clientIp: '1.1.1.1', clientLimit: 2 });
    expect((await call()).allowed).toBe(true);
    expect((await call()).allowed).toBe(true);
    expect(await call()).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('shares the daily counter across endpoints (coach ceiling is higher)', async () => {
    const m = await freshModule();
    const opts = { clientId: 'device:b', clientIp: '2.2.2.2' };
    for (let i = 0; i < 10; i++) {
      expect((await m.checkAiBudget({ ...opts, clientLimit: 30 })).allowed).toBe(true);
    }
    // 10 used: an endpoint with a 10/day ceiling is now exhausted…
    expect(await m.checkAiBudget({ ...opts, clientLimit: 10 })).toEqual({
      allowed: false,
      reason: 'rate_limited',
    });
    // …but the 30/day coach ceiling still has room.
    expect((await m.checkAiBudget({ ...opts, clientLimit: 30 })).allowed).toBe(true);
  });

  it('enforces the global daily cap across all clients', async () => {
    const m = await freshModule({ AI_DAILY_GLOBAL_LIMIT: '2' });
    expect(
      (await m.checkAiBudget({ clientId: 'device:1', clientIp: '3.3.3.1', clientLimit: 10 })).allowed,
    ).toBe(true);
    expect(
      (await m.checkAiBudget({ clientId: 'device:2', clientIp: '3.3.3.2', clientLimit: 10 })).allowed,
    ).toBe(true);
    const third = await m.checkAiBudget({
      clientId: 'device:3',
      clientIp: '3.3.3.3',
      clientLimit: 10,
    });
    expect(third).toEqual({ allowed: false, reason: 'rate_limited' });
  });

  it('enforces the per-IP cap across rotating device ids', async () => {
    const m = await freshModule({ AI_DAILY_LIMIT_PER_IP: '2', AI_DAILY_GLOBAL_LIMIT: '100' });
    const ip = '9.9.9.9';
    expect(
      (await m.checkAiBudget({ clientId: 'device:a', clientIp: ip, clientLimit: 10 })).allowed,
    ).toBe(true);
    expect(
      (await m.checkAiBudget({ clientId: 'device:b', clientIp: ip, clientLimit: 10 })).allowed,
    ).toBe(true);
    const third = await m.checkAiBudget({ clientId: 'device:c', clientIp: ip, clientLimit: 10 });
    expect(third).toEqual({ allowed: false, reason: 'rate_limited' });
  });
});
