import Constants from 'expo-constants';

/** Runtime configuration. Public values only — secrets stay server-side. */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; eas?: { projectId?: string } };

function fromEnv(name: string): string | undefined {
  // EXPO_PUBLIC_* vars are inlined at bundle time.
  return process.env[name];
}

export const config = {
  /** Backend API base URL. Override per-environment via EXPO_PUBLIC_API_URL. */
  apiUrl: fromEnv('EXPO_PUBLIC_API_URL') ?? extra.apiUrl ?? 'http://localhost:8787',
  supabaseUrl: fromEnv('EXPO_PUBLIC_SUPABASE_URL') ?? '',
  supabaseAnonKey: fromEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '',
  clerkPublishableKey: fromEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY') ?? '',
  /** Dev-only: render demo data on top of empty accounts. Never enabled in prod builds by default. */
  demoMode: fromEnv('EXPO_PUBLIC_DEMO_MODE') === 'true',
  /** Dev-only backend auth bypass — only honoured when server sets ALLOW_DEV_AUTH. */
  devUserId: fromEnv('EXPO_PUBLIC_DEV_USER_ID') ?? null,
} as const;

export const isSupabaseConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const isClerkConfigured = () => Boolean(config.clerkPublishableKey);
