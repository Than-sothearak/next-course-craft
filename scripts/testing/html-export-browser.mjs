/** Exercise the downloaded, single-file HTML rather than the Vite module entry. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Script } from "node:vm";
import assert from "node:assert/strict";

const vite = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, server: { middlewareMode: true } });
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  const data = { courseId: "html-reproduction", ...editorSnapshotSchema.parse({ title: "Presentation export", description: "Test", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" }, navigationMode: "free", sections: [{ id: "section", title: "Learn", order: 0 }], lessons: ["first", "second"].map((id, order) => ({ id, sectionId: "section", title: `Visible ${id} slide`, order, blocks: [{ id: `heading-${id}`, type: "heading", version: 1, data: { text: `The ${id} course slide is visible`, level: 1 } }, { id: `audio-${id}`, type: "audio", version: 1, slidePlayback: { audioSize: "small" }, slideFrame: { x: 10, y: 55, width: 24, height: 36 / 540 * 100, z: 1 }, data: { src: "", fileName: "Compact narration" } }] })) }) };
  const assets = resolve("public/course-export/assets"), names = readdirSync(assets);
  const js = readFileSync(resolve(assets, names.find((name) => name.endsWith(".js"))), "utf8");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(assets, names.find((name) => name.endsWith(".css"))), "utf8"), assets);
  new Script(js);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll("<", "\\u003c")}</script><script>${js}</script></body></html>`;
  mkdirSync("test-results", { recursive: true }); const file = resolve("test-results/presentation-inline.html"); writeFileSync(file, html);
  browser = await chromium.launch({ headless: true });
  for (const saved of [null, "deleted-slide", "second"]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [], network = []; page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    await page.addInitScript((saved) => {
      localStorage.clear();
      if (saved) localStorage.setItem("coursecraft-progress-v2-html-reproduction", JSON.stringify({ selectedLessonId: saved, visitedLessonIds: [], lessonScrollProgress: {}, revealedDividerIds: [], completedDividerIds: [] }));
    }, saved);
    await page.goto(pathToFileURL(file).href);
    const expectedId = saved === "second" ? "second" : "first";
    await page.waitForFunction((expectedId) => document.querySelector(`article#preview-content-${expectedId}`)?.getAttribute("aria-hidden") === "false", expectedId);
    const canvas = page.locator('[data-slide-active="true"]'); await canvas.waitFor();
    await canvas.evaluate(async (element) => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
    });
    const bounds = await canvas.boundingBox(); assert.ok(bounds && bounds.width > 200 && bounds.height > 150, "Exported slide needs a visible canvas, beyond its navbar");
    assert.equal(await page.locator('article[aria-hidden="false"]').count(), 1);
    assert.equal(await page.getByText(`The ${expectedId} course slide is visible`, { exact: true }).count(), 1);
    assert.equal(await page.getByText(`The ${expectedId} course slide is visible`, { exact: true }).isVisible(), true);
    const audio = canvas.locator('[data-slide-audio-size="small"] audio');
    assert.equal(await audio.evaluate((element) => element.offsetHeight), 32, 'Downloaded HTML must retain the compact audio height');
    await page.waitForFunction((expectedId) => JSON.parse(localStorage.getItem("coursecraft-progress-v2-html-reproduction") || "{}").selectedLessonId === expectedId, expectedId);
    await page.screenshot({ path: `test-results/presentation-inline-${saved ?? "fresh"}.png` });
    assert.deepEqual(errors, []); assert.deepEqual(network, []); await page.close();
  }
  console.log("Single-file presentation HTML checks passed on file://: visible slide content, compact audio height, recovery from deleted-slide resume, valid resume, and no external network requests.");
} finally { await browser?.close(); await vite.close(); }
