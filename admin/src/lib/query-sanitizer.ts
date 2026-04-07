/**
 * Sanitize search input for use in Supabase PostgREST queries.
 *
 * Strips characters that could affect filter behavior: wildcards, operators,
 * quotes, and PostgREST-specific syntax. Truncates to 100 chars max.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[.,()%_*\\:!<>=[\]{}'";]/g, '').trim().slice(0, 100)
}
