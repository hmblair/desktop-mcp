#!/usr/bin/env node

const path = require("path");
const {
  ask,
  closePrompt,
  installNativeHost,
  uninstallNativeHost,
  installClaudeCode,
  uninstallClaudeCode,
  installOpenCode,
  uninstallOpenCode,
} = require("@desktop-mcp/shared");

const SERVER_NAME = "firefox-mcp";
const HTTP_PORT = 8581;
const MCP_URL = `http://localhost:${HTTP_PORT}/mcp`;

async function install() {
  console.log();

  installNativeHost({
    name: "firefox_mcp",
    description: "Firefox MCP native messaging host",
    nativeHostJsPath: path.resolve(__dirname, "..", "server", "dist", "native-host.js"),
    allowedExtensions: ["firefox-mcp@hmblair.dev"],
  });

  console.log();
  if (await ask("Install into Claude Code? [Y/n] ")) {
    installClaudeCode(SERVER_NAME, MCP_URL);
  } else {
    console.log("  Skipped.");
  }
  console.log();
  if (await ask("Install into OpenCode (~/.config/opencode/opencode.json)? [Y/n] ")) {
    installOpenCode(SERVER_NAME, MCP_URL);
  } else {
    console.log("  Skipped.");
  }
  console.log();
  closePrompt();
}

function uninstall() {
  console.log();
  uninstallNativeHost("firefox_mcp");
  uninstallClaudeCode(SERVER_NAME);
  uninstallOpenCode(SERVER_NAME);
  console.log();
}

const command = process.argv[2];
if (command === "uninstall") {
  uninstall();
} else {
  install();
}
