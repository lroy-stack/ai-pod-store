import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withPermission } from '@/lib/rbac'

export const DELETE = withPermission('designs', 'delete', async (req: NextRequest, _session: unknown) => {
  try {
    const body = await req.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No design IDs provided' }, { status: 400 })
    }

    // Hard-delete designs from DB
    const { error } = await supabaseAdmin
      .from('designs')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Failed to delete designs:', error)
      return NextResponse.json({ error: 'Failed to delete designs' }, { status: 500 })
    }

    return NextResponse.json({ deleted: ids.length, ids })
  } catch (err) {
    console.error('Error deleting designs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
