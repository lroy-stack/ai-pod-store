-- Marketing content/campaigns (Feature 367)
CREATE TABLE IF NOT EXISTS marketing_content (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_session_id text,
  platform text NOT NULL,
  campaign_name text,
  product_id uuid REFERENCES products(id),
  copy text NOT NULL,
  hashtags text[],
  cta text,
  alt_text text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text DEFAULT 'draft',
  performance jsonb DEFAULT '{}',
  locale text DEFAULT 'en',
  created_at timestamptz DEFAULT now()
);

-- Newsletter campaigns + tracking (Feature 379)
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_session_id text,
  campaign_name text NOT NULL,
  segment text NOT NULL,
  locale text DEFAULT 'en',
  subject_a text,
  subject_b text,
  preview_text text,
  body_html text,
  cta_a text,
  cta_b text,
  status text DEFAULT 'draft',
  sent_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  open_rate numeric(5,2),
  click_rate numeric(5,2),
  unsubscribe_count int DEFAULT 0,
  ab_winner text,
  drip_sequence text,
  drip_step int,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Newsletter subscribers (Feature 380)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  locale text DEFAULT 'en',
  subscribed boolean DEFAULT true,
  unsubscribed_at timestamptz,
  preferences jsonb DEFAULT '{}',
  rfm_segment text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_content_platform ON marketing_content(platform);
CREATE INDEX IF NOT EXISTS idx_marketing_content_status ON marketing_content(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_segment ON newsletter_campaigns(segment);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_segment ON newsletter_subscribers(rfm_segment);
