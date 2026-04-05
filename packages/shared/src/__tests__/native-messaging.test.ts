/**
 * Tests for the native messaging frame protocol.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { encodeFrame, parseFrames } from "../native-messaging";

describe("encodeFrame", () => {
  it("prefixes JSON body with 4-byte little-endian length", () => {
    const frame = encodeFrame({ cmd: "ping" });
    const body = JSON.stringify({ cmd: "ping" });
    assert.equal(frame.readUInt32LE(0), Buffer.byteLength(body, "utf-8"));
    assert.equal(frame.subarray(4).toString("utf-8"), body);
  });

  it("handles unicode body bytes, not characters", () => {
    const msg = { text: "héllo 世界" };
    const frame = encodeFrame(msg);
    const expectedBytes = Buffer.byteLength(JSON.stringify(msg), "utf-8");
    assert.equal(frame.readUInt32LE(0), expectedBytes);
    assert.equal(frame.length, 4 + expectedBytes);
  });

  it("handles empty object", () => {
    const frame = encodeFrame({});
    assert.equal(frame.readUInt32LE(0), 2);
    assert.equal(frame.subarray(4).toString("utf-8"), "{}");
  });
});

describe("parseFrames", () => {
  it("parses a single complete frame", () => {
    const frame = encodeFrame({ resource: "tabs", correlationId: "a" });
    const { messages, remaining, parseErrors } = parseFrames(frame);
    assert.deepEqual(messages, [{ resource: "tabs", correlationId: "a" }]);
    assert.equal(remaining.length, 0);
    assert.equal(parseErrors.length, 0);
  });

  it("parses multiple concatenated frames", () => {
    const combined = Buffer.concat([
      encodeFrame({ id: 1 }),
      encodeFrame({ id: 2 }),
      encodeFrame({ id: 3 }),
    ]);
    const { messages, remaining } = parseFrames(combined);
    assert.deepEqual(messages, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.equal(remaining.length, 0);
  });

  it("returns incomplete trailing bytes as remaining", () => {
    const full = encodeFrame({ id: 1 });
    const partial = encodeFrame({ id: 2 }).subarray(0, 6); // truncated frame
    const buf = Buffer.concat([full, partial]);
    const { messages, remaining } = parseFrames(buf);
    assert.deepEqual(messages, [{ id: 1 }]);
    assert.deepEqual(remaining, partial);
  });

  it("returns the full buffer when header is incomplete (< 4 bytes)", () => {
    const buf = Buffer.from([0x02, 0x00, 0x00]);
    const { messages, remaining } = parseFrames(buf);
    assert.equal(messages.length, 0);
    assert.deepEqual(remaining, buf);
  });

  it("returns empty result for empty buffer", () => {
    const { messages, remaining, parseErrors } = parseFrames(Buffer.alloc(0));
    assert.equal(messages.length, 0);
    assert.equal(remaining.length, 0);
    assert.equal(parseErrors.length, 0);
  });

  it("records parse errors but continues past a malformed frame", () => {
    const header = Buffer.alloc(4);
    const bogus = Buffer.from("not json", "utf-8");
    header.writeUInt32LE(bogus.length, 0);
    const bad = Buffer.concat([header, bogus]);
    const good = encodeFrame({ ok: true });
    const { messages, parseErrors, remaining } = parseFrames(Buffer.concat([bad, good]));
    assert.equal(parseErrors.length, 1);
    assert.deepEqual(messages, [{ ok: true }]);
    assert.equal(remaining.length, 0);
  });

  it("roundtrips unicode payloads", () => {
    const payload = { text: "héllo 世界 🌍", n: 42 };
    const { messages } = parseFrames(encodeFrame(payload));
    assert.deepEqual(messages, [payload]);
  });
});
