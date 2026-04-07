import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Admin client (service key) — bypasses RLS.
 * Use ONLY for authenticated tools that need cross-user queries or writes.
 */
export function getSupabaseClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables'
    );
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.info('[Supabase] Admin client initialized');
  return adminClient;
}

/**
 * Anon client — respects RLS policies.
 * Use for public tools (search, categories, store info, reviews).
 */
export function getAnonClient(): SupabaseClient {
  if (anonClient) return anonClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) for public queries. ' +
      'Public tools MUST use anon client to respect RLS policies.'
    );
  }

  anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.info('[Supabase] Anon client initialized');
  return anonClient;
}
