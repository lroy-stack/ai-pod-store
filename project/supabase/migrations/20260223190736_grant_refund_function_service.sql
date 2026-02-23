-- Grant execute permissions on issue_refund_atomic to service_role
GRANT EXECUTE ON FUNCTION issue_refund_atomic(uuid, integer, text, varchar) TO service_role;
