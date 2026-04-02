#!/usr/bin/env node

const path = require("path");
const {
  runInstaller,
  uninstallClaudeCode,
  uninstallClaudeDesktop,
  uninstallOpenCode,
} = require("@desktop-mcp/shared");

runInstaller({
  serverName: "thunderbird-mcp",
  nativeAppName: "thunderbird_mcp",
  nativeHostDescription: "Thunderbird MCP native messaging host",
  nativeHostJsPath: path.resolve(__dirname, "..", "server", "dist", "native-host.js"),
  allowedExtensions: ["thunderbird-mcp@luthriel.dev"],
  httpPort: 8766,
  beforeInstall() {
    for (const name of ["thunderbird-mail", "thunderbird-calendar", "thunderbird-feeds"]) {
      uninstallClaudeCode(name);
      uninstallClaudeDesktop(name);
      uninstallOpenCode(name);
    }
  },
});
