/**
 * Tests for the MCP tool response helpers.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { toolResponse, toolError } from "../tool-response";

describe("toolResponse", () => {
  it("wraps data in a text content block with JSON body", () => {
    const resp = toolResponse({ foo: 1, bar: "baz" });
    assert.equal(resp.content.length, 1);
    assert.equal(resp.content[0].type, "text");
    assert.deepEqual(JSON.parse(resp.content[0].text), { foo: 1, bar: "baz" });
    assert.equal(resp.content[0].isError, undefined);
  });

  it("sets isError flag when requested", () => {
    const resp = toolResponse({ success: false }, true);
    assert.equal(resp.content[0].isError, true);
  });
});

describe("toolError", () => {
  it("formats Error instances with toolName prefix", () => {
    const resp = toolError("openLink", new Error("boom"));
    assert.equal(resp.content[0].isError, true);
    const body = JSON.parse(resp.content[0].text);
    assert.equal(body.success, false);
    assert.equal(body.error, "openLink: boom");
  });

  it("accepts a plain string message", () => {
    const resp = toolError("clickElement", "no such element");
    const body = JSON.parse(resp.content[0].text);
    assert.equal(body.success, false);
    assert.equal(body.error, "clickElement: no such element");
  });

  it("coerces unknown values to string", () => {
    const resp = toolError("foo", { weird: true });
    const body = JSON.parse(resp.content[0].text);
    assert.match(body.error, /^foo: /);
  });

  it("always marks content as error", () => {
    const resp = toolError("x", "y");
    assert.equal(resp.content[0].isError, true);
  });
});
