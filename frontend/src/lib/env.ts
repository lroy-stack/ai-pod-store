// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

/**
 * Environment variable access — fail-fast for required vars.
 *
 * Rules:
 * - requiredEnv: throws if var is missing or empty. Never returns a business-value fallback.
 * - optionalEnv: returns empty string (or explicit safe default) if missing.
 *
 * During `next build`, server-side env vars may not be injected.
 * requiredEnv uses a BUILD_PLACEHOLDER so the build completes;
 * the real value is always present at runtime (validated by start.sh / Docker).
 */

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    // Allow Next.js build to complete without all runtime vars present.
    // At runtime these are always set — start.sh validates before docker compose up.
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
      if (isBuildPhase) {
        return `__MISSING_${name}__`
      }
      throw new Error(`[env] Required environment variable not set: ${name}`)
    }
    throw new Error(`[env] Required environment variable not set: ${name}`)
  }
  return value
}

export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}
