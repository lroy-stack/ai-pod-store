import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

/**
 * Setup RBAC test users
 * This is a temporary endpoint to assign roles for testing
 * TODO: Remove in production or protect with super_admin check
 */
export async function POST(req: NextRequest) {
  try {
    // Get all roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('admin_roles')
      .select('*');

    if (rolesError || !roles) {
      return NextResponse.json(
        { error: 'Failed to fetch roles', details: rolesError },
        { status: 500 }
      );
    }

    const superAdminRole = roles.find(r => r.name === 'super_admin');
    const viewerRole = roles.find(r => r.name === 'viewer');
    const managerRole = roles.find(r => r.name === 'manager');

    if (!superAdminRole || !viewerRole || !managerRole) {
      return NextResponse.json(
        { error: 'Required roles not found in database' },
        { status: 500 }
      );
    }

    // Get the default admin user
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', 'admin@podstore.local');

    if (adminError || !adminUsers || adminUsers.length === 0) {
      return NextResponse.json(
        { error: 'Admin user not found', details: adminError },
        { status: 500 }
      );
    }

    const adminUser = adminUsers[0];

    // Assign super_admin role to admin user (upsert to avoid duplicates)
    const { error: assignError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        {
          user_id: adminUser.id,
          role_id: superAdminRole.id,
        },
        { onConflict: 'user_id,role_id' }
      );

    if (assignError) {
      console.error('Failed to assign super_admin role:', assignError);
      return NextResponse.json(
        { error: 'Failed to assign role', details: assignError },
        { status: 500 }
      );
    }

    // Create test viewer user if not exists
    const { data: existingViewer } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', 'viewer@podstore.local')
      .maybeSingle();

    let viewerUserId = existingViewer?.id;

    if (!existingViewer) {
      // Insert viewer user with bcrypt password hash for "viewer123"
      const hashedPassword = await bcrypt.hash('viewer123', 10);
      const { data: newViewer, error: viewerCreateError } = await supabaseAdmin
        .from('users')
        .insert({
          email: 'viewer@podstore.local',
          name: 'Test Viewer',
          password_hash: hashedPassword,
          role: 'admin', // This is for the old system, new RBAC uses user_roles
          locale: 'en',
          currency: 'EUR',
        })
        .select()
        .single();

      if (viewerCreateError) {
        console.error('Failed to create viewer user:', viewerCreateError);
      } else {
        viewerUserId = newViewer?.id;
      }
    }

    // Assign viewer role
    if (viewerUserId) {
      await supabaseAdmin
        .from('user_roles')
        .upsert(
          {
            user_id: viewerUserId,
            role_id: viewerRole.id,
          },
          { onConflict: 'user_id,role_id' }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'RBAC setup completed',
      assignments: [
        {
          user: adminUser.email,
          role: 'super_admin',
          userId: adminUser.id,
        },
        {
          user: 'viewer@podstore.local',
          role: 'viewer',
          userId: viewerUserId || 'not created',
        },
      ],
      roles: roles.map(r => ({ name: r.name, display: r.display_name })),
    });
  } catch (error) {
    console.error('RBAC setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
