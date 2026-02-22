-- Product Lifecycle Decisions: audit trail for kill/scale/iterate decisions
CREATE TABLE IF NOT EXISTS product_lifecycle_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('kill', 'scale', 'iterate', 'hold', 'archive')),
  reason TEXT,
  agent_name TEXT NOT NULL,
  confidence DOUBLE PRECISION CHECK (confidence >= 0.0 AND confidence <= 1.0),
  metrics_snapshot JSONB,
  approval_status TEXT NOT NULL DEFAULT 'auto' CHECK (approval_status IN ('auto', 'pending', 'approved', 'rejected')),
  approved_by TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plc_product ON product_lifecycle_decisions(product_id, created_at DESC);
CREATE INDEX idx_plc_status ON product_lifecycle_decisions(approval_status) WHERE approval_status = 'pending';

ALTER TABLE product_lifecycle_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on product_lifecycle_decisions"
  ON product_lifecycle_decisions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
