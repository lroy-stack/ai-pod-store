import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { adminLoginLimiter, getClientIP } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate limiting by IP address
    const clientIP = getClientIP(req);
    const rateLimitResult = await adminLoginLimiter.check(clientIP);

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString()
          }
        }
      );
    }

    // Query user from database (include must_change_password for security enforcement)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, name, must_change_password')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Reset rate limit on successful login
    await adminLoginLimiter.reset(clientIP);

    // If password change is required, create a limited session
    if (user.must_change_password) {
      const limitedSession = await getIronSession<SessionData>(await cookies(), sessionOptions);
      limitedSession.id = user.id;
      limitedSession.email = user.email;
      limitedSession.role = user.role;
      limitedSession.name = user.name;
      limitedSession.isLoggedIn = true;
      limitedSession.mustChangePassword = true;
      await limitedSession.save();

      return NextResponse.json(
        {
          must_change_password: true,
          user_id: user.id,
          message: 'Password change required before continuing.',
        },
        { status: 200 }
      );
    }

    // Create encrypted session using iron-session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    session.id = user.id;
    session.email = user.email;
    session.role = user.role;
    session.name = user.name;
    session.isLoggedIn = true;

    await session.save();

    const sessionData = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return NextResponse.json(
      { success: true, user: sessionData },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
