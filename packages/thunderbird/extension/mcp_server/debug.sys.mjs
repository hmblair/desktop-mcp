// debug.sys.mjs — Shared debug-logging gate for thunderbird-mcp.
//
// Verbose debug output is off by default. Toggle it at runtime via the
// `extensions.thunderbird-mcp.debug` boolean pref in about:config (Config
// Editor) — no extension reload needed, since the pref is read per call.
//
// `Services` and `console` are globals in privileged system modules.

export const DEBUG_PREF = "extensions.thunderbird-mcp.debug";

export function mcpDebug(context, data) {
  if (!Services.prefs.getBoolPref(DEBUG_PREF, false)) return;
  console.log(`[thunderbird-mcp:debug] ${context}:`, JSON.stringify(data));
}
