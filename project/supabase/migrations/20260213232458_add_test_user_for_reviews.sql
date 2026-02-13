-- Insert a test user with a fixed UUID for review submissions
-- This user is used when submitting reviews without authentication
INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testuser@podstore.local',
  '$2a$10$rQZ4YXxN5nU5yXHkJxYhPeVYvJ.xz8HWz8mQxqXPKxYzJ5XqwYXKu',
  'Test User',
  'customer',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
