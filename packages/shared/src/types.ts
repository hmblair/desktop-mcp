/**
 * Base types for native messaging between MCP server and browser extension.
 */

/** Base for messages sent from server to extension. */
export interface ServerMessageBase {
  cmd: string;
}

/** Server message with correlation ID (the wire format). */
export type ServerMessageRequest<T extends ServerMessageBase = ServerMessageBase> =
  T & { correlationId: string };

/** Base for messages sent from extension back to server. */
export interface ExtensionMessageBase {
  resource: string;
  correlationId: string;
}

/** Error response from extension. */
export interface ExtensionError {
  correlationId: string;
  errorMessage: string;
}

/** Generic action result. */
export interface ActionResult {
  success: boolean;
  error?: string;
}
