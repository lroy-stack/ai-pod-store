ALTER TABLE designs ADD COLUMN IF NOT EXISTS printify_upload_id VARCHAR(255);
ALTER TABLE designs ADD COLUMN IF NOT EXISTS printify_image_url TEXT;
