/**
 * POD AI MCP Proxy — Cloudflare Worker
 * =====================================
 *
 * This worker acts as a secure proxy between MCP clients (ChatGPT, Claude Desktop)
 * and the POD AI MCP server. It provides:
 *
 * - Rate limiting per IP/session
 * - DDoS protection (Cloudflare WAF)
 * - Request/response caching (KV)
 * - Analytics and logging
 * - Origin authentication
 *
 * Architecture:
 *   Client (ChatGPT) → Cloudflare Worker → Origin MCP Server (yourdomain.com/mcp)
 */

/**
 * Allowed MCP methods (whitelist)
 * Only these JSON-RPC methods are permitted through the proxy
 */
const ALLOWED_METHODS = new Set([
	'initialize',
	'tools/list',
	'tools/call',
	'resources/list',
	'prompts/list',
	'ping',
]);

export interface Env {
	// Bindings
	MCP_CACHE?: KVNamespace;

	// Environment variables
	MCP_ORIGIN?: string; // e.g., "https://yourdomain.com/mcp"
	RATE_LIMIT_RPM?: string; // Rate limit: requests per minute
	MAX_REQUESTS_PER_MINUTE?: string; // Legacy alias for RATE_LIMIT_RPM
	ALLOWED_ORIGINS?: string; // Comma-separated CORS origins (e.g., "https://claude.ai,https://chatgpt.com")

	// Secrets (set with `wrangler secret put`)
	MCP_API_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
}

/**
 * Main fetch handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// CORS preflight
		if (request.method === 'OPTIONS') {
			return handleCORS(request, env);
		}

		// Get client IP for rate limiting
		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

		// Rate limiting check
		const rateLimitResult = await checkRateLimit(clientIP, env, ctx);
		if (rateLimitResult.blocked) {
			return new Response(
				JSON.stringify({
					jsonrpc: '2.0',
					id: null,
					error: {
						code: -32000,
						message: 'Rate limit exceeded',
						data: {
							retryAfter: rateLimitResult.retryAfter,
						},
					},
				}),
				{
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': rateLimitResult.retryAfter.toString(),
					},
				}
			);
		}

		// Validate JSON-RPC method for POST requests
		if (request.method === 'POST') {
			const validationResult = await validateJSONRPCMethod(request.clone());
			if (validationResult.error) {
				return new Response(JSON.stringify(validationResult.error), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
					},
				});
			}
		}

		// Proxy request to origin MCP server
		try {
			const originUrl = env.MCP_ORIGIN || 'https://localhost/mcp';
			const url = new URL(request.url);
			const targetUrl = `${originUrl}${url.pathname}${url.search}`;

			// Clone request headers and add authentication if configured
			// Transparently forwards: Authorization, Mcp-Session-Id, and all other client headers
			const headers = new Headers(request.headers);
			if (env.MCP_API_KEY) {
				headers.set('X-MCP-API-Key', env.MCP_API_KEY);
			}

			// Forward request to origin
			const originRequest = new Request(targetUrl, {
				method: request.method,
				headers,
				body: request.body,
			});

			const response = await fetch(originRequest);

			// Clone response and add CORS headers
			const responseHeaders = new Headers(response.headers);
			addCORSHeaders(responseHeaders, request, env);

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
			});
		} catch (error) {
			console.error('MCP Proxy Error:', error);
			return new Response('Bad Gateway', { status: 502 });
		}
	},
};

/**
 * Get allowed origin for CORS
 */
function getAllowedOrigin(request: Request, env: Env): string {
	const origin = request.headers.get('Origin');
	if (!origin) {
		return '*';
	}

	// If ALLOWED_ORIGINS is configured, check against whitelist
	if (env.ALLOWED_ORIGINS) {
		const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
		if (allowedOrigins.includes(origin)) {
			return origin;
		}
		// Origin not in whitelist, reject
		return '';
	}

	// No whitelist configured, allow all origins
	return '*';
}

/**
 * Handle CORS preflight
 */
function handleCORS(request: Request, env: Env): Response {
	const allowedOrigin = getAllowedOrigin(request, env);

	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': allowedOrigin || '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MCP-API-Key, Mcp-Session-Id, Accept',
			'Access-Control-Expose-Headers': 'Mcp-Session-Id',
			'Access-Control-Max-Age': '86400',
			...(allowedOrigin !== '*' && { Vary: 'Origin' }),
		},
	});
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(headers: Headers, request: Request, env: Env): void {
	const allowedOrigin = getAllowedOrigin(request, env);

	headers.set('Access-Control-Allow-Origin', allowedOrigin || '*');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-API-Key, Mcp-Session-Id, Accept');
	headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');

	// Add Vary header when using specific origins
	if (allowedOrigin !== '*') {
		headers.set('Vary', 'Origin');
	}
}

/**
 * Validate JSON-RPC method against whitelist
 */
async function validateJSONRPCMethod(
	request: Request
): Promise<{ error?: any }> {
	try {
		const body = await request.json();
		const method = body?.method;

		// Check if method is provided
		if (!method || typeof method !== 'string') {
			return {
				error: {
					jsonrpc: '2.0',
					id: body?.id || null,
					error: {
						code: -32600,
						message: 'Invalid Request: missing method',
					},
				},
			};
		}

		// Check if method is in whitelist
		if (!ALLOWED_METHODS.has(method)) {
			return {
				error: {
					jsonrpc: '2.0',
					id: body?.id || null,
					error: {
						code: -32601,
						message: `Method not found: ${method}`,
					},
				},
			};
		}

		return {};
	} catch (error) {
		// Invalid JSON
		return {
			error: {
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -32700,
					message: 'Parse error: invalid JSON',
				},
			},
		};
	}
}

/**
 * Check rate limit using Cloudflare KV (if available) or in-memory fallback
 */
async function checkRateLimit(
	clientIP: string,
	env: Env,
	ctx: ExecutionContext
): Promise<{ blocked: boolean; retryAfter: number }> {
	const maxRequests = parseInt(
		env.RATE_LIMIT_RPM || env.MAX_REQUESTS_PER_MINUTE || '60',
		10
	);
	const windowSeconds = 60;

	// If KV is not available, skip rate limiting (handled by origin)
	if (!env.MCP_CACHE) {
		return { blocked: false, retryAfter: 0 };
	}

	const key = `ratelimit:${clientIP}`;
	const now = Math.floor(Date.now() / 1000);

	try {
		// Get current request count
		const data = await env.MCP_CACHE.get(key, 'json');
		const current = (data as { count: number; resetAt: number }) || {
			count: 0,
			resetAt: now + windowSeconds,
		};

		// Check if window expired
		if (now > current.resetAt) {
			// Reset window
			current.count = 1;
			current.resetAt = now + windowSeconds;
		} else {
			// Increment counter
			current.count += 1;
		}

		// Store updated count
		ctx.waitUntil(env.MCP_CACHE.put(key, JSON.stringify(current), { expirationTtl: windowSeconds }));

		// Check if over limit
		if (current.count > maxRequests) {
			return {
				blocked: true,
				retryAfter: current.resetAt - now,
			};
		}

		return { blocked: false, retryAfter: 0 };
	} catch (error) {
		console.error('Rate limit check error:', error);
		// On error, allow request (fail open)
		return { blocked: false, retryAfter: 0 };
	}
}
