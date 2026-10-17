/** Server configuration — all secrets live here, never in the mobile client. */

function opt(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(opt('PORT', '8787')),
  /** True on Vercel (VERCEL=1) or any NODE_ENV=production runtime. */
  isProduction: opt('VERCEL') === '1' || opt('NODE_ENV') === 'production',
  // Optional: verify Clerk session JWTs when a signed-in user calls the API.
  clerkSecretKey: opt('CLERK_SECRET_KEY'),
  clerkJwtIssuer: opt('CLERK_JWT_ISSUER'), // e.g. https://your-app.clerk.accounts.dev
  // Golf Courses API
  gcaApiKey: opt('GCA_API_KEY'),
  gcaBaseUrl: opt('GCA_BASE_URL', 'https://golfcoursesapi.com/api/v1'),
  // OpenAI
  openaiApiKey: opt('OPENAI_API_KEY'),
  openaiVisionModel: opt('OPENAI_VISION_MODEL', 'gpt-5.2'),
  openaiCoachModel: opt('OPENAI_COACH_MODEL', 'gpt-5.4-mini'),
  // Optional shared token the app sends as `x-arcfore-key` — a light abuse
  // deterrent on top of rate limits (it ships in the app bundle, so treat it
  // as "please don't scrape", not a real secret).
  apiToken: opt('API_SHARED_SECRET'),
  // Upstash Redis (REST) — persistent rate-limit + cache backend. Required for
  // AI endpoints in production; without it AI calls are blocked (see ratelimit.ts).
  upstashRedisUrl: opt('UPSTASH_REDIS_REST_URL'),
  upstashRedisToken: opt('UPSTASH_REDIS_REST_TOKEN'),
  // Budgets / limits
  aiDailyLimitPerClient: Number(opt('AI_DAILY_LIMIT_PER_CLIENT', '10')),
  // Per-IP ceiling defends against rotated/spoofed x-device-id values.
  aiDailyLimitPerIp: Number(opt('AI_DAILY_LIMIT_PER_IP', '30')),
  // Hard global cap on ALL AI calls per day — bounds OpenAI spend regardless of
  // how many distinct clients/IPs an attacker cycles through.
  aiDailyGlobalLimit: Number(opt('AI_DAILY_GLOBAL_LIMIT', '200')),
  // When 'true', AI endpoints require a verified Clerk session (no anonymous calls).
  aiRequireAuth: opt('AI_REQUIRE_AUTH', 'false') === 'true',
  maxFrameCount: Number(opt('MAX_FRAME_COUNT', '16')),
  maxFrameBytes: Number(opt('MAX_FRAME_BYTES', String(4 * 1024 * 1024))), // per frame
  courseCacheTtlSeconds: Number(opt('COURSE_CACHE_TTL_SECONDS', String(6 * 60 * 60))),
  corsOrigins: opt('CORS_ORIGINS', '*'),
} as const;

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const v = env[key];
  if (v === '' || v == null) throw new Error(`Missing required env var ${String(key)}`);
  return v as NonNullable<(typeof env)[K]>;
}
