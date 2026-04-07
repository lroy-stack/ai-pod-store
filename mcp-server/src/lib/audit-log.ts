/**
 * Audit logging for MCP tool calls
 * Emits structured JSON to stdout for each tool invocation
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

interface AuditLogEntry {
  timestamp: string;
  tool: string;
  duration_ms: number;
  success: boolean;
  user_id?: string;
  client_id?: string;
  input_sanitized: unknown;
  error?: string;
}

/**
 * Sanitize sensitive fields from input before logging
 * Removes: access_token, password, api_key, secret, etc.
 */
function sanitizeInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  const sensitiveKeys = [
    'access_token',
    'password',
    'api_key',
    'secret',
    'token',
    'authorization',
    'bearer',
  ];

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Emit structured JSON audit log to stdout
 */
function emitAuditLog(entry: AuditLogEntry): void {
  // Use console.log (stdout) for structured logs
  // Production systems can parse these with jq or log aggregators
  console.log(JSON.stringify(entry));
}

/**
 * Wrap a tool handler with audit logging
 */
export function withAuditLog<TInput, TExtra extends { authInfo?: AuthInfo } | undefined>(
  toolName: string,
  handler: (input: TInput, extra?: TExtra) => Promise<any>
): (input: TInput, extra?: TExtra) => Promise<any> {
  return async (input: TInput, extra?: TExtra) => {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const result = await handler(input, extra);
      success = !result.isError;
      return result;
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const duration_ms = Date.now() - startTime;

      // Extract userId and clientId from authInfo
      const authExtra = extra && 'authInfo' in extra ? extra.authInfo : undefined;
      const userId = authExtra?.extra?.userId ? String(authExtra.extra.userId) : undefined;
      const clientId = authExtra?.clientId ? String(authExtra.clientId) : undefined;

      const auditEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        tool: toolName,
        duration_ms,
        success,
        user_id: userId,
        client_id: clientId,
        input_sanitized: sanitizeInput(input),
      };

      if (error) {
        auditEntry.error = error;
      }

      emitAuditLog(auditEntry);
    }
  };
}
