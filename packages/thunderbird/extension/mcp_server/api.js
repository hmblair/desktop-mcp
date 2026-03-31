/* global ExtensionCommon, ChromeUtils, Services, Cc, Ci */
"use strict";

/**
 * Thunderbird MCP Server Extension — Experiment API
 *
 * Runs in the privileged parent process scope. Exposes two methods:
 *   - init(): Load domain modules and build handler map
 *   - callTool(name, args): Dispatch a tool call to the appropriate handler
 *
 * Native messaging is handled by background.js (WebExtension context),
 * which calls these methods via the experiment API bridge.
 */

const resProto = Cc[
  "@mozilla.org/network/protocol;1?name=resource"
].getService(Ci.nsISubstitutingProtocolHandler);

var mcpServer = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    const extensionRoot = context.extension.rootURI;
    const resourceName = "thunderbird-mcp";

    resProto.setSubstitutionWithFlags(
      resourceName,
      extensionRoot,
      resProto.ALLOW_CONTENT_ACCESS
    );

    return {
      mcpServer: {
        init: async function() {
          if (globalThis.__tbMcpHandlers) {
            return { success: true, version: globalThis.__tbMcpVersion || "0.0.0" };
          }

          try {
            const { NetUtil } = ChromeUtils.importESModule(
              "resource://gre/modules/NetUtil.sys.mjs"
            );
            const { MailServices } = ChromeUtils.importESModule(
              "resource:///modules/MailServices.sys.mjs"
            );

            // Read version from manifest
            const manifestUri = Services.io.newURI("resource://thunderbird-mcp/manifest.json");
            const manifestChannel = NetUtil.newChannel({ uri: manifestUri, loadUsingSystemPrincipal: true });
            const manifestStream = manifestChannel.open();
            const manifestJson = NetUtil.readInputStreamToString(manifestStream, manifestStream.available(), { charset: "UTF-8" });
            manifestStream.close();
            const SERVER_VERSION = JSON.parse(manifestJson).version;

            // Load feed modules
            let FeedUtils = null;
            try {
              ({ FeedUtils } = ChromeUtils.importESModule(
                "resource:///modules/FeedUtils.sys.mjs"
              ));
            } catch (e) {
              console.warn("[thunderbird-mcp] feed module not available:", e?.message || e);
            }

            // Load calendar modules
            let cal = null;
            let CalEvent = null;
            let CalTodo = null;
            try {
              const calModule = ChromeUtils.importESModule(
                "resource:///modules/calendar/calUtils.sys.mjs"
              );
              cal = calModule.cal;
              const { CalEvent: CE } = ChromeUtils.importESModule(
                "resource:///modules/CalEvent.sys.mjs"
              );
              CalEvent = CE;
              const { CalTodo: CT } = ChromeUtils.importESModule(
                "resource:///modules/CalTodo.sys.mjs"
              );
              CalTodo = CT;
            } catch (e) {
              console.warn("[thunderbird-mcp] calendar module not available:", e?.message || e);
            }

            // Load domain modules
            const cacheBust = "?" + Date.now();
            const { createUtils } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/utils.sys.mjs" + cacheBust
            );
            const { createMailHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/mail.sys.mjs" + cacheBust
            );
            const { createComposeHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/compose.sys.mjs" + cacheBust
            );
            const { createFolderHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/folders.sys.mjs" + cacheBust
            );
            const { createCalendarHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/calendar.sys.mjs" + cacheBust
            );
            const { createTaskHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/tasks.sys.mjs" + cacheBust
            );
            const { createContactHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/contacts.sys.mjs" + cacheBust
            );
            const { createFeedHandlers } = ChromeUtils.importESModule(
              "resource://thunderbird-mcp/mcp_server/feeds.sys.mjs" + cacheBust
            );

            const utils = createUtils({ MailServices, Services, Cc, Ci, cal });

            const handlers = {
              ...createMailHandlers({ MailServices, Services, Cc, Ci, NetUtil, ChromeUtils, utils }),
              ...createComposeHandlers({ MailServices, Services, Cc, Ci, ChromeUtils, utils }),
              ...createFolderHandlers({ MailServices, utils }),
              ...createCalendarHandlers({ Services, cal, CalEvent, ChromeUtils, utils }),
              ...createTaskHandlers({ Services, cal, CalTodo, utils }),
              ...createContactHandlers({ MailServices }),
              ...createFeedHandlers({ MailServices, Services, Ci, ChromeUtils, utils, FeedUtils }),
            };

            globalThis.__tbMcpHandlers = handlers;
            globalThis.__tbMcpVersion = SERVER_VERSION;
            console.log("[thunderbird-mcp]", `Initialized ${Object.keys(handlers).length} handlers, v${SERVER_VERSION}`);
            return { success: true, version: SERVER_VERSION };
          } catch (e) {
            console.log("[thunderbird-mcp]", `FATAL: ${e}\n${e.stack || ""}`);
            return { success: false, error: e.toString() };
          }
        },

        callTool: async function(name, args) {
          const handlers = globalThis.__tbMcpHandlers;
          if (!handlers) {
            throw new Error("MCP handlers not initialized — call init() first");
          }
          const handler = handlers[name];
          if (!handler) {
            throw new Error(`Unknown tool: ${name}`);
          }
          return await handler(args);
        },
      }
    };
  }

  onShutdown(isAppShutdown) {
    globalThis.__tbMcpHandlers = null;
    globalThis.__tbMcpVersion = null;
    if (isAppShutdown) return;
    resProto.setSubstitution("thunderbird-mcp", null);
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }
};
