import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/conversations
 * List authenticated user's conversations (most recent first)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, title, model, locale, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch conversations:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Get message counts per conversation
    const conversationIds = (data || []).map((c) => c.id)
    let messageCounts: Record<string, number> = {}

    if (conversationIds.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)

      if (counts) {
        for (const row of counts) {
          messageCounts[row.conversation_id] = (messageCounts[row.conversation_id] || 0) + 1
        }
      }
    }

    const conversations = (data || []).map((c) => ({
      id: c.id,
      title: c.title || 'Untitled conversation',
      model: c.model,
      locale: c.locale,
      messageCount: messageCounts[c.id] || 0,
      updatedAt: c.updated_at,
      createdAt: c.created_at,
    }))

    return NextResponse.json({ success: true, conversations })
  } catch (error) {
    return authErrorResponse(error)
  }
}
