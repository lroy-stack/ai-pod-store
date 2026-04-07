import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withPermission, AdminSession } from '@/lib/rbac'
import { logDelete } from '@/lib/audit'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export const DELETE = withPermission('designs', 'delete', async (req: NextRequest, session: AdminSession) => {
  try {
    const body = await req.json()

    const parsed = bulkDeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { ids } = parsed.data

    // Hard-delete designs from DB
    const { error } = await supabaseAdmin
      .from('designs')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Failed to delete designs:', error)
      return NextResponse.json({ error: 'Failed to delete designs' }, { status: 500 })
    }

    // Audit log each deletion (Feature #43 + Feature #48)
    await Promise.all(
      ids.map((id) =>
        logDelete(session.userId, 'design', id, { batch_size: ids.length }, session.email)
      )
    )

    return NextResponse.json({ deleted: ids.length, ids })
  } catch (err) {
    console.error('Error deleting designs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
