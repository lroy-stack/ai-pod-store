import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { isSuperAdmin } from '@/lib/rbac'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/admin/roles - Fetch all roles with permissions
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('admin_roles')
      .select('id, name, permissions')
      .order('name')

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
    }

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Roles API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// PUT /api/admin/roles/:id — Update permissions for a role
// Only super_admin can modify roles — wrapped in withAuth for rate limiting + audit
export const PUT = withAuth(async (req: NextRequest, session) => {
  try {
    // Only super_admin can modify roles — no delegation via roles:update
    const isSuper = await isSuperAdmin(session.id)
    if (!isSuper) {
      return NextResponse.json({ error: 'Only super administrators can modify roles' }, { status: 403 })
    }

    const body = await req.json()
    const { role_id, permissions } = body

    if (!role_id || !permissions) {
      return NextResponse.json({ error: 'role_id and permissions are required' }, { status: 400 })
    }

    // Prevent modifying super_admin role
    const { data: role } = await supabaseAdmin
      .from('admin_roles')
      .select('name')
      .eq('id', role_id)
      .single()

    if (role?.name === 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify super_admin permissions' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('admin_roles')
      .update({ permissions })
      .eq('id', role_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Roles API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
