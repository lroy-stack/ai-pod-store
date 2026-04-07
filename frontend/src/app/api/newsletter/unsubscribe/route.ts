/**
 * Newsletter Unsubscribe Handler
 * POST /api/newsletter/unsubscribe - Handle unsubscribe requests
 * GET /api/newsletter/unsubscribe?email=X - Check unsubscribe status
 * GET /api/newsletter/unsubscribe?token=X - One-click unsubscribe (RFC 8058)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { newsletterLimiter, getClientIP } from '@/lib/rate-limit';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

/**
 * Handle unsubscribe requests
 * Compliance: CAN-SPAM requires honoring unsubscribe within 10 business days
 * We honor immediately (within 24 hours as per requirement)
 */
export async function POST(request: NextRequest) {
  // Rate limiting: 10 requests per minute per IP
  const clientIP = getClientIP(request)
  const rateLimitResult = newsletterLimiter.check(`newsletter:${clientIP}`)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'Retry-After': '60',
        }
      }
    )
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Check if user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, notification_preferences')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      // Even if user doesn't exist, confirm unsubscribe for privacy
      return NextResponse.json({
        success: true,
        message: 'You have been unsubscribed from all marketing emails.',
        email,
      });
    }

    // Update user notification preferences to disable marketing emails
    const preferences = user.notification_preferences || {};
    const updatedPreferences = {
      ...preferences,
      marketing_emails: false,
      newsletter: false,
      unsubscribed_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('users')
      .update({
        notification_preferences: updatedPreferences,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Unsubscribe update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    // Also update newsletter_subscribers table (GDPR compliance)
    await supabase
      .from('newsletter_subscribers')
      .update({
        subscribed: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('email', email);

    // Log the unsubscribe event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'newsletter_unsubscribe',
      details: {
        email,
        timestamp: new Date().toISOString(),
        method: 'api',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from all marketing emails.',
      email,
      honored_within: '24 hours',
      compliance: 'CAN-SPAM + GDPR compliant',
    });
  } catch (error) {
    console.error('Unsubscribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Handle one-click unsubscribe via token (RFC 8058) or check status via email
 * GET /api/newsletter/unsubscribe?token=X - One-click unsubscribe
 * GET /api/newsletter/unsubscribe?email=X - Check unsubscribe status
 */
export async function GET(request: NextRequest) {
  // Rate limiting: 10 requests per minute per IP
  const clientIP = getClientIP(request)
  const rateLimitResult = newsletterLimiter.check(`newsletter:${clientIP}`)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'Retry-After': '60',
        }
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email');

    let email: string | null = null;
    let isTokenBased = false;

    // Token-based unsubscribe (one-click, RFC 8058)
    if (token) {
      const decoded = verifyUnsubscribeToken(token);
      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid or expired unsubscribe token' },
          { status: 400 }
        );
      }
      email = decoded.email;
      isTokenBased = true;
    } else if (emailParam) {
      email = emailParam;
    } else {
      return NextResponse.json(
        { error: 'Either token or email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // If token-based, perform unsubscribe action immediately
    if (isTokenBased) {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('id, email, notification_preferences')
        .eq('email', email)
        .single();

      if (fetchError || !user) {
        // Even if user doesn't exist, confirm unsubscribe for privacy
        return NextResponse.json({
          success: true,
          message: 'You have been unsubscribed from all marketing emails.',
          email,
        });
      }

      // Update user notification preferences
      const preferences = user.notification_preferences || {};
      const updatedPreferences = {
        ...preferences,
        marketing_emails: false,
        newsletter: false,
        unsubscribed_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({
          notification_preferences: updatedPreferences,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Unsubscribe update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update preferences' },
          { status: 500 }
        );
      }

      // Log the unsubscribe event
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'newsletter_unsubscribe',
        details: {
          email,
          timestamp: new Date().toISOString(),
          method: 'one_click_token',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'You have been unsubscribed from all marketing emails.',
        email,
        honored_within: '24 hours',
        compliance: 'RFC 8058 + CAN-SPAM compliant',
      });
    }

    // Email-based status check
    const { data: user, error } = await supabase
      .from('users')
      .select('email, notification_preferences')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({
        email,
        subscribed: false,
        message: 'User not found or not subscribed',
      });
    }

    const preferences = user.notification_preferences || {};
    const isSubscribed = preferences.marketing_emails !== false && preferences.newsletter !== false;

    return NextResponse.json({
      email,
      subscribed: isSubscribed,
      marketing_emails: preferences.marketing_emails !== false,
      newsletter: preferences.newsletter !== false,
      unsubscribed_at: preferences.unsubscribed_at || null,
    });
  } catch (error) {
    console.error('Unsubscribe status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
