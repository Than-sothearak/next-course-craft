import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { MongoClient } from "mongodb";

async function mongodPath() {
  if (process.env.TEST_MONGOD_PATH) return process.env.TEST_MONGOD_PATH;
  if (process.platform === "win32") {
    const directory = join(process.env.ProgramFiles ?? "C:\\Program Files", "MongoDB", "Server");
    const versions = await readdir(directory).catch(() => []);
    for (const version of versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const candidate = join(directory, version, "bin", "mongod.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  return "mongod";
}

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test database port.");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

/** Never reads .env.local or reuses the application's MONGODB_URI. */
export async function withTestMongoDB(work) {
  if (process.env.RBAC_TEST_MONGODB_URI) return work(process.env.RBAC_TEST_MONGODB_URI);

  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "coursecraft-test-mongo-"));
  const port = await freePort();
  const uri = `mongodb://127.0.0.1:${port}/?replicaSet=coursecraft_tests&directConnection=true`;
  const child = spawn(await mongodPath(), [
    "--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1",
    "--replSet", "coursecraft_tests", "--wiredTigerCacheSizeGB", "0.25", "--quiet",
  ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let startupError;
  let log = "";
  child.on("error", (error) => { startupError = error; });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { log = (log + chunk).slice(-4000); });
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 500, connectTimeoutMS: 500 });
  const exited = new Promise((resolve) => child.once("close", resolve));
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      if (startupError) throw new Error("Cannot start disposable MongoDB. Install mongod, set TEST_MONGOD_PATH, or configure RBAC_TEST_MONGODB_URI for a dedicated test replica set.", { cause: startupError });
      if (child.exitCode !== null) throw new Error(`Disposable MongoDB exited during startup.\n${log}`);
      try { await client.connect(); await client.db("admin").command({ ping: 1 }); break; }
      catch (error) {
        if (Date.now() >= deadline) throw new Error("Disposable MongoDB did not become available.", { cause: error });
        await delay(200);
      }
    }
    await client.db("admin").command({ replSetInitiate: { _id: "coursecraft_tests", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    while (!(await client.db("admin").command({ hello: 1 })).isWritablePrimary) {
      if (Date.now() >= deadline) throw new Error("The test replica set did not elect a primary.");
      await delay(200);
    }
    console.log("Started a disposable MongoDB replica set for verification.");
    return await work(uri);
  } finally {
    if (child.pid && child.exitCode === null) {
      await client.db("admin").command({ shutdown: 1, force: true }).catch(() => undefined);
      const closed = await Promise.race([exited.then(() => true), delay(5000).then(() => false)]);
      if (!closed) { child.kill(); await exited; }
    }
    await client.close();
    // Only remove the directory created above, never a configured database path.
    if (dirname(directory) !== temporaryRoot || !basename(directory).startsWith("coursecraft-test-mongo-")) throw new Error("Unsafe test database cleanup path.");
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
