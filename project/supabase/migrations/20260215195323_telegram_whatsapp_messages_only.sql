-- =====================================================
-- Telegram + WhatsApp Message Tables
-- =====================================================

-- Telegram Messages
-- Stores all incoming messages from Telegram bot
CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  user_id TEXT NOT NULL,  -- Telegram user ID (as string)
  username TEXT,  -- Telegram username (@handle)
  first_name TEXT NOT NULL,
  last_name TEXT,
  chat_id TEXT NOT NULL,  -- Telegram chat ID (as string)
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(update_id, message_id)
);

-- WhatsApp Messages
-- Stores all incoming messages from WhatsApp Business API
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,  -- WhatsApp message ID
  from_number TEXT NOT NULL,  -- Phone number in E.164 format
  from_name TEXT,
  text TEXT,
  media_url TEXT,  -- For image/video/document messages
  media_type TEXT,  -- image, video, document, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_user_id ON telegram_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_id ON telegram_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at ON telegram_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from_number ON whatsapp_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role only for now)
CREATE POLICY "Service role full access to telegram_messages" ON telegram_messages
  FOR ALL USING (true);

CREATE POLICY "Service role full access to whatsapp_messages" ON whatsapp_messages
  FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE telegram_messages IS 'Stores all incoming Telegram bot messages';
COMMENT ON TABLE whatsapp_messages IS 'Stores all incoming WhatsApp Business API messages';
