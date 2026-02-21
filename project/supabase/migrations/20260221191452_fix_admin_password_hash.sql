-- Fix admin user password hash
-- The original migration had an incorrect bcrypt hash
-- This updates it to the correct hash for password 'admin123'

UPDATE users
SET password_hash = '$2b$10$CJJCGQqBQGsz98AAkzl1oukiynF/9HUk2yP2eJWnAYUVJOrKJTZ6i'
WHERE email = 'admin@podstore.local' AND role = 'admin';
