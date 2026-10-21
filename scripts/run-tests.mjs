import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { withTestMongoDB } from "./testing/mongodb.mjs";

try {
  process.exitCode = await withTestMongoDB((uri) => new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", "--maxWorkers=2", ...process.argv.slice(2)], {
      env: { ...process.env, RBAC_TEST_MONGODB_URI: uri }, stdio: "inherit", windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
