#!/usr/bin/env node
const path = require("path");

async function main() {
  // Build shared first so smokeTest is available
  const { smokeTest } = require("@desktop-mcp/shared");
  await smokeTest({
    nativeHostPath: path.join(__dirname, "..", "server", "dist", "native-host.js"),
    httpPort: 8766,
    expectedServerName: "thunderbird-mcp",
    minTools: 30,
  });
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
