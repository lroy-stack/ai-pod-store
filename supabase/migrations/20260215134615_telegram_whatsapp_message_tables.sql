-- Telegram Messages Table
-- Stores raw Telegram webhook updates for audit and processing
CREATE TABLE telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  chat_id VARCHAR(255) NOT NULL,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  UNIQUE(update_id, message_id)
);

CREATE INDEX idx_telegram_user_id ON telegram_messages(user_id);
CREATE INDEX idx_telegram_chat_id ON telegram_messages(chat_id);
CREATE INDEX idx_telegram_created ON telegram_messages(created_at DESC);

-- WhatsApp Messages Table
-- Stores raw WhatsApp webhook updates for audit and processing
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255),
  phone_number_id VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  text_body TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX idx_whatsapp_created ON whatsapp_messages(created_at DESC);

-- Enable RLS
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Admin access policies
CREATE POLICY "Admins can view all telegram messages"
  ON telegram_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all whatsapp messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Service role can insert (webhook endpoints use service role)
CREATE POLICY "Service role can insert telegram messages"
  ON telegram_messages FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert whatsapp messages"
  ON whatsapp_messages FOR INSERT
  TO service_role
  WITH CHECK (true);
