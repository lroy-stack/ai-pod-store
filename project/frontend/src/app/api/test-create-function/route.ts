import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/test-create-function
 * Temporary endpoint to manually execute SQL to create issue_refund_atomic function
 * This works around a Supabase CLI migration bug with multiple statements
 */
export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // First check if function already exists
  const { data: testData, error: testError } = await supabase.rpc('issue_refund_atomic', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_refund_amount_cents: 100,
    p_refund_reason: 'test'
  })

  if (!testError || !testError.message.includes('Could not find the function')) {
    return NextResponse.json({
      message: 'Function already exists or other error',
      exists: true,
      testError: testError?.message
    })
  }

  return NextResponse.json({
    error: 'Function does not exist. Please create it manually via Supabase dashboard.',
    sql: `CREATE OR REPLACE FUNCTION issue_refund_atomic(
  p_order_id uuid,
  p_refund_amount_cents integer,
  p_refund_reason text,
  p_stripe_refund_id varchar DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_refunded boolean;
BEGIN
  SELECT (refunded_at IS NOT NULL) INTO v_already_refunded
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_already_refunded THEN
    RETURN FALSE;
  END IF;

  UPDATE orders
  SET
    refunded_at = now(),
    refund_amount_cents = p_refund_amount_cents,
    refund_reason = p_refund_reason,
    stripe_refund_id = p_stripe_refund_id
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;`
  }, { status: 500 })
}
