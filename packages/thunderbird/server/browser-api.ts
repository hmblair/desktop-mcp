import { BaseBrowserAPI } from "@desktop-mcp/shared";
import type {
  ThunderbirdServerMessage,
  ThunderbirdExtensionMessage,
} from "../common";

export class ThunderbirdAPI extends BaseBrowserAPI<
  ThunderbirdServerMessage,
  ThunderbirdExtensionMessage
> {
  /**
   * Call a tool handler in the Thunderbird extension and return its result.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const correlationId = this.sendToExtension({
      cmd: "call-tool",
      toolName,
      args,
    });
    const message = await this.waitForResponse(correlationId, "tool-result");
    return message.result;
  }
}
