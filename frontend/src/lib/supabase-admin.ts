// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

// Server-side only — uses service role key (bypasses RLS)
// NEVER import this in client components
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | undefined

function initClient(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
    }

    _client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'x-connection-pool': 'true',
        },
      },
      db: {
        schema: 'public',
      },
      // Note: Supabase-js uses HTTP/2 connection pooling automatically
      // The underlying fetch API reuses connections efficiently
    })
  }
  return _client
}

// Lazy singleton — client is created on first property access, not at import time.
// This allows the module to be imported during `next build` without requiring env vars.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = initClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
