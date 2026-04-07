/**
 * Query Sanitizer for Supabase PostgREST Queries
 *
 * SECURITY: PostgREST's .or() method requires string parameters, which can be vulnerable
 * to SQL injection if user input is directly interpolated. This module provides sanitization
 * functions to prevent injection attacks.
 */

/**
 * Sanitize user input for use in PostgREST query strings
 *
 * Escapes special characters that have meaning in PostgREST query syntax:
 * - Commas (,) are separators in .or() conditions
 * - Dots (.) are operator separators
 * - Parentheses ( ) are used for grouping
 * - Percent signs (%) are wildcards in LIKE queries (should be allowed but position-controlled)
 *
 * @param input - User-provided input string
 * @returns Sanitized string safe for PostgREST queries
 */
export function sanitizeForPostgrest(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Remove or escape characters that could break query syntax
  return input
    .replace(/,/g, '') // Remove commas (separator in .or())
    .replace(/\(/g, '') // Remove left parenthesis
    .replace(/\)/g, '') // Remove right parenthesis
    .replace(/\./g, '') // Remove dots (operator separator)
    .replace(/;/g, '') // Remove semicolons (SQL statement separator)
    .replace(/'/g, "''") // Escape single quotes (SQL string delimiter)
    .replace(/"/g, '') // Remove double quotes
    .replace(/\\/g, '') // Remove backslashes
    .trim()
}

/**
 * Sanitize input for LIKE/ILIKE queries
 *
 * Preserves % wildcards at start/end but escapes them in the middle.
 * Removes other special characters.
 *
 * @param input - User-provided search string
 * @param wildcardPosition - Where to allow wildcards: 'both', 'start', 'end', 'none'
 * @returns Sanitized string safe for LIKE/ILIKE queries
 */
export function sanitizeForLike(
  input: string,
  wildcardPosition: 'both' | 'start' | 'end' | 'none' = 'none'
): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // First apply basic sanitization
  let sanitized = sanitizeForPostgrest(input)

  // Remove all % signs (we'll add them back in controlled positions)
  sanitized = sanitized.replace(/%/g, '')

  // Add wildcards in controlled positions
  switch (wildcardPosition) {
    case 'both':
      return `%${sanitized}%`
    case 'start':
      return `%${sanitized}`
    case 'end':
      return `${sanitized}%`
    case 'none':
    default:
      return sanitized
  }
}

/**
 * Validate UUID format (UUIDs are safe to use in queries)
 *
 * @param input - String to validate
 * @returns true if input is a valid UUID v4, false otherwise
 */
export function isValidUuid(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  return uuidRegex.test(input)
}

/**
 * Sanitize array of UUIDs (for use in .in() operations within .or())
 *
 * @param ids - Array of UUID strings
 * @returns Sanitized array of valid UUIDs
 */
export function sanitizeUuidArray(ids: string[]): string[] {
  if (!Array.isArray(ids)) {
    return []
  }

  return ids.filter(isValidUuid)
}
