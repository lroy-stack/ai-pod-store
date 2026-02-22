-- ⚠️  DEPRECATED: This migration is no longer needed
--
-- SECURITY: Do NOT set hardcoded admin passwords in migrations!
-- The initial schema migration now omits the default admin user insert.
-- Instead, use: node scripts/create-secure-admin.mjs
--
-- This migration is kept for historical reference but commented out:
--
-- UPDATE users
-- SET password_hash = '$2b$10$...'  -- REMOVED: Hardcoded password hash
-- WHERE email = 'admin@podstore.local' AND role = 'admin';

-- No-op migration (already applied to existing databases, but does nothing on new deployments)
SELECT 1; -- Placeholder to keep migration valid
