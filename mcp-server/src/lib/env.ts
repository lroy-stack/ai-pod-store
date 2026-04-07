// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

/**
 * Environment variable access — fail-fast for required vars.
 *
 * Rules:
 * - requiredEnv: throws at module load if var is missing or empty.
 * - optionalEnv: returns empty string (or explicit safe default) if missing.
 *
 * MCP server is a long-running Node process — missing required vars
 * must crash at startup, not silently produce wrong behavior.
 */

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[mcp-server] Required environment variable not set: ${name}`)
  }
  return value
}

export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}
