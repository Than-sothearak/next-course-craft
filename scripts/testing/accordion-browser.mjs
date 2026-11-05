/** Verify accordion animation, rich text and offline parity. Run build:export first. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

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
  for (const courseLayout of ["standard", "slides"]) {
    const accordion = (id, layout, y) => ({ id, type: "accordion", version: 1, slideFrame: { x: 10, y, width: 80, height: 40, z: 1 }, data: {
      layout, displayMode: "oneByOne", items: [
        { id: "one", title: "First section", titleHtml: '<p><strong>First section</strong></p>', body: "First explanation", bodyHtml: '<p><em>First explanation</em></p><p>More detail to give the panel a measurable height.</p>' },
        { id: "two", title: "Second section", body: "Second explanation", bodyHtml: '<p><span style="color:#2563eb;font-size:20px">Second explanation</span></p><p>Another paragraph for the animated panel.</p>' },
      ],
    } });
    const data = { courseId: `accordion-${courseLayout}`, ...editorSnapshotSchema.parse({ title: "Accordion", description: "", revision: 1, courseLayout, navigationMode: "restricted", sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{ id: "lesson", sectionId: "s", title: "Accordion lesson", order: 0, blocks: [accordion("accordion", "accordion", 3), accordion("tabs", "tabs", 50)] }] }) };
    const file = resolve(`test-results/accordion-${courseLayout}.html`);
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll("<", "\\u003c")}</script><script>${js}</script></body></html>`);
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(file).href);
    if (courseLayout === "standard") await page.getByRole("button", { name: "Start learning", exact: true }).click();
    await page.locator("#accordion-panel-one em").waitFor();
    assert.equal(await page.locator("#accordion-trigger-one strong").innerText(), "First section");
    const heights = await page.evaluate(async () => {
      const panel = () => document.getElementById("accordion-panel-one");
      const initial = panel().getBoundingClientRect().height;
      document.getElementById("accordion-trigger-one").click();
      const samples = [];
      await new Promise((done) => {
        const start = performance.now();
        function sample() { samples.push(panel()?.getBoundingClientRect().height ?? 0); if (performance.now() - start < 400) requestAnimationFrame(sample); else done(); }
        requestAnimationFrame(sample);
      });
      return { initial, samples };
    });
    assert.ok(heights.samples.some((height) => height > 1 && height < heights.initial - 1), `No intermediate collapse heights in ${courseLayout}: ${JSON.stringify(heights)}`);
    assert.equal(await page.locator("#accordion-panel-one").count(), 0);
    await page.locator("#accordion-trigger-two").click();
    await page.locator("#accordion-panel-two").waitFor({ state: "visible" });
    assert.equal(await page.locator("#accordion-panel-two span").evaluate((node) => getComputedStyle(node).color), "rgb(37, 99, 235)");
    await page.locator("#tabs-tab-one").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#tabs-tab-two").getAttribute("aria-selected"), "true");
    await page.waitForFunction(() => !document.getElementById("tabs-panel-one"));
    assert.equal(await page.locator("#tabs-panel-two").getAttribute("aria-hidden"), null);
    assert.equal(await page.locator('[contenteditable="true"]').count(), 0);
    await page.screenshot({ path: `test-results/accordion-${courseLayout}.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const startLearning = page.getByRole("button", { name: "Start learning", exact: true });
    if (await startLearning.isVisible()) await startLearning.click();
    await page.locator("#accordion-panel-one em").waitFor({ state: "visible" });
    const reduced = await page.evaluate(async () => {
      const panel = () => document.getElementById("accordion-panel-one");
      const initial = panel().getBoundingClientRect().height;
      document.getElementById("accordion-trigger-one").click();
      const samples = [];
      for (let index = 0; index < 8; index++) { await new Promise(requestAnimationFrame); samples.push(panel()?.getBoundingClientRect().height ?? 0); }
      return { initial, samples };
    });
    assert.ok(!reduced.samples.some((height) => height > 1 && height < reduced.initial - 1), `Reduced motion animated intermediate heights: ${JSON.stringify(reduced)}`);
    assert.equal(reduced.samples.at(-1), 0);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    await page.close();
  }
  console.log("Accordion browser checks passed: smooth intermediate heights, tab keyboard navigation, rich title/body styles, reduced motion and static Standard/Presentation playback without external requests.");
} finally { await browser?.close(); await vite.close(); }
