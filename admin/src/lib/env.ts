/**
 * Environment variable helpers — fail-fast for required secrets,
 * graceful fallback for optional ones.
 */

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // During `next build`, env vars may not be available.
    // Return placeholder to allow build to complete.
    // At runtime, the real values are always present (validated by start.sh).
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      console.warn(`[env] ${name} not set — using build-time placeholder`);
      return `__BUILD_PLACEHOLDER_${name}__`;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}
