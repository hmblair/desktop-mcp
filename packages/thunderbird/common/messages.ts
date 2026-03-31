/**
 * Message types for native messaging between Thunderbird extension and MCP server.
 *
 * Unlike firefox-mcp which has typed messages per command, Thunderbird uses a
 * generic call/result pattern because the 34 domain handlers return untyped
 * plain objects. The extension wraps each handler result in a ToolResult envelope.
 */

import type { ServerMessageBase, ExtensionMessageBase } from "@desktop-mcp/shared";

/** Server -> Extension: call a tool handler. */
export interface CallToolMessage extends ServerMessageBase {
  cmd: "call-tool";
  toolName: string;
  args: Record<string, unknown>;
}

export type ThunderbirdServerMessage = CallToolMessage;

/** Extension -> Server: tool handler result. */
export interface ToolResultMessage extends ExtensionMessageBase {
  resource: "tool-result";
  result: unknown;
}

export type ThunderbirdExtensionMessage = ToolResultMessage;
