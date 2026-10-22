import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { MongoClient } from "mongodb";
import { withTestMongoDB } from "./mongodb.mjs";
import { seedAuthorFixtures } from "./fixtures.mjs";

export function runNode(args, env = process.env) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
}

export async function withTestApplication(work, { authors = 2, build = true, exposeTestingApi = false } = {}) {
  return withTestMongoDB(async (uri) => {
    const database = `coursecraft_verification_${randomUUID().replaceAll("-", "")}`;
    const databaseUrl = new URL(uri);
    databaseUrl.pathname = `/${database}`;
    const client = await new MongoClient(databaseUrl.toString()).connect();
    const db = client.db(database);
    let server;
    let closed;
    let serverLog = "";
    try {
      const fixtures = await seedAuthorFixtures(db, authors);
      const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
      const port = socket.address().port; await new Promise((done) => socket.close(done));
      const origin = `http://127.0.0.1:${port}`;
      const env = { ...process.env, NODE_ENV: "production", EXPOSE_TESTING_API: exposeTestingApi ? "1" : "0", MONGODB_URI: databaseUrl.toString(), AUTH_URL: origin, AUTH_SECRET: randomBytes(32).toString("hex"),
        AUTH_GOOGLE_ID: "synthetic-google-client", AUTH_GOOGLE_SECRET: "synthetic-google-secret", AUTH_GITHUB_ID: "synthetic-github-client", AUTH_GITHUB_SECRET: "synthetic-github-secret",
        OPENAI_API_KEY: "", AWS_ACCESS_KEY_ID: "", AWS_SECRET_ACCESS_KEY: "", AWS_SESSION_TOKEN: "", AWS_S3_BUCKET: "", NEXT_TELEMETRY_DISABLED: "1" };
      const next = resolve("node_modules/next/dist/bin/next");
      if (build && await runNode([next, "build", "--webpack"], env)) throw new Error("Production build failed before application verification.");
      server = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      closed = new Promise((done) => server.once("close", done));
      let startupError;
      server.once("error", (error) => { startupError = error; });
      for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { serverLog = (serverLog + chunk).slice(-12000); });
      const deadline = Date.now() + 30000;
      while (true) {
        if (startupError || server.exitCode !== null) throw new Error(`Test application failed to start.\n${serverLog}`, { cause: startupError });
        try { const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) }); if (response.ok) break; }
        catch { /* Wait for the process to listen. */ }
        if (Date.now() >= deadline) throw new Error(`Test application startup timed out.\n${serverLog}`);
        await delay(200);
      }
      console.log(`Production application ready with ${fixtures.dataSize.authors} synthetic authors.`);
      return await work({ origin, env, db, ...fixtures });
    } catch (error) {
      if (serverLog) console.error(serverLog);
      throw error;
    } finally {
      if (server?.pid && server.exitCode === null) {
        server.kill();
        await Promise.race([closed, delay(5000)]);
        if (server.exitCode === null) { server.kill("SIGKILL"); await closed; }
      }
      // Only this invocation's randomly named database can be dropped.
      if (db.databaseName !== database || !database.startsWith("coursecraft_verification_")) throw new Error("Unsafe verification database cleanup.");
      await db.dropDatabase();
      await client.close();
    }
  });
}
