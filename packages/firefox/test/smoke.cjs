#!/usr/bin/env node
const path = require("path");

async function main() {
  const { smokeTest } = require("@desktop-mcp/shared");
  await smokeTest({
    nativeHostPath: path.join(__dirname, "..", "server", "dist", "native-host.js"),
    httpPort: 8581,
    expectedServerName: "firefox-mcp",
    minTools: 15,
  });
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
