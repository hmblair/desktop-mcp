/**
 * Native messaging frame protocol: 4-byte little-endian length prefix + UTF-8 JSON body.
 * Used by both Firefox and Thunderbird WebExtension native messaging.
 */

/**
 * Encode a value as a native messaging frame.
 * Each frame: 4-byte LE length prefix + UTF-8 JSON body.
 */
export function encodeFrame(msg: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(msg), "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export interface ParsedFrames {
  messages: unknown[];
  remaining: Buffer;
  parseErrors: Error[];
}

/**
 * Parse as many complete frames as possible from a buffer.
 * Returns successfully parsed messages, any bytes that form an incomplete
 * trailing frame, and JSON parse errors for individual frames.
 */
export function parseFrames(buffer: Buffer): ParsedFrames {
  const messages: unknown[] = [];
  const parseErrors: Error[] = [];
  let remaining: Buffer = buffer;

  while (remaining.length >= 4) {
    const messageLength = remaining.readUInt32LE(0);
    if (remaining.length < 4 + messageLength) break;

    const json = remaining.subarray(4, 4 + messageLength).toString("utf-8");
    remaining = remaining.subarray(4 + messageLength);

    try {
      messages.push(JSON.parse(json));
    } catch (error) {
      parseErrors.push(error as Error);
    }
  }

  return { messages, remaining, parseErrors };
}

/**
 * Read native messaging frames from stdin.
 * Each frame: 4-byte LE length prefix + UTF-8 JSON body.
 */
export function startNativeMessageReader(onMessage: (msg: unknown) => void): void {
  let buffer: Buffer = Buffer.alloc(0);

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { messages, remaining, parseErrors } = parseFrames(buffer);
    buffer = remaining;
    for (const err of parseErrors) {
      console.error("[native] Failed to parse message:", err);
    }
    for (const msg of messages) onMessage(msg);
  });
}

/**
 * Write a native messaging frame to stdout.
 */
export function writeNativeMessage(msg: unknown): void {
  const frame = encodeFrame(msg);
  process.stdout.write(frame);
}
