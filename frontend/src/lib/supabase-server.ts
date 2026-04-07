/**
 * Server-side Supabase client utilities for API routes
 *
 * Use createServerClient() to create a client that respects RLS policies
 * based on the user's JWT token from the Authorization header.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Creates a Supabase client for API routes that respects RLS policies.
 * Extracts the JWT token from the Authorization header and uses it to authenticate.
 *
 * @param req - Next.js request object
 * @returns Object with supabase client and user info
 */
export async function createServerClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Extract token from Authorization header
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // Create client with anon key (respects RLS)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })

  // Get authenticated user if token exists
  let user = null
  if (token) {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) {
      user = data.user
    }
  }

  return { supabase, user }
}

/**
 * Creates an admin Supabase client that bypasses RLS.
 * Only use this for admin operations where you explicitly need to bypass RLS.
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
