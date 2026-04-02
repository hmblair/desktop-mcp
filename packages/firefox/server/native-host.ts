import { createNativeHost } from "@desktop-mcp/shared";
import { createServer } from "./create-server";

createNativeHost({
  logName: "firefox-mcp",
  createServer,
});
