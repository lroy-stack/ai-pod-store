-- Messaging Integration Tables
-- Telegram + WhatsApp dual-mode messaging for admin and customer interactions

CREATE TABLE messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_messaging_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  platform_user_id VARCHAR(255) NOT NULL,
  platform_username VARCHAR(255),
  is_admin_mode BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_user_id)
);

CREATE TABLE messaging_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_messaging_link_id UUID REFERENCES user_messaging_links(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_conv_link ON messaging_conversations(user_messaging_link_id);
CREATE INDEX idx_msg_conv_created ON messaging_conversations(created_at DESC);
CREATE INDEX idx_user_msg_platform ON user_messaging_links(platform, platform_user_id);

ALTER TABLE messaging_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_messaging_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_conversations ENABLE ROW LEVEL SECURITY;
