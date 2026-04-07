/**
 * POST /api/chat/feedback
 * Submit like/dislike feedback for a chat message.
 * One feedback per message per user (upsert on conflict).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { z } from 'zod'

const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { messageId, conversationId, rating, comment } = parsed.data

    // Verify the conversation belongs to this user
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Upsert feedback (one per message per user)
    const { error } = await supabaseAdmin
      .from('message_feedback')
      .upsert(
        {
          message_id: messageId,
          conversation_id: conversationId,
          user_id: user.id,
          rating,
          comment: comment || null,
        },
        { onConflict: 'message_id,user_id' }
      )

    if (error) {
      console.error('Feedback upsert error:', error)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Feedback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
