/**
 * MCP OAuth Client Registry
 *
 * Static registry of known MCP clients with redirect URI allowlists.
 * Extensible via MCP_REGISTERED_CLIENTS env var (JSON) and Dynamic
 * Client Registration (RFC 7591) via POST /register.
 *
 * Security:
 * - All redirect_uris are validated against allowlist before use
 * - localhost wildcard ports allowed per RFC 8252 (native apps)
 * - Path wildcards supported with trailing * only
 * - Unknown client_ids are always rejected
 * - DCR clients stored in Redis (30d TTL) + in-memory fallback
 */

import { randomBytes } from 'node:crypto';

export interface ClientConfig {
  name: string;
  redirect_uris: string[];
  scopes: string[];
  type: 'public' | 'confidential';
}

/**
 * Built-in client registry.
 * Add new clients here or via MCP_REGISTERED_CLIENTS env var.
 */
const BUILTIN_CLIENTS: Record<string, ClientConfig> = {
  'claude-desktop': {
    name: 'Claude Desktop',
    redirect_uris: ['http://localhost:*'],
    scopes: ['read', 'write'],
    type: 'public',
  },
  'claude-ai': {
    name: 'Claude (claude.ai)',
    redirect_uris: [
      'https://claude.ai/oauth/callback',
      'https://claude.ai/api/oauth/callback',
      'https://claude.ai/api/mcp/auth_callback',
      'https://claude.com/api/mcp/auth_callback',
    ],
    scopes: ['read', 'write'],
    type: 'public',
  },
  'chatgpt': {
    name: 'ChatGPT',
    redirect_uris: ['https://chatgpt.com/aip/*/oauth/callback'],
    scopes: ['read', 'write'],
    type: 'public',
  },
  'store-web': {
    name: 'Store Web App',
    redirect_uris: [
      // Add your production domain here via MCP_REGISTERED_CLIENTS env var instead
      'http://localhost:3000/*/auth/mcp-callback',
    ],
    scopes: ['read', 'write'],
    type: 'public',
  },
};

// Add your production store's MCP OAuth client via MCP_REGISTERED_CLIENTS env var:
// MCP_REGISTERED_CLIENTS={"my-store":{"name":"My Store","redirect_uris":["https://yourdomain.com/*/auth/mcp-callback"],"scopes":["read","write"],"type":"public"}}

/** Merged client map (builtin + env-configured) */
let _clients: Record<string, ClientConfig> | null = null;

function loadClients(): Record<string, ClientConfig> {
  if (_clients) return _clients;

  _clients = { ...BUILTIN_CLIENTS };

  const envClients = process.env.MCP_REGISTERED_CLIENTS;
  if (envClients) {
    try {
      const parsed = JSON.parse(envClients) as Record<string, ClientConfig>;
      for (const [id, config] of Object.entries(parsed)) {
        if (config.name && Array.isArray(config.redirect_uris) && Array.isArray(config.scopes)) {
          _clients[id] = {
            name: config.name,
            redirect_uris: config.redirect_uris,
            scopes: config.scopes,
            type: config.type || 'public',
          };
        } else {
          console.warn(`[ClientRegistry] Skipping invalid client config for "${id}"`);
        }
      }
      console.info(`[ClientRegistry] Loaded ${Object.keys(parsed).length} client(s) from MCP_REGISTERED_CLIENTS`);
    } catch (err) {
      console.error('[ClientRegistry] Failed to parse MCP_REGISTERED_CLIENTS:', err);
    }
  }

  return _clients;
}

// ─── Dynamic Client Registration (RFC 7591) ────────────────────────────────

/** In-memory store for dynamically registered clients */
const dcrClients = new Map<string, ClientConfig & { issued_at: number }>();
const DCR_MAX_CLIENTS = 500;
const DCR_REDIS_TTL = 30 * 24 * 60 * 60; // 30 days
const DCR_CLIENT_PREFIX = 'dyn_';

function evictDcrIfFull(): void {
  if (dcrClients.size < DCR_MAX_CLIENTS) return;
  const evictCount = Math.floor(DCR_MAX_CLIENTS * 0.2);
  const keys = dcrClients.keys();
  for (let i = 0; i < evictCount; i++) {
    const key = keys.next().value;
    if (key !== undefined) dcrClients.delete(key);
  }
}

/**
 * Register a new dynamic client. Returns the generated client_id.
 * Stores in Redis (with 30-day TTL) + in-memory fallback.
 */
