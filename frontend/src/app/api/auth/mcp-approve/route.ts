import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requiredEnv } from '@/lib/env'

const supabaseUrl = requiredEnv('SUPABASE_URL')
const supabaseServiceKey = requiredEnv('SUPABASE_SERVICE_KEY')
const MCP_BASE_URL = requiredEnv('MCP_BASE_URL')
const MCP_APPROVE_SECRET = requiredEnv('MCP_APPROVE_SECRET')

/**
 * POST /api/auth/mcp-approve
 *
 * Bridge between Supabase auth and MCP OAuth flow.
 * Called by the MCP consent page after user approves.
 *
 * 1. Validates Supabase session (sb-access-token cookie)
 * 2. Calls MCP server POST /oauth/approve with shared secret
 * 3. Returns { code, redirect_uri, state } for client redirect
 */
export async function POST(request: NextRequest) {
  // DEPRECATED: This bridge endpoint is no longer needed in the new auth flow.
  // The consent page now redirects directly to MCP /oauth/authorize/approved,
  // which handles cookie approval + upstream Supabase Auth PKCE.
  // Kept for backwards compatibility during transition (30 days).
  console.warn('[mcp-approve] DEPRECATED: Use /oauth/authorize/approved + Supabase PKCE flow instead.');

  try {
    // 1. Validate Supabase session
    const accessToken = request.cookies.get('sb-access-token')?.value
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { request_id } = body

    if (!request_id) {
      return NextResponse.json(
        { error: 'Missing request_id' },
        { status: 400 }
      )
    }

    if (!MCP_APPROVE_SECRET) {
      console.error('[mcp-approve] MCP_APPROVE_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 3. Call MCP server /oauth/approve
    const mcpResponse = await fetch(`${MCP_BASE_URL}/oauth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id,
        user_id: user.id,
        email: user.email,
        secret: MCP_APPROVE_SECRET,
      }),
    })

    if (!mcpResponse.ok) {
      const errorData = await mcpResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[mcp-approve] MCP server error:', errorData)
      return NextResponse.json(
        { error: errorData.error_description || errorData.error || 'Approval failed' },
        { status: mcpResponse.status }
      )
    }

    // 4. Return { code, redirect_uri, state } to frontend
    const result = await mcpResponse.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[mcp-approve] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
