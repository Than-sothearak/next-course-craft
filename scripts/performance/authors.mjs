import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { withTestApplication } from "../testing/application.mjs";

const { values } = parseArgs({ options: { authors: { type: "string", default: "100" }, duration: { type: "string", default: "60" }, "skip-build": { type: "boolean", default: false } } });
const authorCount = Number(values.authors), durationSeconds = Number(values.duration);
if (!Number.isInteger(authorCount) || authorCount < 2 || authorCount > 100 || !Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 300) throw new Error("Use 2–100 authors and a duration of 10–300 seconds.");
const samples = [];
const errors = [];
const counters = Array.from({ length: authorCount }, () => ({ reads: 0, saves: 0 }));
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => Math.round(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0);
  return { requests: values.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
}

try {
  await withTestApplication(async ({ origin, authors, dataSize, db }) => {
    async function request(author, endpoint, route, method = "GET", body, measured = true) {
      const start = performance.now();
      let status = 0;
      try {
        const response = await fetch(`${origin}${route}`, { method, redirect: "manual", headers: { Cookie: author.cookie, ...(body ? { "Content-Type": "application/json", Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
        status = response.status;
        const text = await response.text();
        if (status !== 200) throw new Error(`Unexpected HTTP ${status}`);
        return response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
      } catch (error) {
        if (measured) errors.push({ endpoint, status, message: error instanceof Error ? error.message : "Request failed" });
        throw error;
      } finally {
        if (measured) samples.push({ endpoint, durationMs: performance.now() - start, status });
      }
    }
    const first = authors[0];
    await request(first, "dashboard", "/api/dashboard", "GET", undefined, false);
    await request(first, "editor-read", `/api/courses/${first.courseIds[0]}/editor`, "GET", undefined, false);
    await request(first, "preview", `/courses/${first.courseIds[0]}/preview`, "GET", undefined, false);
    const denied = await fetch(`${origin}/api/courses/${authors[1].courseIds[0]}/editor`, { headers: { Cookie: first.cookie }, redirect: "manual" });
    if (denied.status !== 404) throw new Error("Performance fixture ownership isolation failed.");
    const started = performance.now(), deadline = started + durationSeconds * 1000;
    console.log(`Measuring ${authorCount} concurrent author journeys for ${durationSeconds}s (dashboard, team dashboard, editor read/save, preview; 1s think time between actions).`);
    await Promise.all(authors.map(async (author, index) => {
      await delay(index * 10);
      let iteration = 0;
      const think = () => delay(1000);
      while (performance.now() < deadline) {
        const courseId = author.courseIds[iteration % author.courseIds.length];
        try {
          await request(author, "dashboard", "/api/dashboard"); counters[index].reads += 1; await think();
          const snapshot = await request(author, "editor-read", `/api/courses/${courseId}/editor`); counters[index].reads += 1; await think();
          snapshot.lessons[0].blocks[0].data.html = `<p>Saved synthetic author edit ${index + 1}, iteration ${iteration + 1}.</p>`;
          await request(author, "editor-save", `/api/courses/${courseId}/editor`, "PUT", snapshot); counters[index].saves += 1; await think();
          await request(author, "team-dashboard", `/api/dashboard?workspaceId=${author.workspaceId}`); counters[index].reads += 1; await think();
          await request(author, "preview", `/courses/${courseId}/preview`); counters[index].reads += 1; await think();
        } catch { await think(); }
        iteration += 1;
      }
    }));
    const elapsedSeconds = (performance.now() - started) / 1000;
    const endpoints = Object.fromEntries([...new Set(samples.map((sample) => sample.endpoint))].map((endpoint) => [endpoint, summary(samples.filter((sample) => sample.endpoint === endpoint).map((sample) => sample.durationMs))]));
    const persistedCourses = await db.collection("courses").countDocuments({ revision: { $gt: 0 } });
    const report = { measuredAt: new Date().toISOString(), mode: "Production HTTP author journeys against disposable MongoDB; excludes browser rendering, AI providers, media transfers and exports.",
      environment: { platform: process.platform, node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem() / 1024 ** 3) },
      workload: { ...dataSize, concurrentAuthors: authorCount, requestedDurationSeconds: durationSeconds, thinkTimeMs: 1000 }, elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
      totalRequests: samples.length, requestsPerSecond: Number((samples.length / elapsedSeconds).toFixed(2)), failedRequests: errors.length,
      authorsWithSuccessfulSaves: counters.filter((counter) => counter.saves > 0).length, persistedEditedCourses: persistedCourses, endpoints, errors: errors.slice(0, 20) };
    const directory = resolve("test-results/performance"); await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "authors.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length || counters.some((counter) => counter.saves === 0) || persistedCourses === 0) throw new Error("The author workload had failed requests or authors without a persisted save. See test-results/performance/authors.json.");
  }, { authors: authorCount, build: !values["skip-build"] });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
