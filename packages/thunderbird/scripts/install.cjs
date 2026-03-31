#!/usr/bin/env node

const path = require("path");
const {
  ask,
  closePrompt,
  installNativeHost,
  uninstallNativeHost,
  installClaudeCode,
  uninstallClaudeCode,
  installClaudeDesktop,
  uninstallClaudeDesktop,
  installOpenCode,
  uninstallOpenCode,
} = require("@desktop-mcp/shared");

const SERVER_NAME = "thunderbird-mcp";
const HTTP_PORT = 8766;
const MCP_URL = `http://localhost:${HTTP_PORT}/mcp`;

// Silently remove old tool-group servers from a previous installation
function cleanupOldServers() {
  for (const name of ["thunderbird-mail", "thunderbird-calendar", "thunderbird-feeds"]) {
    uninstallClaudeCode(name);
    uninstallClaudeDesktop(name);
    uninstallOpenCode(name);
  }
}

async function install() {
  console.log();

  installNativeHost({
    name: "thunderbird_mcp",
    description: "Thunderbird MCP native messaging host",
    nativeHostJsPath: path.resolve(__dirname, "..", "server", "dist", "native-host.js"),
    allowedExtensions: ["thunderbird-mcp@luthriel.dev"],
  });

  cleanupOldServers();

  console.log();
  if (await ask("Install into Claude Code? [Y/n] ")) {
    installClaudeCode(SERVER_NAME, MCP_URL);
  } else {
    console.log("  Skipped.");
  }
  console.log();
  if (await ask("Install into Claude Desktop? [Y/n] ")) {
    installClaudeDesktop(SERVER_NAME, MCP_URL);
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
  uninstallNativeHost("thunderbird_mcp");
  uninstallClaudeCode(SERVER_NAME);
  uninstallClaudeDesktop(SERVER_NAME);
  uninstallOpenCode(SERVER_NAME);
  console.log();
}

const command = process.argv[2];
if (command === "uninstall") {
  uninstall();
} else {
  install();
}
