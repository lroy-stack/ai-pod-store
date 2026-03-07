import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/change-password
 *
 * Used when must_change_password=true to let admin set a new password.
 * Accepts: { user_id, current_password, new_password }
 * On success: clears must_change_password flag, creates session, returns user data.
 */
export async function POST(req: NextRequest) {
  try {
    const { user_id, current_password, new_password } = await req.json();

    if (!user_id || !current_password || !new_password) {
      return NextResponse.json(
        { error: 'user_id, current_password, and new_password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 12) {
      return NextResponse.json(
        { error: 'New password must be at least 12 characters' },
        { status: 400 }
      );
    }

    // Fetch user with must_change_password flag
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, name, must_change_password')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the current password
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash the new password
    const newHash = await bcrypt.hash(new_password, 12);

    // Update password and clear must_change_password flag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: newHash,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Create session after successful password change
    const ironSession = await getIronSession<SessionData>(await cookies(), sessionOptions);
    ironSession.id = user.id;
    ironSession.email = user.email;
    ironSession.role = user.role;
    ironSession.name = user.name;
    ironSession.isLoggedIn = true;
    await ironSession.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
