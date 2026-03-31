/**
 * Shared MCP server factory.
 * Creates an McpServer with Streamable HTTP transport, plugin loading, and signal handling.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BaseBrowserAPI } from "./browser-api";
import type { ServerMessageBase, ExtensionMessageBase } from "./types";

export interface CreateServerOptions<TApi extends BaseBrowserAPI<ServerMessageBase, ExtensionMessageBase>> {
  /** Server name reported in MCP initialize response. */
  name: string;
  /** Server version. Defaults to MCP_VERSION env var or "0.0.0". */
  version?: string;
  /** Port for the Streamable HTTP server. */
  httpPort: number;
  /** Factory to create the browser API instance (shared across requests). */
  createApi: () => TApi;
  /** Register all tools on the McpServer. Called once per HTTP request (stateless). */
  registerTools: (server: McpServer, api: TApi) => void;
  /** Register resources on the McpServer. Optional. */
  registerResources?: (server: McpServer, api: TApi) => void;
  /** Config file name for plugin discovery (e.g., "firefox-mcp"). Omit to disable plugins. */
  pluginConfigName?: string;
}

export interface ManagedServer<TApi> {
  /** The McpServer instance (for additional configuration before start). */
  mcpServer: McpServer;
  /** The browser API instance. */
  browserApi: TApi;
  /** Start the Streamable HTTP server. */
  start: () => Promise<void>;
}

interface PluginConfig {
  plugins?: Record<string, string>;
}

function loadPluginConfig(configName: string): PluginConfig {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  const configPaths = [
    path.join(os.homedir(), ".config", configName, "config.json"),
    path.join(os.homedir(), `.${configName}.json`),
  ];

  for (const configPath of configPaths) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      // file doesn't exist or isn't valid JSON, try next
    }
  }

  return {};
}

function namespacedServer(mcpServer: McpServer, prefix: string): McpServer {
  const wrapped = Object.create(mcpServer);
  wrapped.tool = (name: string, ...args: unknown[]) => {
    return mcpServer.tool(`${prefix}__${name}`, ...(args as [any]));
  };
  return wrapped;
}

function loadPlugins(mcpServer: McpServer, browserApi: unknown, configName: string): void {
  const config = loadPluginConfig(configName);
  if (!config.plugins || Object.keys(config.plugins).length === 0) return;

  for (const [name, pluginPath] of Object.entries(config.plugins)) {
    try {
      const resolved = require.resolve(pluginPath);
      const plugin = require(resolved);
      const registerFn = plugin.register ?? plugin.default?.register;
      if (typeof registerFn === "function") {
        registerFn(namespacedServer(mcpServer, name), browserApi);
        console.error(`[plugin] Loaded: ${name} (${pluginPath})`);
      } else {
        console.error(`[plugin] ${name}: no register function exported`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[plugin] Failed to load ${name}: ${message}`);
    }
  }
}

/**
 * Create an MCP server with Streamable HTTP transport.
 */
export function createServer<TApi extends BaseBrowserAPI<ServerMessageBase, ExtensionMessageBase>>(
  options: CreateServerOptions<TApi>
): ManagedServer<TApi> {
  const serverVersion = options.version ?? process.env.MCP_VERSION ?? "0.0.0";
  const browserApi = options.createApi();

  function createMcpServer(): McpServer {
    const server = new McpServer({ name: options.name, version: serverVersion });
    options.registerTools(server, browserApi);
    if (options.registerResources) {
      options.registerResources(server, browserApi);
    }
    if (options.pluginConfigName) {
      loadPlugins(server, browserApi, options.pluginConfigName);
    }
    return server;
  }

  const mcpServer = createMcpServer();

  const start = async () => {
    const http = await import("http");
    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );

    const httpServer = http.createServer(async (req, res) => {
      if (req.url !== "/mcp") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found. Use /mcp endpoint." }));
        return;
      }

      let body: unknown;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        body = JSON.parse(Buffer.concat(chunks).toString());
      }

      // Stateless: fresh MCP server + transport per request, sharing the BrowserAPI
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      res.on("close", () => {
        transport.close();
        server.close();
      });
    });

    const port = parseInt(process.env.MCP_PORT || "", 10) || options.httpPort;
    httpServer.listen(port, "127.0.0.1", () => {
      console.error(`MCP Server running on http://127.0.0.1:${port}/mcp`);
    });

    function shutdown(reason: string) {
      console.error(`MCP Server closed (${reason})`);
      browserApi.close();
      httpServer.close();
      process.exit(0);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));
  };

  return { mcpServer, browserApi, start };
}

// Re-export McpServer and ResourceTemplate for convenience
export { McpServer, ResourceTemplate };
