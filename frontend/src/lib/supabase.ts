// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

// Frontend Supabase client (anon key for RLS-protected operations)
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | undefined

function initClient(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return _client
}

// Lazy singleton — client is created on first property access, not at import time.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = initClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
