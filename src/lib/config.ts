import Constants from 'expo-constants';

/** Runtime configuration. Public values only — secrets stay server-side. */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; eas?: { projectId?: string } };

function fromEnv(name: string): string | undefined {
  // EXPO_PUBLIC_* vars are inlined at bundle time.
  return process.env[name];
}

export const config = {
  /** Backend API base URL. On a physical phone this must be the deployed
   * HTTPS domain (or your machine's LAN IP in dev) — localhost won't work. */
  apiUrl: fromEnv('EXPO_PUBLIC_API_URL') ?? extra.apiUrl ?? 'http://localhost:8787',
  clerkPublishableKey: fromEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY') ?? '',
  /** Optional abuse-deterrent token matched by API_SHARED_SECRET on the server.
   * Not a real secret (it ships in the bundle). */
  apiToken: fromEnv('EXPO_PUBLIC_API_TOKEN') ?? '',
} as const;

// Reject empty or placeholder keys (e.g. "pk_test_..." copied from .env.example) —
// Clerk's JS SDK hard-crashes on a malformed key, which bricked the boot.
export const isClerkConfigured = () =>
  /^pk_(test|live)_[A-Za-z0-9_]+$/.test(config.clerkPublishableKey);
