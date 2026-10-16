import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let sb: SupabaseClient | null = null;

/** Service-role client — bypasses RLS. Always scope queries by user_id. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  sb ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return sb;
}
