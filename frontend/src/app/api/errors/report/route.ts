import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { apiLimiter, getClientIP } from '@/lib/rate-limit';

/**
 * POST /api/errors/report
 *
 * Stores client-side errors in the error_logs table with deduplication.
 * Errors with the same message+stack are deduplicated by incrementing count.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests/minute per IP to prevent flood attacks
    const ip = getClientIP(request);
    const { success } = apiLimiter.check(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const body = await request.json();
    const { message, stack, url, user_agent } = body;

    // Validate required fields
    if (!message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }

    // Create hash of message+stack for deduplication
    const errorContent = `${message}${stack || ''}`;
    const errorHash = crypto
      .createHash('sha256')
      .update(errorContent)
      .digest('hex');

    // Create Supabase client with anon key (respects RLS, allows both auth/anon inserts)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to find existing error with same hash
    const { data: existingError, error: fetchError } = await supabase
      .from('error_logs')
      .select('id, count')
      .eq('error_hash', errorHash)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - any other error is a real problem
      console.error('Error fetching existing error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check for existing error' },
        { status: 500 }
      );
    }

    if (existingError) {
      // Error already exists - increment count and update last_seen
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('error_logs')
        .update({
          count: existingError.count + 1,
          last_seen: now,
        })
        .eq('id', existingError.id);

      if (updateError) {
        console.error('Error updating error count:', updateError);
        return NextResponse.json(
          { error: 'Failed to update error count' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deduplicated: true,
        error_id: existingError.id,
        count: existingError.count + 1,
      });
    } else {
      // New error - insert it
      const { data: newError, error: insertError } = await supabase
        .from('error_logs')
        .insert({
          message,
          stack: stack || null,
          url: url || null,
          user_agent: user_agent || null,
          error_hash: errorHash,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting new error:', insertError);
        return NextResponse.json(
          { error: 'Failed to insert error' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deduplicated: false,
        error_id: newError.id,
        count: 1,
      });
    }
  } catch (error) {
    console.error('Unexpected error in /api/errors/report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
