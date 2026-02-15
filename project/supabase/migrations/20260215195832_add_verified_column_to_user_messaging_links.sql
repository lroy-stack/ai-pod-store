-- Add missing columns to user_messaging_links table

-- Add verified column if it doesn't exist
ALTER TABLE user_messaging_links
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Add platform_username column if it doesn't exist
ALTER TABLE user_messaging_links
ADD COLUMN IF NOT EXISTS platform_username TEXT;

-- Add linked_at column if it doesn't exist
ALTER TABLE user_messaging_links
ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ DEFAULT now();
