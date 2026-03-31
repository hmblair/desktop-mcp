/* global browser */

const NATIVE_APP_NAME = "thunderbird_mcp";

async function init() {
  try {
    // Initialize domain handlers in the privileged parent scope
    const result = await browser.mcpServer.init();
    if (!result.success) {
      console.error("Failed to initialize MCP handlers:", result.error);
      return;
    }
    console.log("MCP handlers initialized, version", result.version);

    // Connect to native messaging host from the WebExtension context
    const port = browser.runtime.connectNative(NATIVE_APP_NAME);
    console.log("Connected to native host:", NATIVE_APP_NAME);

    port.onMessage.addListener(async (message) => {
      const { cmd, correlationId, toolName, args } = message;

      if (cmd !== "call-tool" || !toolName || !correlationId) {
        console.warn("Unknown message from native host:", JSON.stringify(message));
        return;
      }

      try {
        const result = await browser.mcpServer.callTool(toolName, args || {});
        port.postMessage({
          resource: "tool-result",
          correlationId,
          result,
        });
      } catch (e) {
        console.error(`Tool ${toolName} failed:`, e);
        port.postMessage({
          correlationId,
          errorMessage: e.toString(),
        });
      }
    });

    port.onDisconnect.addListener(() => {
      const error = browser.runtime.lastError;
      if (error) {
        console.error("Native host disconnected with error:", error.message || error);
      } else {
        console.log("Native host disconnected");
      }
    });
  } catch (e) {
    console.error("Error starting MCP server:", e);
  }
}

browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);
