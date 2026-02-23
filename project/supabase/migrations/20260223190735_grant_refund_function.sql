-- Grant execute permissions on issue_refund_atomic function
GRANT EXECUTE ON FUNCTION issue_refund_atomic(uuid, integer, text, varchar) TO authenticated;
