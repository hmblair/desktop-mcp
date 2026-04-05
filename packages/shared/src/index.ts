export { BaseBrowserAPI } from "./browser-api";
export { startNativeMessageReader, writeNativeMessage, encodeFrame, parseFrames } from "./native-messaging";
export type { ParsedFrames } from "./native-messaging";
export { createServer, McpServer, ResourceTemplate } from "./server";
export type { CreateServerOptions, ManagedServer } from "./server";
export type {
  ServerMessageBase,
  ServerMessageRequest,
  ExtensionMessageBase,
  ExtensionError,
  ActionResult,
} from "./types";
export { toolResponse, toolError } from "./tool-response";
export { createNativeHost } from "./native-host";
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
  installClaudeDesktop,
  uninstallClaudeDesktop,
  installOpenCode,
  uninstallOpenCode,
  runInstaller,
} from "./install";
