import { supabaseAdmin } from '@/lib/supabase';

/**
 * Audit Logging Utility
 * Records admin actions for compliance and debugging
 */

export interface AuditLogEntry {
  actor_type: 'admin' | 'ai_agent' | 'system' | 'webhook';
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: {
    before?: any;
    after?: any;
    fields?: string[];
  };
  metadata?: Record<string, any>;
}

/**
 * Log an audit event to the audit_log table
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_type: entry.actor_type,
        actor_id: entry.actor_id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id || null,
        changes: entry.changes || {},
        metadata: entry.metadata || {},
      });

    if (error) {
      console.error('[AUDIT] Failed to log audit entry:', error);
    } else {
      console.log(`[AUDIT] ${entry.action} on ${entry.resource_type} by ${entry.actor_id}`);
    }
  } catch (error) {
    console.error('[AUDIT] Audit logging error:', error);
  }
}

/**
 * Helper to compare objects and extract changes
 */
export function getChanges(before: any, after: any): { before: any; after: any; fields: string[] } {
  if (!before || !after) {
    return { before, after, fields: [] };
  }

  const changedFields: string[] = [];
  const beforeChanges: Record<string, any> = {};
  const afterChanges: Record<string, any> = {};

  // Compare each field
  for (const key of Object.keys({ ...before, ...after })) {
    // Skip metadata fields
    if (key === 'updated_at' || key === 'created_at') {
      continue;
    }

    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedFields.push(key);
      beforeChanges[key] = before[key];
      afterChanges[key] = after[key];
    }
  }

  return {
    before: beforeChanges,
    after: afterChanges,
    fields: changedFields,
  };
}

/**
 * Log a create action
 */
export async function logCreate(
  actorId: string,
  resourceType: string,
  resourceId: string,
  data: any,
  adminEmail?: string
): Promise<void> {
  await logAudit({
    actor_type: 'admin',
    actor_id: actorId,
    action: 'create',
    resource_type: resourceType,
    resource_id: resourceId,
    changes: {
      after: data,
    },
    metadata: adminEmail ? { admin_email: adminEmail } : undefined,
  });
}

/**
 * Log an update action with before/after comparison
 */
export async function logUpdate(
  actorId: string,
  resourceType: string,
  resourceId: string,
  before: any,
  after: any,
  adminEmail?: string
): Promise<void> {
  const changes = getChanges(before, after);

  await logAudit({
    actor_type: 'admin',
    actor_id: actorId,
    action: 'update',
    resource_type: resourceType,
    resource_id: resourceId,
    changes,
    metadata: adminEmail ? { admin_email: adminEmail } : undefined,
  });
}

/**
 * Log a delete action
 */
export async function logDelete(
  actorId: string,
  resourceType: string,
  resourceId: string,
  data: any,
  adminEmail?: string
): Promise<void> {
  await logAudit({
    actor_type: 'admin',
    actor_id: actorId,
    action: 'delete',
    resource_type: resourceType,
    resource_id: resourceId,
    changes: {
      before: data,
    },
    metadata: adminEmail ? { admin_email: adminEmail } : undefined,
  });
}
