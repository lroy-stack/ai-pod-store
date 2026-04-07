import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/conversations/[id]
 * Get messages for a specific conversation (requires ownership)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    // Verify ownership
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, role, content, tool_calls, tool_results, parts, tokens_used, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Failed to fetch messages:', msgError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        locale: conversation.locale,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      messages: messages || [],
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation and all its messages (GDPR)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    // Verify ownership
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete messages first (cascade)
    await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', id)

    // Delete conversation — include user_id to prevent IDOR in the delete query itself
    await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    return authErrorResponse(error)
  }
}
