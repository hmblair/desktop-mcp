import { createNativeHost } from "@desktop-mcp/shared";
import { createServer } from "./create-server";

createNativeHost({
  logName: "thunderbird-mcp",
  createServer,
});
