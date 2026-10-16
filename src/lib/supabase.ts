import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config, isSupabaseConfigured } from '@/lib/config';

let supabase: SupabaseClient | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;

/**
 * Register the Clerk token getter once (from the root layout).
 * Supabase third-party auth then sends `Authorization: Bearer <clerk-jwt>`
 * on every request; RLS identifies the user via `auth.jwt()->>'sub'`.
 */
export function registerSupabaseTokenProvider(getter: () => Promise<string | null>) {
  tokenProvider = getter;
  supabase = null; // rebuild client with the provider wired
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        // Clerk owns the session — disable supabase-js' own auth persistence.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      accessToken: tokenProvider ?? undefined,
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return supabase;
}

/** True when Supabase calls can actually work (env + a token getter). */
export function isSupabaseReady(): boolean {
  return isSupabaseConfigured() && tokenProvider != null;
}