export async function registerDynamicClient(
  clientName: string,
  redirectUris: string[],
  redis: { status: string; setex: (key: string, ttl: number, value: string) => Promise<string> } | null,
): Promise<{ client_id: string; config: ClientConfig; issued_at: number }> {
  const clientId = DCR_CLIENT_PREFIX + randomBytes(16).toString('hex');
  const config: ClientConfig = {
    name: clientName,
    redirect_uris: redirectUris,
    scopes: ['read', 'write'],
    type: 'public',
  };
  const issued_at = Math.floor(Date.now() / 1000);

  // Store in Redis
  if (redis && redis.status === 'ready') {
    try {
      await redis.setex(
        `oauth:dcr:${clientId}`,
        DCR_REDIS_TTL,
        JSON.stringify({ ...config, issued_at }),
      );
    } catch {
      // Fall through to in-memory
    }
  }

  // Always store in-memory as fallback
  evictDcrIfFull();
  dcrClients.set(clientId, { ...config, issued_at });

  console.info(`[ClientRegistry] DCR: registered client "${clientName}" as ${clientId}`);
  return { client_id: clientId, config, issued_at };
}

/**
 * Get a dynamically registered client from Redis or in-memory.
 */
export async function getDynamicClient(
  clientId: string,
  redis: { status: string; get: (key: string) => Promise<string | null> } | null,
): Promise<ClientConfig | undefined> {
  if (!clientId.startsWith(DCR_CLIENT_PREFIX)) return undefined;

  // Check Redis first
  if (redis && redis.status === 'ready') {
    try {
      const raw = await redis.get(`oauth:dcr:${clientId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          name: parsed.name,
          redirect_uris: parsed.redirect_uris,
          scopes: parsed.scopes,
          type: parsed.type || 'public',
        };
      }
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const entry = dcrClients.get(clientId);
  if (entry) {
    return {
      name: entry.name,
      redirect_uris: entry.redirect_uris,
      scopes: entry.scopes,
      type: entry.type,
    };
  }

  return undefined;
}

/**
 * Get client config by ID. Checks static registry first, then DCR store.
 */
export function getClient(clientId: string): ClientConfig | undefined {
  // Static registry (synchronous)
  const staticClient = loadClients()[clientId];
  if (staticClient) return staticClient;

  // DCR clients need async lookup — use getClientAsync for those
  // This sync version only checks in-memory DCR fallback
  if (clientId.startsWith(DCR_CLIENT_PREFIX)) {
    const entry = dcrClients.get(clientId);
    if (entry) return entry;
  }

  return undefined;
}

/**
 * Get client config by ID (async — checks Redis for DCR clients).
 */
export async function getClientAsync(
  clientId: string,
  redis: { status: string; get: (key: string) => Promise<string | null> } | null,
): Promise<ClientConfig | undefined> {
  // Static registry first
  const staticClient = loadClients()[clientId];
  if (staticClient) return staticClient;

  // Then DCR
  return getDynamicClient(clientId, redis);
}

/**
 * List all registered client IDs.
 */
export function listClientIds(): string[] {
  return Object.keys(loadClients());
}

/**
 * Validate a redirect_uri against the client's allowlist.
 *
 * Patterns:
 * - `http://localhost:*` — matches any port on localhost (RFC 8252 §7.3)
 * - `http://127.0.0.1:*` — same for IPv4 loopback
 * - `https://domain.com/path/*` — wildcard suffix on path
 * - Exact match for everything else
 */
export function validateRedirectUri(clientId: string, redirectUri: string): boolean {
  const client = getClient(clientId);
  if (!client) return false;

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return false;
  }

  for (const pattern of client.redirect_uris) {
    if (matchUriPattern(pattern, parsed, redirectUri)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a single URI pattern against a parsed redirect URI.
 */
function matchUriPattern(pattern: string, parsed: URL, original: string): boolean {
  // Localhost wildcard port: http://localhost:*
  if (pattern === 'http://localhost:*' || pattern === 'http://127.0.0.1:*') {
    const allowedHost = pattern.includes('127.0.0.1') ? '127.0.0.1' : 'localhost';
    return (
      parsed.protocol === 'http:' &&
      parsed.hostname === allowedHost &&
      parsed.port !== '' &&
      /^\d+$/.test(parsed.port)
    );
  }

  // Glob-style path wildcard: * matches any single path segment
  if (pattern.includes('*')) {
    return matchGlobUri(pattern, original);
  }

  // Exact match
  return original === pattern;
}

/**
 * Match URI with glob-style wildcards.
 * `*` in the pattern matches one or more characters (non-greedy, within a path segment or port).
 *
 * Examples:
 *   `https://chatgpt.com/aip/* /oauth/callback` matches `https://chatgpt.com/aip/plugin-123/oauth/callback`
 *   `https://yourdomain.com/* /auth/mcp-callback` matches `https://yourdomain.com/en/auth/mcp-callback`
 *   `http://localhost:* /callback` matches `http://localhost:3000/callback`
 */
function matchGlobUri(pattern: string, uri: string): boolean {
  // Convert glob pattern to regex: * -> [^/]+ (match non-slash chars)
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except *)
    .replace(/\*/g, '[^/]+');                // * -> one or more non-slash chars

  try {
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(uri);
  } catch {
    return false;
  }
}

/**
 * Reset cached clients (for testing).
 */
export function _resetClients(): void {
  _clients = null;
}
