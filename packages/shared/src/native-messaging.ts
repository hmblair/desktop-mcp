/**
 * Native messaging frame protocol: 4-byte little-endian length prefix + UTF-8 JSON body.
 * Used by both Firefox and Thunderbird WebExtension native messaging.
 */

/**
 * Read native messaging frames from stdin.
 * Each frame: 4-byte LE length prefix + UTF-8 JSON body.
 */
export function startNativeMessageReader(onMessage: (msg: unknown) => void): void {
  let buffer = Buffer.alloc(0);

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 4) {
      const messageLength = buffer.readUInt32LE(0);
      if (buffer.length < 4 + messageLength) break;

      const json = buffer.subarray(4, 4 + messageLength).toString("utf-8");
      buffer = buffer.subarray(4 + messageLength);

      try {
        onMessage(JSON.parse(json));
      } catch (error) {
        console.error("[native] Failed to parse message:", error);
      }
    }
  });
}

/**
 * Write a native messaging frame to stdout.
 */
export function writeNativeMessage(msg: unknown): void {
  const json = JSON.stringify(msg);
  const body = Buffer.from(json, "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(header);
  process.stdout.write(body);
}
