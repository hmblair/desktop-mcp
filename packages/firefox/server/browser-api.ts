import { BaseBrowserAPI } from "@desktop-mcp/shared";
import type {
  ActionResult,
  ExtensionMessage,
  BrowserTab,
  ServerMessage,
  TabContentExtensionMessage,
} from "../common";

export class FirefoxAPI extends BaseBrowserAPI<ServerMessage, ExtensionMessage> {
  async openLink(
    url: string,
    tabId?: number,
    newTab?: boolean
  ): Promise<number | undefined> {
    const correlationId = this.sendToExtension({ cmd: "open-link", url, tabId, newTab });
    const message = await this.waitForResponse(correlationId, "opened-tab-id");
    return message.tabId;
  }

  async closeTabs(tabIds: number[]): Promise<{ closedTabIds: number[]; failedTabIds: number[] }> {
    const correlationId = this.sendToExtension({ cmd: "close-tabs", tabIds });
    const message = await this.waitForResponse(correlationId, "tabs-closed");
    return { closedTabIds: message.closedTabIds, failedTabIds: message.failedTabIds };
  }

  async getTabList(): Promise<BrowserTab[]> {
    const correlationId = this.sendToExtension({ cmd: "get-tab-list" });
    const message = await this.waitForResponse(correlationId, "tabs");
    return message.tabs;
  }

  async getTabContent(
    tabId: number,
    offset: number,
    selector?: string,
    includeLinks?: boolean,
    maxLength?: number
  ): Promise<TabContentExtensionMessage> {
    const correlationId = this.sendToExtension({
      cmd: "get-tab-content", tabId, offset, selector, includeLinks, maxLength,
    });
    return await this.waitForResponse(correlationId, "tab-content");
  }

  async getInteractiveElements(tabId: number, filter?: string, limit?: number) {
    const correlationId = this.sendToExtension({
      cmd: "get-interactive-elements", tabId, filter, limit,
    });
    const message = await this.waitForResponse(correlationId, "interactive-elements");
    return message.elements;
  }

  async clickElement(
    tabId: number,
    selector: string
  ): Promise<ActionResult & { navigated?: boolean; url?: string; title?: string; openedTabId?: number; openedTabUrl?: string }> {
    const correlationId = this.sendToExtension({ cmd: "click-element", tabId, selector });
    const message = await this.waitForResponse(correlationId, "element-clicked");
    return { success: message.success, navigated: message.navigated, url: message.url, title: message.title, openedTabId: message.openedTabId, openedTabUrl: message.openedTabUrl, error: message.error };
  }

  async typeIntoField(
    tabId: number,
    selector: string,
    text: string,
    clearFirst: boolean,
    submit: boolean
  ): Promise<ActionResult> {
    const correlationId = this.sendToExtension({
      cmd: "type-into-field", tabId, selector, text, clearFirst, submit,
    });
    const message = await this.waitForResponse(correlationId, "text-typed");
    return { success: message.success, error: message.error };
  }

  async reloadTab(tabId: number, bypassCache: boolean): Promise<void> {
    const correlationId = this.sendToExtension({ cmd: "reload-tab", tabId, bypassCache });
    await this.waitForResponse(correlationId, "tab-reloaded");
  }

  async selectOption(
    tabId: number,
    selector: string,
    value: string,
    values?: string[]
  ): Promise<ActionResult> {
    const correlationId = this.sendToExtension({
      cmd: "select-option", tabId, selector, value, values,
    });
    const message = await this.waitForResponse(correlationId, "option-selected");
    return { success: message.success, error: message.error };
  }

  async getTabInfo(tabId: number): Promise<{ url: string; title: string; status: string }> {
    const correlationId = this.sendToExtension({ cmd: "get-tab-info", tabId });
    const message = await this.waitForResponse(correlationId, "tab-info");
    return { url: message.url, title: message.title, status: message.status };
  }

  async fillForm(
    tabId: number,
    fields: { selector: string; value?: string; checked?: boolean }[],
    submit?: string
  ): Promise<{ results: { selector: string; success: boolean; error?: string }[]; submitted: boolean }> {
    const correlationId = this.sendToExtension({ cmd: "fill-form", tabId, fields, submit });
    const message = await this.waitForResponse(correlationId, "form-filled");
    return { results: message.results, submitted: message.submitted };
  }

  async waitForSelector(
    tabId: number,
    selector: string,
    timeoutMs?: number
  ): Promise<{ found: boolean }> {
    const correlationId = this.sendToExtension({
      cmd: "wait-for-selector", tabId, selector, timeoutMs,
    });
    const message = await this.waitForResponse(correlationId, "selector-found");
    return { found: message.found };
  }

  async takeScreenshot(tabId: number, maxWidth?: number, quality?: number): Promise<string> {
    const correlationId = this.sendToExtension({
      cmd: "take-screenshot", tabId, ...(maxWidth && { maxWidth }), ...(quality && { quality }),
    });
    const message = await this.waitForResponse(correlationId, "screenshot");
    return message.dataUrl;
  }

  async clickAndType(
    tabId: number,
    selector: string,
    text: string,
    clearFirst: boolean,
    submit: boolean
  ): Promise<ActionResult> {
    const correlationId = this.sendToExtension({
      cmd: "click-and-type", tabId, selector, text, clearFirst, submit,
    });
    const message = await this.waitForResponse(correlationId, "click-and-typed");
    return { success: message.success, error: message.error };
  }

  async executeScript(tabId: number, code: string): Promise<unknown> {
    const correlationId = this.sendToExtension({ cmd: "execute-script", tabId, code });
    const message = await this.waitForResponse(correlationId, "script-result");
    return message.result;
  }

  async sendKeypress(
    tabId: number,
    key: string,
    modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
  ): Promise<ActionResult> {
    const correlationId = this.sendToExtension({ cmd: "send-keypress", tabId, key, modifiers });
    const message = await this.waitForResponse(correlationId, "keypress-sent");
    return { success: message.success };
  }

  async searchTabContent(tabId: number, query: string, contextChars?: number) {
    const correlationId = this.sendToExtension({
      cmd: "search-tab-content", tabId, query, contextChars,
    });
    const message = await this.waitForResponse(correlationId, "search-tab-content-result");
    return message.matches;
  }
}
