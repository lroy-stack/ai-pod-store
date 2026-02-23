-- Create atomic refund processing function
-- Purpose: Atomically process refunds and prevent duplicate refunds
-- Features: SECURITY DEFINER, idempotent (returns FALSE for already-refunded orders)

CREATE OR REPLACE FUNCTION issue_refund_atomic(
  p_order_id uuid,
  p_refund_amount_cents integer,
  p_refund_reason text,
  p_stripe_refund_id varchar DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_already_refunded boolean;
BEGIN
  -- Check if order is already refunded
  SELECT (refunded_at IS NOT NULL) INTO v_already_refunded
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE; -- Lock the row to prevent race conditions

  -- If already refunded, return FALSE
  IF v_already_refunded THEN
    RETURN FALSE;
  END IF;

  -- Otherwise, process the refund
  UPDATE orders
  SET
    refunded_at = now(),
    refund_amount_cents = p_refund_amount_cents,
    refund_reason = p_refund_reason,
    stripe_refund_id = p_stripe_refund_id
  WHERE id = p_order_id;

  -- Return TRUE to indicate refund was processed
  RETURN TRUE;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION issue_refund_atomic IS 'Atomically processes refunds for orders. Returns TRUE if refund was processed, FALSE if order was already refunded. Uses row-level locking to prevent race conditions.';

-- Grant execute permission to authenticated users (they can call it through RLS policies)
GRANT EXECUTE ON FUNCTION issue_refund_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION issue_refund_atomic TO service_role;
