/** Server configuration — all secrets live here, never in the mobile client. */

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}
function opt(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(opt('PORT', '8787')),
  // Supabase (service role — bypasses RLS; keep secret)
  supabaseUrl: opt('SUPABASE_URL'),
  supabaseServiceKey: opt('SUPABASE_SERVICE_ROLE_KEY'),
  // Clerk — verifies session JWTs from the app
  clerkSecretKey: opt('CLERK_SECRET_KEY'),
  clerkJwtIssuer: opt('CLERK_JWT_ISSUER'), // e.g. https://your-app.clerk.accounts.dev
  // Golf Courses API
  gcaApiKey: opt('GCA_API_KEY'),
  gcaBaseUrl: opt('GCA_BASE_URL', 'https://golfcoursesapi.com/api/v1'),
  // Gemini
  geminiApiKey: opt('GEMINI_API_KEY'),
  geminiModel: opt('GEMINI_MODEL', 'gemini-2.5-flash'),
  geminiCoachModel: opt('GEMINI_COACH_MODEL', 'gemini-2.5-flash'),
  // Budgets / limits
  aiDailyLimitPerUser: Number(opt('AI_DAILY_LIMIT_PER_USER', '10')),
  maxVideoBytes: Number(opt('MAX_VIDEO_BYTES', String(120 * 1024 * 1024))), // 120MB
  maxVideoSeconds: Number(opt('MAX_VIDEO_SECONDS', '120')),
  courseCacheTtlSeconds: Number(opt('COURSE_CACHE_TTL_SECONDS', String(6 * 60 * 60))),
  // Dev-only: accept `x-dev-user-id` header when no Clerk JWT. NEVER enable in prod.
  allowDevAuth: opt('ALLOW_DEV_AUTH') === 'true',
  corsOrigins: opt('CORS_ORIGINS', '*'),
} as const;

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const v = env[key];
  if (v === '' || v == null) throw new Error(`Missing required env var ${String(key)}`);
  return v as NonNullable<(typeof env)[K]>;
}
