/**
 * Shared smoke test helper for MCP servers using Streamable HTTP transport.
 * Spawns the native host, waits for the HTTP server, sends initialize + tools/list.
 */

import { spawn, ChildProcess } from "child_process";
import * as http from "http";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function postJson(port: number, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          try {
            // Streamable HTTP may return SSE (text/event-stream) or plain JSON
            if (res.headers["content-type"]?.includes("text/event-stream")) {
              // Parse SSE: find "data: {...}" lines
              const dataLine = body.split("\n").find((l) => l.startsWith("data: "));
              if (dataLine) {
                resolve(JSON.parse(dataLine.slice(6)));
              } else {
                reject(new Error(`No data line in SSE response: ${body.slice(0, 200)}`));
              }
            } else {
              resolve(JSON.parse(body));
            }
          } catch (e) {
            reject(new Error(`Invalid response: ${body.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function waitForServer(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not start within ${timeoutMs}ms`));
        return;
      }
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/mcp", method: "POST" },
        () => resolve()
      );
      req.on("error", () => setTimeout(attempt, 100));
      req.write("{}");
      req.end();
    }
    attempt();
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = require("net").createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function smokeTest(opts: {
  nativeHostPath: string;
  httpPort: number;
  expectedServerName: string;
  minTools: number;
}): Promise<void> {
  const { nativeHostPath, expectedServerName, minTools } = opts;

  // Pick a free port to avoid conflicts with running servers
  const httpPort = await getFreePort();

  // Spawn the native host with MCP_PORT override
  const child: ChildProcess = spawn("node", [nativeHostPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, MCP_PORT: String(httpPort) },
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  // Close stdin to simulate no extension connected
  child.stdin?.end();

  try {
    await waitForServer(httpPort);

    // Send initialize
    const initResp = (await postJson(httpPort, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "1.0" },
      },
    })) as any;

    assert(initResp.result, `No result in initialize response: ${JSON.stringify(initResp).slice(0, 200)}`);
    assert(
      initResp.result.serverInfo?.name === expectedServerName,
      `Bad server name: ${initResp.result.serverInfo?.name}`
    );

    // Send tools/list
    const toolsResp = (await postJson(httpPort, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })) as any;

    assert(toolsResp.result, `No result in tools/list response`);
    const tools = toolsResp.result.tools;
    assert(Array.isArray(tools), `tools is not an array`);
    assert(
      tools.length >= minTools,
      `Expected at least ${minTools} tools, got ${tools.length}`
    );

    // Verify every tool has name + inputSchema
    for (const tool of tools) {
      assert(tool.name, `Tool missing name`);
      assert(tool.inputSchema, `Tool "${tool.name}" missing inputSchema`);
    }

    console.log(
      `OK: ${expectedServerName} — initialize + tools/list passed, ${tools.length} tools`
    );
  } finally {
    child.kill();
  }
}
