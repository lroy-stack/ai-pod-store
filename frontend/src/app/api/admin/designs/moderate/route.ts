import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

const moderateDesignSchema = z.object({
  designId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  moderationNotes: z.string().optional(),
})

/**
 * POST /api/admin/designs/moderate
 * Approve or reject a design
 */
export async function POST(req: NextRequest) {
  try {
    // Admin auth check
    let admin
    try {
      admin = await requireAdmin(req)
    } catch (error) {
      return authErrorResponse(error)
    }

    const body = await req.json()
    const validation = moderateDesignSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { designId, action, moderationNotes } = validation.data

    // Update moderation status
    const { data, error } = await supabaseAdmin
      .from('designs')
      .update({
        moderation_status: action === 'approve' ? 'approved' : 'rejected',
        moderation_notes: moderationNotes || null,
        moderated_by: admin.id,
      })
      .eq('id', designId)
      .select()
      .single()

    if (error) {
      console.error('Failed to moderate design:', error)
      return NextResponse.json(
        { error: 'Failed to moderate design', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      design: data,
      action,
    })
  } catch (error) {
    console.error('POST /api/admin/designs/moderate error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
