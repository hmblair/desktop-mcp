/**
 * Shared install helpers for MCP server configuration.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const home = process.env.HOME || process.env.USERPROFILE || "";

/** Platform-aware config paths. */
export const CONFIG_PATHS = {
  claudeCode: path.join(home, ".mcp.json"),
  claudeDesktop:
    process.platform === "win32"
      ? path.join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json")
      : process.platform === "darwin"
        ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
        : path.join(home, ".config", "Claude", "claude_desktop_config.json"),
  openCode: path.join(home, ".config", "opencode", "opencode.json"),
  nativeMessagingHosts:
    process.platform === "darwin"
      ? path.join(home, "Library", "Mozilla", "NativeMessagingHosts")
      : path.join(home, ".mozilla", "native-messaging-hosts"),
};

export function readJson(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

let rl: readline.Interface | null = null;

export function ask(question: string): Promise<boolean> {
  if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl!.question(question, (answer) => {
      resolve(answer.trim().toLowerCase() !== "n");
    });
  });
}

export function closePrompt(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/**
 * Install a native messaging host manifest.
 */
export function installNativeHost(opts: {
  name: string;
  description: string;
  nativeHostJsPath: string;
  allowedExtensions: string[];
}): void {
  const wrapperPath = opts.nativeHostJsPath.replace(/\.js$/, "-wrapper.sh");
  const wrapperContent = `#!/bin/sh\nexport PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"\nexec node "${opts.nativeHostJsPath}"\n`;
  fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

  const manifestDir = CONFIG_PATHS.nativeMessagingHosts;
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${opts.name}.json`);
  const manifest = {
    name: opts.name,
    description: opts.description,
    path: wrapperPath,
    type: "stdio",
    allowed_extensions: opts.allowedExtensions,
  };
  writeJson(manifestPath, manifest);
  console.log(`  Installed native messaging host manifest to ${manifestPath}`);
}

/**
 * Remove a native messaging host manifest.
 */
export function uninstallNativeHost(name: string): void {
  const manifestPath = path.join(CONFIG_PATHS.nativeMessagingHosts, `${name}.json`);
  try {
    fs.unlinkSync(manifestPath);
    console.log(`  Removed ${manifestPath}`);
  } catch {
    // file doesn't exist
  }
}

/**
 * Install into Claude Code via `claude mcp add` CLI.
 */
export function installClaudeCode(serverName: string, mcpUrl: string): void {
  const { execFileSync } = require("child_process");
  try {
    execFileSync("claude", ["mcp", "remove", "--scope", "user", serverName], { stdio: "ignore" });
  } catch {
    // May not exist
  }
  try {
    execFileSync("claude", ["mcp", "add", "--transport", "http", "--scope", "user", serverName, mcpUrl], { stdio: "inherit" });
  } catch {
    console.log(`  Failed to add ${serverName} via claude CLI — add manually with:`);
    console.log(`    claude mcp add --transport http --scope user ${serverName} ${mcpUrl}`);
  }
}

/**
 * Remove from Claude Code.
 */
export function uninstallClaudeCode(serverName: string): void {
  const { execFileSync } = require("child_process");
  try {
    execFileSync("claude", ["mcp", "remove", "--scope", "user", serverName], { stdio: "ignore" });
  } catch {
    // May not be installed
  }
}

/**
 * Install into Claude Desktop config.
 */
export function installClaudeDesktop(serverName: string, mcpUrl: string): void {
  const configPath = CONFIG_PATHS.claudeDesktop;
  if (!fs.existsSync(path.dirname(configPath))) return;
  const config = readJson(configPath) || {};
  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers[serverName] = { url: mcpUrl };
  writeJson(configPath, config);
  console.log(`  Added ${serverName} to ${configPath}`);
}

/**
 * Remove from Claude Desktop config.
 */
export function uninstallClaudeDesktop(serverName: string): void {
  const config = readJson(CONFIG_PATHS.claudeDesktop);
  if (!config?.mcpServers?.[serverName]) return;
  delete config.mcpServers[serverName];
  writeJson(CONFIG_PATHS.claudeDesktop, config);
  console.log(`  Removed ${serverName} from ${CONFIG_PATHS.claudeDesktop}`);
}

/**
 * Install into OpenCode config.
 */
export function installOpenCode(serverName: string, mcpUrl: string): void {
  const config = readJson(CONFIG_PATHS.openCode) || { $schema: "https://opencode.ai/config.json" };
  if (!config.mcp) config.mcp = {};
  config.mcp[serverName] = { type: "remote", url: mcpUrl };
  writeJson(CONFIG_PATHS.openCode, config);
  console.log(`  Added ${serverName} to ${CONFIG_PATHS.openCode}`);
}

/**
 * Remove from OpenCode config.
 */
export function uninstallOpenCode(serverName: string): void {
  const config = readJson(CONFIG_PATHS.openCode);
  if (!config?.mcp?.[serverName]) return;
  delete config.mcp[serverName];
  writeJson(CONFIG_PATHS.openCode, config);
  console.log(`  Removed ${serverName} from ${CONFIG_PATHS.openCode}`);
}
