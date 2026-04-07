import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from './session';
import { checkApiRateLimit } from '@/lib/rate-limit';

/**
 * RBAC (Role-Based Access Control) Middleware
 * Checks user permissions before allowing admin API actions
 * Updated to use iron-session for secure, encrypted session cookies
 */

export interface AdminSession {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'publish' | 'moderate' | 'refund' | 'export' | 'manage_roles';
}

/**
 * Extract and verify admin session from iron-session encrypted cookie
 * Updated to use iron-session instead of plain JSON cookies
 */
export async function getAdminSession(req?: NextRequest): Promise<AdminSession | null> {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || !session.id) {
      return null;
    }

    return {
      userId: session.id,
      email: session.email,
      role: session.role,
      name: session.name,
    };
  } catch (error) {
    console.error('[RBAC] Session retrieval error:', error);
    return null;
  }
}

/**
 * Check if user has a specific permission for a resource
 */
export async function hasPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  try {
    // Query user_roles and admin_roles to check permissions
    const { data: userRoles, error } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        admin_roles!inner(
          name,
          permissions
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('[RBAC] Permission check error:', error);
      return false;
    }

    if (!userRoles || userRoles.length === 0) {
      console.log('[RBAC] User has no roles assigned:', userId);
      return false;
    }

    // Check if any of the user's roles grant the required permission
    for (const userRole of userRoles) {
      const role = userRole.admin_roles as any;
      const permissions = role.permissions as Record<string, string[]>;

      // Check if this role has the permission
      if (permissions[resource] && permissions[resource].includes(action)) {
        console.log(`[RBAC] Permission granted: ${resource}.${action} via role ${role.name}`);
        return true;
      }
    }

    console.log(`[RBAC] Permission denied: ${resource}.${action} for user ${userId}`);
    return false;
  } catch (error) {
    console.error('[RBAC] Permission check error:', error);
    return false;
  }
}

/**
 * Check if user has super_admin role (unrestricted access)
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const { data: userRoles, error } = await supabaseAdmin
      .from('user_roles')
      .select(`
        admin_roles!inner(name)
      `)
      .eq('user_id', userId);

    if (error || !userRoles) {
      return false;
    }

    return userRoles.some(
      (ur: any) => ur.admin_roles.name === 'super_admin'
    );
  } catch (error) {
    console.error('[RBAC] Super admin check error:', error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Record<string, string[]>> {
  try {
    const { data: userRoles, error } = await supabaseAdmin
      .from('user_roles')
      .select(`
        admin_roles!inner(
          name,
          permissions
        )
      `)
      .eq('user_id', userId);

    if (error || !userRoles) {
      return {};
    }

    // Merge permissions from all roles
    const mergedPermissions: Record<string, Set<string>> = {};

    for (const userRole of userRoles) {
      const role = userRole.admin_roles as any;
      const permissions = role.permissions as Record<string, string[]>;

      for (const [resource, actions] of Object.entries(permissions)) {
        if (!mergedPermissions[resource]) {
          mergedPermissions[resource] = new Set();
        }
        actions.forEach((action) => mergedPermissions[resource].add(action));
      }
    }

    // Convert Sets to arrays
    const result: Record<string, string[]> = {};
    for (const [resource, actionsSet] of Object.entries(mergedPermissions)) {
      result[resource] = Array.from(actionsSet);
    }

    return result;
  } catch (error) {
    console.error('[RBAC] Get user permissions error:', error);
    return {};
  }
}

/**
 * Middleware wrapper for API routes that require specific permissions
 *
 * Usage:
 *   export const GET = withPermission('products', 'read', async (req, session) => { ... });
 *   export const POST = withPermission('products', 'create', async (req, session) => { ... });
 *   export const GET = withPermission('products', 'read', async (req, session, context) => { ... }); // with context
 */
export function withPermission(
  resource: string,
  action: string,
  handler: (req: NextRequest, session: AdminSession, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // Check API rate limits first
    const rateLimitResult = await checkApiRateLimit(req)
    if (rateLimitResult) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Step 1: Verify admin session
    const session = await getAdminSession(req);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - admin session required' },
        { status: 401 }
      );
    }

    // Step 2: Check if user is super_admin (unrestricted)
    const isSuper = await isSuperAdmin(session.userId);
    if (isSuper) {
      console.log(`[RBAC] Super admin access granted for ${resource}.${action}`);
      return handler(req, session, context);
    }

    // Step 3: Check specific permission
    const hasPerm = await hasPermission(session.userId, resource, action);

    if (!hasPerm) {
      return NextResponse.json(
        {
          error: 'Forbidden - insufficient permissions',
          required: `${resource}.${action}`
        },
        { status: 403 }
      );
    }

    // Permission granted, execute handler
    return handler(req, session, context);
  };
}

/**
 * Require authentication only (no specific permission check)
 * Useful for GET endpoints that any admin can access
 */
export function requireAuth(
  handler: (req: NextRequest, session: AdminSession) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await getAdminSession(req);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - admin session required' },
        { status: 401 }
      );
    }

    return handler(req, session);
  };
}
