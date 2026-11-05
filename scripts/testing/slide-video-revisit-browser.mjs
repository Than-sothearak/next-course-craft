/** Check actual played ranges and video revisits in the compiled static learner. Run build:export first. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// Native video elements can play this six-second local PCM fixture without a network request.
const wav = Buffer.alloc(44 + 8000 * 6 * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
const assetId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const source = "/api/assets/" + assetId + "/file";
const assets = resolve("public/course-export/assets");
const names = readdirSync(assets);
const js = readFileSync(resolve(assets, names.find((name) => name.endsWith(".js"))), "utf8");
const vite = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, server: { middlewareMode: true, hmr: false, watch: null } });
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(assets, names.find((name) => name.endsWith(".css"))), "utf8"), assets);
  const video = (id, revisitBehavior, cropped = false) => ({
    id, type: "video", version: 1, allowSkipping: false, data: { src: source, mimeType: "video/webm" },
    slidePlayback: { autoPlay: true, muted: true, showControls: true, ...(revisitBehavior ? { revisitBehavior } : {}) },
    slideFrame: { x: 20, y: 20, width: 60, height: 50, z: 0 },
    ...(cropped ? { slideMedia: { source, width: 1600, height: 900 }, slideCrop: { source, x: 25, y: 0, width: 50, height: 100 } } : {}),
  });
  const data = { courseId: "video-revisits", ...editorSnapshotSchema.parse({
    title: "Video revisits", description: "", revision: 1, courseLayout: "slides", navigationMode: "free",
    sections: [{ id: "section", title: "Slides", order: 0 }],
    lessons: [
      { id: "first", sectionId: "section", title: "Default restart", order: 0, blocks: [video("restart")] },
      { id: "second", sectionId: "section", title: "Continue cropped video", order: 1, blocks: [video("continue", "continue", true)] },
      { id: "third", sectionId: "section", title: "Last slide", order: 2, blocks: [] },
      { id: "fourth", sectionId: "section", title: "Unvisited video", order: 3, blocks: [{ ...video("unvisited"), slidePlayback: { autoPlay: false, muted: true, showControls: true } }] },
    ],
  }) };
  mkdirSync("test-results", { recursive: true });
  const file = resolve("test-results/slide-video-revisit.html");
  writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_MEDIA=' + JSON.stringify({ [assetId]: "data:audio/wav;base64," + wav.toString("base64") }) + ";window.COURSE_EXPORT_DATA=" + JSON.stringify(data).replaceAll(source, "coursecraft-media:" + assetId) + "</script><script>" + js + "</script></body></html>");
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(pathToFileURL(file).href);
  const restart = page.locator('[data-slide-media-player="restart"]');
  const continuing = page.locator('[data-slide-media-player="continue"]');
  const control = (label) => page.locator('[data-slide-active="true"]').getByRole("button", { name: label, exact: true });
  const progressKey = "coursecraft-progress-v2-" + data.courseId;
  const snapshot = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), progressKey);
  const waitPlaying = (id) => page.waitForFunction((id) => document.querySelector('[data-slide-media-player="' + id + '"]')?.currentTime > 1.3, id);
  const state = (locator) => locator.evaluate((media) => ({ time: media.currentTime, paused: media.paused, ended: media.ended }));
  const pauseAtPosition = (locator) => locator.evaluate((media) => { media.pause(); return media.currentTime; });
  async function assertMenuDurations() {
    await control("Open slide menu").click();
    await page.getByLabel("Total media duration: 0:18", { exact: true }).waitFor();
    for (const title of ["Video revisits", "Continue cropped video", "Unvisited video"]) {
      assert.match(await page.getByRole("button", { name: title, exact: true }).textContent(), /0:06 min/);
    }
    assert.equal((await state(page.locator('[data-slide-media-player="unvisited"]'))).paused, true);
    await control("Close course menu").click();
  }
  await waitPlaying("restart");
  await pauseAtPosition(restart);
  await assertMenuDurations();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").mediaProgress?.["restart:watched"]?.seconds > 0, progressKey);
  const restartProgress = (await snapshot()).mediaProgress["restart:watched"];
  await page.evaluate(() => { window.originalVideos = [...document.querySelectorAll("video")]; });
  await control("Next").click();
  await waitPlaying("continue");
  const continueTime = await pauseAtPosition(continuing);
  await control("Previous").click();
  assert.deepEqual(await state(restart), { time: 0, paused: true, ended: false });
  assert.deepEqual((await snapshot()).mediaProgress["restart:watched"], restartProgress);
  await assertMenuDurations();
  await page.keyboard.press("PageDown");
  assert.equal((await state(continuing)).paused, true);
  assert.ok(Math.abs((await state(continuing)).time - continueTime) < 0.05);
  // The cropped timeline must display the saved position after a revisit.
  await continuing.hover();
  assert.ok(Math.abs(Number(await page.getByRole("slider", { name: "Video playback position" }).inputValue()) - continueTime) < 0.05);
  await control("Open slide menu").click();
  await page.getByRole("button", { name: "Last slide", exact: true }).click();
  await control("Previous").click();
  assert.equal((await state(continuing)).paused, true);
  assert.ok(Math.abs((await state(continuing)).time - continueTime) < 0.05);
  assert.equal(await page.evaluate(() => window.originalVideos.every((video, index) => document.querySelectorAll("video")[index] === video)), true);
  await continuing.evaluate((media) => { media.playbackRate = 4; return media.play(); });
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds?.includes("continue:watched"), progressKey);
  await control("Next").click(); await control("Previous").click();
  assert.equal((await state(continuing)).ended, true);
  assert.equal((await state(continuing)).paused, true);
  await control("Previous").click();
  // Seeking forward after a rewind still cannot earn playback credit.
  await restart.evaluate((media) => { media.currentTime = media.duration - 0.1; });
  await page.waitForFunction(() => document.querySelector('[data-slide-media-player="restart"]').currentTime < 3);
  assert.equal((await snapshot()).interactedContentIds.includes("restart:watched"), false);
  await control("Next").click(); await control("Previous").click();
  await restart.evaluate((media) => { media.playbackRate = 4; return media.play(); });
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").interactedContentIds?.includes("restart:watched"), progressKey);
  await control("Next").click(); await control("Previous").click();
  assert.deepEqual(await state(restart), { time: 0, paused: true, ended: false });
  assert.ok((await snapshot()).interactedContentIds.includes("restart:watched"));
  await control("Restart slide").click();
  await page.waitForFunction(() => !document.querySelector('[data-slide-media-player="restart"]').paused);
  await restart.evaluate((media) => media.pause());
  await page.reload();
  await page.locator('[data-slide-active="true"] video').waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelector('[data-slide-active="true"] video')?.readyState >= 1);
  await page.waitForTimeout(500);
  assert.equal((await state(restart)).paused, true, "Restored completed videos must not autoplay");
  await assertMenuDurations();
  assert.ok((await snapshot()).interactedContentIds.includes("restart:watched"));
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log("Video revisit browser checks passed: menu video durations and course total before playback, after navigation and after reload; default restart, exact Continue time, cropped timeline, Previous/Next/keyboard/menu navigation, completion restoration, seeking protection, explicit replay, and offline playback without network requests.");
} finally { await browser?.close(); await vite.close(); }
