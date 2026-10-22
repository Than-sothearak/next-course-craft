import { resolve } from "node:path";
import { runNode, withTestApplication } from "./testing/application.mjs";

const args = process.argv.slice(2);
try {
  process.exitCode = await withTestApplication(({ origin, env, authors }) => runNode([
    resolve("node_modules/@playwright/test/cli.js"), "test", ...args.filter((arg) => arg !== "--skip-build"),
  ], { ...env, TEST_APP_ORIGIN: origin, TEST_APP_FIXTURES: JSON.stringify({ authors }) }), { build: !args.includes("--skip-build"), exposeTestingApi: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
