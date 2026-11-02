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
  const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  const gradient = "linear-gradient(135deg, #2563eb 0%, #f97316 100%)";
  const data = { courseId: "html-reproduction", ...editorSnapshotSchema.parse({ title: "Presentation export", description: "Test", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas", background: { type: "image", imageSrc: image, overlayColor: "#0066cc", overlayOpacity: 20 } }, navigationMode: "free", sections: [{ id: "section", title: "Learn", order: 0 }], lessons: ["first", "second"].map((id, order) => ({ id, sectionId: "section", title: `Visible ${id} slide`, order, blocks: [
    { id: `heading-${id}`, type: "heading", version: 1, data: { text: `The ${id} course slide is visible`, level: 1 } },
    { id: `equation-${id}`, type: "richText", version: 1, slideFrame: { x: 8, y: 32, width: 38, height: 20, z: 1 }, data: { html: '<p><span data-font-family="battambang" style="font-family:Battambang, Arial, Helvetica, sans-serif">Math <sup>2</sup></span> <span data-type="inline-math" data-latex="E=mc^2"></span></p><div data-type="block-math" data-latex="\\frac{a}{b}"></div>' } },
    { id: `audio-${id}`, type: "audio", version: 1, slidePlayback: { audioSize: "small" }, slideFrame: { x: 10, y: 55, width: 24, height: 36 / 540 * 100, z: 1 }, data: { src: "", fileName: "Compact narration" } },
    { id: `image-${id}`, type: "image", version: 1, slideGroupId: `media-${id}`, slideLocked: true, slideHiddenInEditor: true, slideFrame: { x: 55, y: 20, width: 25, height: 25, z: 1 }, slideMediaOverlay: { color: "#ff8800", opacity: 40 }, data: { src: image, alt: "Tinted image" } },
    { id: `video-${id}`, type: "video", version: 1, slideGroupId: `media-${id}`, slideLocked: true, slideHiddenInEditor: true, slideFrame: { x: 55, y: 55, width: 25, height: 25, z: 1 }, slideMediaOverlay: { color: gradient, opacity: 60 }, data: { src: "data:video/webm;base64,", mimeType: "video/webm" } },
  ] })) }) };
  const assets = resolve("public/course-export/assets"), names = readdirSync(assets);
  const js = readFileSync(resolve(assets, names.find((name) => name.endsWith(".js"))), "utf8");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(assets, names.find((name) => name.endsWith(".css"))), "utf8"), assets);
  assert.doesNotMatch(css, /url\(["']?\.\/[^)]+\.(?:woff2?|ttf)/, 'All local equation/font assets must be embedded in the HTML');
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
    const mediaOverlays = await canvas.locator('[data-slide-media-object] [data-slide-color-overlay]').evaluateAll((elements) => elements.map((element) => { const style = getComputedStyle(element); return { color: style.backgroundColor, image: style.backgroundImage, opacity: style.opacity, pointerEvents: style.pointerEvents }; }));
    assert.equal(mediaOverlays.length, 2, 'Downloaded HTML retains image and video overlays');
    assert.equal(await canvas.locator('[data-slide-media-object]').count(), 2, 'Editor-hidden grouped media must remain visible to learners');
    assert.deepEqual(mediaOverlays.map((overlay) => overlay.opacity), ["0.4", "0.6"]);
    assert.equal(mediaOverlays[0].color, "rgb(255, 136, 0)");
    assert.ok(mediaOverlays[1].image.startsWith("linear-gradient("), 'Video overlay retains its chosen gradient');
    assert.ok(mediaOverlays.every((overlay) => overlay.pointerEvents === "none"), 'Overlays must allow media interaction');
    assert.equal(await canvas.locator('[data-slide-master-background] [data-slide-color-overlay]').evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(0, 102, 204)");
    assert.equal(await canvas.locator('.tiptap-mathematics-render math').count(), 2, "Inline and display equations keep accessible rendering offline");
    assert.equal(await canvas.locator('[data-font-family="battambang"]').first().evaluate((element) => getComputedStyle(element).fontFamily.includes("Battambang")), true);
    assert.equal(await canvas.locator('sup').first().textContent(), "2");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('16px KaTeX_Main')), true, "Equation fonts load from the single HTML file");
    assert.equal(await page.evaluate(() => [...document.fonts].some((font) => font.family.includes('KaTeX_Main') && font.status === 'loaded')), true);
    await page.waitForFunction((expectedId) => JSON.parse(localStorage.getItem("coursecraft-progress-v2-html-reproduction") || "{}").selectedLessonId === expectedId, expectedId);
    await page.screenshot({ path: `test-results/presentation-inline-${saved ?? "fresh"}.png` });
    assert.deepEqual(errors, []); assert.deepEqual(network, []); await page.close();
  }
  const page = await browser.newPage();
  await page.goto(pathToFileURL(file).href);
  const canvas = page.locator('[data-slide-active="true"]');
  await canvas.waitFor();
  for (const [width, height] of [[1920, 1080], [1280, 800], [1279, 800], [1194, 834], [1024, 768], [768, 1024], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-slide-active="true"]');
      const stage = canvas?.closest('[data-slide-stage]');
      if (!canvas || !stage) return false;
      const bounds = canvas.getBoundingClientRect();
      return Math.abs(bounds.width - Math.floor(Math.min(stage.clientWidth, stage.clientHeight * 16 / 9))) < 1;
    });
    const geometry = await canvas.evaluate((element) => {
      const workspace = document.querySelector('[data-presentation-workspace]');
      const padding = getComputedStyle(workspace);
      const stage = element.closest('[data-slide-stage]').getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return { padding: [padding.paddingTop, padding.paddingRight, padding.paddingBottom, padding.paddingLeft], width: bounds.width, height: bounds.height, fits: bounds.left >= stage.left - 1 && bounds.top >= stage.top - 1 && bounds.right <= stage.right + 1 && bounds.bottom <= stage.bottom + 1, pageFits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight };
    });
    assert.deepEqual(geometry.padding, Array(4).fill(width >= 1280 ? "24px" : "0px"), `Presentation spacing at ${width}x${height}`);
    assert.ok(geometry.fits && geometry.pageFits, `Presentation must fit without clipping or page scrolling at ${width}x${height}`);
    assert.ok(Math.abs(geometry.width / geometry.height - 16 / 9) < 0.001, "Responsive fitting must preserve the slide ratio");
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByLabel("Presentation zoom", { exact: true }).selectOption("150");
  assert.equal(await page.locator('[data-presentation-workspace]').evaluate((element) => getComputedStyle(element).padding), "0px", "Exact zoom keeps its scrollable workspace");
  await page.getByLabel("Presentation zoom", { exact: true }).selectOption("fit");
  await page.getByRole("button", { name: "Present full screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-presentation-view]')?.getAttribute("data-fullscreen") === "true");
  assert.equal(await page.locator('[data-presentation-workspace]').evaluate((element) => getComputedStyle(element).padding), "0px", "Fullscreen uses the entire viewport");
  await page.close();
  console.log("Single-file presentation HTML checks passed on file://: visible content, image/video/background color overlays, compact audio, resume recovery, no external requests, responsive desktop/tablet/phone fitting, exact zoom, and fullscreen spacing.");
} finally { await browser?.close(); await vite.close(); }
