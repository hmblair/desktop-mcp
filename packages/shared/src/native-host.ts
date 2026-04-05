/**
 * Shared native host entrypoint factory.
 * Handles logging, uncaught exceptions, and startup.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function createNativeHost(opts: {
  logName: string;
  createServer: () => { start: () => Promise<void> };
}): void {
  const logFile = path.join(os.tmpdir(), `${opts.logName}.log`);

  function log(msg: string) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
  }

  process.on("uncaughtException", (err: Error) => {
    log(`UNCAUGHT: ${err.stack || err.message}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
    log(`UNHANDLED REJECTION: ${msg}`);
    process.exit(1);
  });

  const { start } = opts.createServer();

  start().catch((err) => {
    log(`start failed: ${err.stack || err.message}`);
    process.exit(1);
  });
}
