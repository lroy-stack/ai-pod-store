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
    if (conversationIds?.length || sessionId) {
      let query = supabase
        .from('conversations')
        .update({ user_id: user.id })
        .is('user_id', null)

      if (conversationIds?.length && sessionId) {
        query = query.or(`id.in.(${conversationIds.join(',')}),session_id.eq.${sessionId}`)
      } else if (conversationIds?.length) {
        query = query.in('id', conversationIds)
      } else if (sessionId) {
        query = query.eq('session_id', sessionId)
      }

      const { count } = await query.select('*', { count: 'exact', head: true })
      // Re-run the actual update
      await query

      migratedConversations = count || 0
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
