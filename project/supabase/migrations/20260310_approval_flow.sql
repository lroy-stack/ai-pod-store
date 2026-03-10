-- Design tasks workflow
CREATE TABLE IF NOT EXISTS design_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','designing','rendering','preview_sent','approved','rejected','product_created')),
  ceo_prompt TEXT,
  reference_image_url TEXT,
  design_type TEXT NOT NULL CHECK (design_type IN ('dtg','embroidery','sublimation')),
  blueprint_id INTEGER,
  canvas_specs JSONB,
  svg_url TEXT,
  png_url TEXT,
  mockup_url TEXT,
  printful_product_id TEXT,
  supabase_product_id UUID,
  feedback TEXT,
  agent_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CEO approvals (generic, any resource type)
CREATE TABLE IF NOT EXISTS ceo_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('design','product','refund','newsletter')),
  resource_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','timeout')),
  message_id TEXT,
  platform TEXT,
  ceo_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_design_tasks_status ON design_tasks(status);
CREATE INDEX idx_ceo_approvals_pending ON ceo_approvals(status) WHERE status = 'pending';
CREATE INDEX idx_ceo_approvals_resource ON ceo_approvals(resource_type, resource_id);
