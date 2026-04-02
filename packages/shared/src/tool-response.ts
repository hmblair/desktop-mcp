/**
 * Shared MCP tool response helpers.
 */

export function toolResponse(data: unknown, isError = false) {
  const content: { type: "text"; text: string; isError?: true }[] = [
    { type: "text", text: JSON.stringify(data, null, 2), ...(isError && { isError: true as const }) },
  ];
  return { content };
}

export function toolError(toolName: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tool] ${toolName} failed: ${message}`);
  return toolResponse({ success: false, error: `${toolName}: ${message}` }, true);
}
