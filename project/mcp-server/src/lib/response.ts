/**
 * Unified response wrapper for MCP tool handlers.
 * Eliminates the repeated pattern across all 17 tools.
 */
export function createToolResponse(result: any) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
    isError: !result.success,
  };
}
