-- Admin RBAC (Role-Based Access Control) System
-- Creates admin_roles and user_roles tables for granular permissions

-- Create admin_roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles join table (many-to-many: users <-> admin_roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON admin_roles(name);

-- Seed predefined admin roles
INSERT INTO admin_roles (name, display_name, description, permissions, is_system) VALUES
  (
    'super_admin',
    'Super Administrator',
    'Full system access with all permissions. Can manage users, roles, and system settings.',
    '{
      "users": ["create", "read", "update", "delete", "manage_roles"],
      "products": ["create", "read", "update", "delete", "publish"],
      "orders": ["create", "read", "update", "delete", "refund"],
      "designs": ["create", "read", "update", "delete", "moderate"],
      "settings": ["read", "update"],
      "analytics": ["read", "export"],
      "finance": ["read", "export"],
      "themes": ["create", "read", "update", "delete"],
      "translations": ["create", "read", "update", "delete"],
      "roles": ["create", "read", "update", "delete"]
    }'::jsonb,
    true
  ),
  (
    'manager',
    'Manager',
    'Can manage products, orders, and designs. No user/role management or system settings.',
    '{
      "users": ["read"],
      "products": ["create", "read", "update", "delete", "publish"],
      "orders": ["create", "read", "update", "refund"],
      "designs": ["create", "read", "update", "delete", "moderate"],
      "settings": ["read"],
      "analytics": ["read", "export"],
      "finance": ["read"],
      "themes": ["read", "update"],
      "translations": ["read", "update"]
    }'::jsonb,
    true
  ),
  (
    'support',
    'Support Agent',
    'Can view and manage orders, view products and users. Read-only access to most areas.',
    '{
      "users": ["read"],
      "products": ["read"],
      "orders": ["read", "update"],
      "designs": ["read"],
      "settings": ["read"],
      "analytics": ["read"],
      "finance": []
    }'::jsonb,
    true
  ),
  (
    'viewer',
    'Viewer',
    'Read-only access to products, orders, and analytics. No modification permissions.',
    '{
      "users": [],
      "products": ["read"],
      "orders": ["read"],
      "designs": ["read"],
      "settings": [],
      "analytics": ["read"],
      "finance": []
    }'::jsonb,
    true
  )
ON CONFLICT (name) DO NOTHING;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, resource TEXT, action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN admin_roles ar ON ur.role_id = ar.id
    WHERE ur.user_id = user_uuid
      AND ar.permissions->resource ? action
  ) INTO has_perm;

  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE (
  role_id UUID,
  role_name VARCHAR(50),
  display_name VARCHAR(100),
  permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.name,
    ar.display_name,
    ar.permissions
  FROM user_roles ur
  JOIN admin_roles ar ON ur.role_id = ar.id
  WHERE ur.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE admin_roles IS 'Defines admin roles with granular permissions for RBAC';
COMMENT ON TABLE user_roles IS 'Join table linking users to their assigned admin roles';
COMMENT ON COLUMN admin_roles.permissions IS 'JSONB object with resource->actions mapping (e.g., {"products": ["read", "update"]})';
COMMENT ON COLUMN admin_roles.is_system IS 'System roles cannot be deleted or renamed (but permissions can be updated)';
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission for a resource';
COMMENT ON FUNCTION get_user_roles IS 'Get all roles assigned to a user with their permissions';
