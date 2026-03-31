/**
 * Base class for server-side communication with a browser extension via native messaging.
 * Provides correlation-ID-based request/response pattern over stdin/stdout.
 *
 * Subclass and add domain-specific methods (e.g., openLink, searchMessages).
 */

import { startNativeMessageReader, writeNativeMessage } from "./native-messaging";
import type { ServerMessageBase, ExtensionMessageBase, ExtensionError } from "./types";

const DEFAULT_RESPONSE_TIMEOUT_MS = 60_000;

interface PendingRequest<TExtMsg extends ExtensionMessageBase> {
  resource: TExtMsg["resource"];
  resolve: (value: TExtMsg) => void;
  reject: (reason?: string) => void;
}

function isErrorMessage(message: unknown): message is ExtensionError {
  return (
    typeof message === "object" &&
    message !== null &&
    "errorMessage" in message &&
    "correlationId" in message
  );
}

export class BaseBrowserAPI<
  TServerMsg extends ServerMessageBase,
  TExtMsg extends ExtensionMessageBase
> {
  private extensionRequestMap: Map<string, PendingRequest<TExtMsg>> = new Map();
  private connected = false;
  private responseTimeoutMs: number;

  constructor(options?: { responseTimeoutMs?: number }) {
    this.responseTimeoutMs = options?.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;

    startNativeMessageReader((msg) => {
      if (isErrorMessage(msg)) {
        this.handleExtensionError(msg);
        return;
      }
      this.handleDecodedExtensionMessage(msg as TExtMsg);
    });

    process.stdin.on("end", () => {
      this.connected = false;
      console.error("[native] Extension disconnected (stdin closed)");
    });

    this.connected = true;
    console.error("[native] Native messaging initialized");
  }

  get isInitialized(): boolean {
    return this.connected;
  }

  close(): void {
    // stdin/stdout are managed by the OS
  }

  /**
   * Send a message to the extension, returning the correlationId.
   */
  protected sendToExtension(message: TServerMsg): string {
    if (!this.connected) {
      throw new Error(
        "Browser extension is not connected. Make sure the browser is running and the extension is installed."
      );
    }

    const correlationId = Math.random().toString(36).substring(2);
    const req = { ...message, correlationId };

    console.error(`[browser-api] Sending ${req.cmd} (id: ${correlationId})`);
    writeNativeMessage(req);

    return correlationId;
  }

  /**
   * Wait for a response with the given correlationId and resource type.
   */
  protected waitForResponse<R extends TExtMsg["resource"]>(
    correlationId: string,
    resource: R,
  ): Promise<Extract<TExtMsg, { resource: R }>> {
    return new Promise<Extract<TExtMsg, { resource: R }>>(
      (resolve, reject) => {
        this.extensionRequestMap.set(correlationId, {
          resolve: resolve as (value: TExtMsg) => void,
          resource,
          reject,
        });
        setTimeout(() => {
          if (this.extensionRequestMap.has(correlationId)) {
            this.extensionRequestMap.delete(correlationId);
            reject(`Timed out waiting for '${resource}' response (id: ${correlationId})`);
          }
        }, this.responseTimeoutMs);
      }
    );
  }

  private handleDecodedExtensionMessage(decoded: TExtMsg): void {
    const { correlationId } = decoded;
    const entry = this.extensionRequestMap.get(correlationId);
    if (!entry) {
      console.error(`[browser-api] Received response for unknown correlationId: ${correlationId} (resource: ${decoded.resource})`);
      return;
    }
    const { resolve, resource, reject } = entry;
    if (resource !== decoded.resource) {
      console.error(`[browser-api] Resource mismatch for id ${correlationId}: expected '${resource}', got '${decoded.resource}'`);
      this.extensionRequestMap.delete(correlationId);
      reject(`Resource mismatch: expected '${resource}', got '${decoded.resource}'`);
      return;
    }
    console.error(`[browser-api] Received ${decoded.resource} (id: ${correlationId})`);
    this.extensionRequestMap.delete(correlationId);
    resolve(decoded);
  }

  private handleExtensionError(decoded: ExtensionError): void {
    const { correlationId, errorMessage } = decoded;
    const entry = this.extensionRequestMap.get(correlationId);
    if (!entry) {
      console.error(`[browser-api] Received error for unknown correlationId: ${correlationId}: ${errorMessage}`);
      return;
    }
    console.error(`[browser-api] Extension error (id: ${correlationId}): ${errorMessage}`);
    this.extensionRequestMap.delete(correlationId);
    entry.reject(errorMessage);
  }
}
