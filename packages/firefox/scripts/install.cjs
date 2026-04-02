#!/usr/bin/env node

const path = require("path");
const { runInstaller } = require("@desktop-mcp/shared");

runInstaller({
  serverName: "firefox-mcp",
  nativeAppName: "firefox_mcp",
  nativeHostDescription: "Firefox MCP native messaging host",
  nativeHostJsPath: path.resolve(__dirname, "..", "server", "dist", "native-host.js"),
  allowedExtensions: ["firefox-mcp@hmblair.dev"],
  httpPort: 8581,
});
