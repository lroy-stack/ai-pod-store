import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/session/migrate
 *
 * Migrates anonymous session data to the authenticated user:
 * 1. Updates conversations with null user_id to the new user
 * 2. Merges anonymous usage counts into the user's record
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const { fingerprint, conversationIds, sessionId } = body as {
      fingerprint?: string
      conversationIds?: string[]
      sessionId?: string
    }

    let migratedConversations = 0
    let migratedUsage = 0

    // 1. Migrate conversations
    // SECURITY: Use separate queries instead of .or() with template literals to prevent SQL injection
    if (conversationIds?.length || sessionId) {
      let totalMigrated = 0

      // Migrate by conversation IDs
      if (conversationIds?.length) {
        const { data: byId } = await supabase
          .from('conversations')
          .update({ user_id: user.id })
          .is('user_id', null)
          .in('id', conversationIds)
          .select()

        totalMigrated += byId?.length || 0
      }

      // Migrate by session ID (only if no conversationIds to avoid complexity)
      // If both are provided, the conversationIds query above already handled them
      if (sessionId && !conversationIds?.length) {
        const { data: bySession } = await supabase
          .from('conversations')
          .update({ user_id: user.id })
          .is('user_id', null)
          .eq('session_id', sessionId)
          .select()

        totalMigrated += bySession?.length || 0
      }

      migratedConversations = totalMigrated
    }

    // 2. Migrate usage via RPC
    if (fingerprint) {
      const oldIdentifier = `fp:${fingerprint}`
      const newIdentifier = user.id

      const { data } = await supabase.rpc('migrate_usage', {
        p_old_identifier: oldIdentifier,
        p_new_identifier: newIdentifier,
      })

      migratedUsage = data || 0
    }

    return Response.json({
      migrated: {
        conversations: migratedConversations,
        usage: migratedUsage,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
