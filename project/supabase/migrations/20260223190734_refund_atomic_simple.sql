-- Atomic refund processing function
-- Returns TRUE if refund processed, FALSE if already refunded

CREATE OR REPLACE FUNCTION issue_refund_atomic(
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
$$;
