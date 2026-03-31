export { BaseBrowserAPI } from "./browser-api";
export { startNativeMessageReader, writeNativeMessage } from "./native-messaging";
export { createServer, McpServer, ResourceTemplate } from "./server";
export type { CreateServerOptions, ManagedServer } from "./server";
export type {
  ServerMessageBase,
  ServerMessageRequest,
  ExtensionMessageBase,
  ExtensionError,
  ActionResult,
} from "./types";
export { smokeTest } from "./test-helpers";
export {
  CONFIG_PATHS,
  readJson,
  writeJson,
  ask,
  closePrompt,
  installNativeHost,
  uninstallNativeHost,
  installClaudeCode,
  uninstallClaudeCode,
  installOpenCode,
  uninstallOpenCode,
} from "./install";
