/**
 * Server-side Supabase client with anon key (RLS respected).
 *
 * Use this for public API routes that don't require authentication.
 * NEVER use supabase-admin.ts for public endpoints — it bypasses RLS.
 *
 * Lazy-initialized to avoid crashing during `next build` when env vars
 * are placeholders.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getAnonClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    }

    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _client
}

/** Lazy Proxy — safe to import at module scope without crashing during build */
export const supabaseAnon: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getAnonClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
