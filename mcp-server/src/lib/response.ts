/**
 * Unified response wrapper for MCP tool handlers.
 * Returns TextContent with JSON data. Images are rendered
 * by MCP Apps widgets (HTML iframes) — not embedded as base64.
 */
export function createToolResponse(result: unknown) {
  const r = result as Record<string, unknown>;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
    isError: !r.success,
  };
}
