/** Verify actual browser played ranges in the compiled offline learner. Run build:export first. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// A local PCM fixture is playable by both native audio and video elements.
const samples = 8000 * 3;
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
const audioDataUri = `data:audio/wav;base64,${wav.toString("base64")}`;
const src = "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
const assets = resolve("public/course-export/assets");
const names = readdirSync(assets);
const js = readFileSync(resolve(assets, names.find((name) => name.endsWith(".js"))), "utf8");
const vite = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, server: { middlewareMode: true, hmr: false, watch: null } });
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(assets, names.find((name) => name.endsWith(".css"))), "utf8"), assets);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  mkdirSync("test-results", { recursive: true });
  for (const { courseLayout, allowSkipping } of ["standard", "slides"].flatMap((courseLayout) => [undefined, false].map((allowSkipping) => ({ courseLayout, allowSkipping })))) {
    const blocks = ["audio", "video", ...(courseLayout === "slides" ? ["cropped"] : [])].map((id, index) => ({
      id, type: id === "audio" ? "audio" : "video", version: 1, allowSkipping,
      data: { src, mimeType: id === "audio" ? "audio/wav" : "video/webm", fileName: "Local playback fixture" },
      slideFrame: { x: 5 + index * 31, y: 20, width: 28, height: 40, z: index },
      ...(id === "cropped" ? { slideMedia: { source: src, width: 1600, height: 900 }, slideCrop: { source: src, x: 25, y: 0, width: 50, height: 100 } } : {}),
    }));
    const variant = allowSkipping === false ? "locked" : "default";
    const data = { courseId: `required-media-${courseLayout}-${variant}`, ...editorSnapshotSchema.parse({
      title: "Required media", description: "", revision: 1, courseLayout, navigationMode: "restricted",
      sections: [{ id: "section", title: "Section", order: 0 }], lessons: [
        { id: "first", sectionId: "section", title: "Watch and listen", order: 0, blocks },
        { id: "second", sectionId: "section", title: "Next lesson", order: 1, blocks: [] },
      ],
    }) };
    const file = resolve(`test-results/required-media-${courseLayout}-${variant}.html`);
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_MEDIA=${JSON.stringify({ aaaaaaaaaaaaaaaaaaaaaaaa: audioDataUri })};window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll(src, "coursecraft-media:aaaaaaaaaaaaaaaaaaaaaaaa").replaceAll("<", "\\u003c")}</script><script>${js}</script></body></html>`);
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], requests = [];
    page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
    page.on("console", (message) => { if (message.type() === "error") console.error(message.text()); });
    page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(file).href);
    if (courseLayout === "standard") await page.getByRole("button", { name: "Start learning", exact: true }).click();
    if (courseLayout === "slides") {
      await page.getByRole("button", { name: "Open slide menu", exact: true }).click();
      assert.equal(await page.locator('button[aria-current="page"] svg[role="img"]').getAttribute("aria-label"), "Lesson 0% complete");
    }
    assert.equal(await page.locator('[data-media-progress]').count(), 0, 'Completion indicators belong in the menu');
    const active = courseLayout === "slides" ? '[data-slide-active="true"]' : '#preview-content-first';
    const players = page.locator(`${active} audio, ${active} video`);
    await players.first().waitFor({ state: "attached" });
    assert.equal(await players.count(), blocks.length);
    const progressKey = `coursecraft-progress-v2-${data.courseId}`;
    const completed = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds ?? [], progressKey);
    assert.equal(await page.locator('[data-media-seek-notice], [data-media-player-controls]').count(), 0);
    if (allowSkipping !== false) {
      for (let index = 0; index < blocks.length; index++) {
        const media = players.nth(index);
        await media.evaluate(async (element) => {
          if (element.readyState < 1) await new Promise((done) => element.addEventListener("loadedmetadata", done, { once: true }));
          element.currentTime = element.duration - 0.25;
        });
        await page.waitForFunction(({ active, index }) => {
          const element = document.querySelectorAll(`${active} audio, ${active} video`)[index];
          return element && !element.seeking && element.currentTime > element.duration - 0.4;
        }, { active, index });
        assert.equal((await completed()).length, index, "Seeking alone must not record completion");
        await media.evaluate((element) => element.play());
        const id = `${blocks[index].id}:${blocks[index].type === "audio" ? "listened" : "watched"}`;
        await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds?.includes(id), { key: progressKey, id });
        assert.ok(await media.evaluate((element) => element.played.start(0) > 0), "Default skipping can finish without replaying the beginning");
      }
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      await page.close();
      continue;
    }
    for (let index = 0; index < blocks.length; index++) {
      const media = players.nth(index);
      await media.evaluate(async (element) => {
        if (element.readyState < 1) await new Promise((done) => element.addEventListener("loadedmetadata", done, { once: true }));
        // A seek before any playback must return to the beginning.
        element.currentTime = element.duration - 0.1;
      });
      await page.waitForFunction((index) => [...document.querySelectorAll('article[aria-hidden="false"] audio, article[aria-hidden="false"] video')][index]?.currentTime < 0.1, index);
      assert.equal((await completed()).length, index);
      await media.evaluate((element) => { element.playbackRate = 0.5; return element.play(); });
      await page.waitForFunction((index) => [...document.querySelectorAll('article[aria-hidden="false"] audio, article[aria-hidden="false"] video')][index]?.currentTime > 0.5, index);
      await media.evaluate((element) => { element.pause(); element.currentTime = element.duration - 0.1; });
      await page.waitForFunction((index) => [...document.querySelectorAll('article[aria-hidden="false"] audio, article[aria-hidden="false"] video')][index]?.currentTime < 2, index);
      assert.equal((await completed()).length, index);
      if (index === 0 && courseLayout === "slides") {
        const id = "audio:listened";
        await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || "{}").mediaProgress?.[id]?.seconds > 0, { key: progressKey, id });
        const saved = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).mediaProgress[id], { key: progressKey, id });
        await page.reload();
        if (courseLayout === "standard") await page.getByRole("button", { name: "Start learning", exact: true }).click();
        await page.waitForFunction((seconds) => Math.abs(document.querySelector('article[aria-hidden="false"] audio')?.currentTime - seconds) < 0.05, saved.seconds);
        await page.getByRole("button", { name: "Open slide menu", exact: true }).click();
        assert.equal((await completed()).length, 0, "Partial resume must not complete the task");
      }
      if (courseLayout === "slides") await page.evaluate(() => {
        const item = document.querySelector('button[aria-current="page"]');
        const read = () => item.querySelector('[aria-label="Lesson complete"]') ? 100 : Number(item.querySelector('svg[role="img"]').getAttribute('aria-label').match(/(\d+)%/)[1]);
        window.mediaCheckpoints = [read()];
        new MutationObserver(() => window.mediaCheckpoints.push(read())).observe(item, { subtree: true, attributes: true, childList: true });
      });
      await media.evaluate((element) => { element.currentTime = 0; element.playbackRate = 0.5; return element.play(); });
      const id = `${blocks[index].id}:${blocks[index].type === "audio" ? "listened" : "watched"}`;
      await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds?.includes(id), { key: progressKey, id });
      if (courseLayout === "slides") {
        const steps = await page.evaluate(() => window.mediaCheckpoints);
        for (const checkpoint of [20, 30, 40, 50, 60, 70, 80, 90, 100]) {
          const expected = Math.floor((index + checkpoint / 100) / blocks.length * 100 + 1e-9);
          assert.ok(steps.includes(expected), `Missing menu circle ${expected}% at media checkpoint ${checkpoint}: ${steps}`);
        }
      }
    }
    assert.equal((await completed()).length, blocks.length);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    await page.reload();
    await page.waitForFunction(({ key, count }) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds?.length === count, { key: progressKey, count: blocks.length });
    await page.close();
  }
  console.log("Offline media checks passed: default skipping and explicit seek restriction in Standard/Presentation audio, video and crops; completion after skipped playback; ten checkpoints; partial resume; original players without lock notes or network requests.");
} finally { await browser?.close(); await vite.close(); }
