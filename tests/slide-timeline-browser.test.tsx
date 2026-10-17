import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LearningPage } from "../lib/slides/blocks";

let browser: Browser, script: string, css: string;
beforeAll(async () => {
  const result = await build({ entryPoints: [resolve("tests/fixtures/timeline-workspace.tsx")], outdir: resolve("test-results/timeline-fixture"), bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", minify: true, alias: { "@": resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  script = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  css = (await postcss([tailwind()]).process(readFileSync(resolve("app/globals.css"), "utf8"), { from: resolve("app/globals.css") })).css + result.outputFiles.filter((file) => file.path.endsWith(".css")).map((file) => file.text).join("\n");
  browser = await chromium.launch({ headless: true }); mkdirSync(resolve("test-results"), { recursive: true });
}, 30_000);
afterAll(async () => { await browser?.close(); }, 30_000);
async function workspace() {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://localhost/**", (route) => route.request().url().endsWith("/timeline-fixture") ? route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div></body></html>` }) : route.abort());
  await page.goto("http://localhost/timeline-fixture");
  await page.addScriptTag({ content: script }); await page.locator("[data-stage-frame]").waitFor({ timeout: 3_000 }).catch(() => { throw new Error(`Fixture did not mount: ${errors.join("; ")}`); });
  return page;
}
async function state(page: Page) { return JSON.parse((await page.locator("[data-layer-state]").textContent())!) as LearningPage; }
describe("real pointer interactions in the timeline workspace", () => {
  it("drags the whole clip at multiple zoom levels, keeps duration/source trims and cancels safely", async () => {
    const page = await workspace();
    try {
      await page.getByRole("button", { name: "Snap timeline clips", exact: true }).click();
      const clip = page.getByRole("button", { name: "Move Narration in time", exact: true });
      const original = (await state(page)).layers[0], track = (await page.locator(`[data-timeline-track="${original.id}"]`).boundingBox())!, bounds = (await clip.boundingBox())!;
      await page.mouse.move(bounds.x + 40, bounds.y + 15); await page.mouse.down(); await page.mouse.move(bounds.x + 40 + 5 * track.width / 30, bounds.y + 15, { steps: 5 });
      expect((await state(page)).layers[0]).toEqual(original);
      await page.mouse.up(); expect((await state(page)).layers[0]).toMatchObject({ start: 7, end: 27, trimStart: 0, trimEnd: 20 });
      await page.getByLabel("Timeline zoom", { exact: true }).fill("2");
      await page.locator("[data-timeline-scroll]").evaluate((element) => { element.scrollLeft = 0; });
      const zoomTrack = (await page.locator(`[data-timeline-track="${original.id}"]`).boundingBox())!, zoomClip = (await clip.boundingBox())!;
      await page.mouse.move(zoomClip.x + 30, zoomClip.y + 15); await page.mouse.down(); await page.mouse.move(zoomClip.x + 30 - 2 * zoomTrack.width / 30, zoomClip.y + 15, { steps: 5 }); await page.mouse.up();
      expect((await state(page)).layers[0]).toMatchObject({ start: 5, end: 25, trimStart: 0, trimEnd: 20 });
      const cancelBounds = (await clip.boundingBox())!;
      await page.mouse.move(cancelBounds.x + 20, cancelBounds.y + 15); await page.mouse.down(); await page.mouse.move(cancelBounds.x + 70, cancelBounds.y + 15); await page.keyboard.press("Escape"); await page.mouse.up();
      expect((await state(page)).layers[0]).toMatchObject({ start: 5, end: 25 });
      await page.getByRole("button", { name: "Fit timeline", exact: true }).click(); expect(await page.locator("[data-timeline-panel]").getAttribute("data-timeline-zoom")).toBe("1");
    } finally { await page.close(); }
  }, 15_000);
  it("scrubs the adaptive ruler and uses icon playback and monitor controls", async () => {
    const page = await workspace();
    try {
      const ruler = page.getByRole("slider", { name: "Timeline ruler", exact: true }), bounds = (await ruler.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 3, bounds.y + 12); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 12, { steps: 4 }); await page.mouse.up();
      expect(Number(await ruler.getAttribute("aria-valuenow"))).toBeCloseTo(15, 1);
      const play = page.getByRole("button", { name: "Play timeline", exact: true }); expect(await play.textContent()).toBe("");
      await play.click(); await page.getByRole("button", { name: "Pause timeline", exact: true }).click(); await page.getByRole("button", { name: "Go to beginning", exact: true }).click();
      expect(await ruler.getAttribute("aria-valuenow")).toBe("0");
      await page.getByRole("button", { name: "Mute audio monitor", exact: true }).click(); expect(await page.getByRole("button", { name: "Unmute audio monitor", exact: true }).getAttribute("aria-pressed")).toBe("true");
      await page.getByRole("button", { name: "Solo Narration monitor", exact: true }).click(); expect(await page.getByRole("button", { name: "Unsolo Narration monitor", exact: true }).getAttribute("aria-pressed")).toBe("true");
      await page.screenshot({ path: resolve("test-results/professional-timeline.png") });
    } finally { await page.close(); }
  }, 15_000);
  it("keeps 100 tracks scrollable and leaves clip DOM unchanged during playback", async () => {
    const page = await workspace();
    try {
      const started = Date.now(); await page.getByRole("button", { name: "Load 100 tracks", exact: true }).click();
      expect(await page.locator("[data-timeline-clip]").count()).toBe(100); expect(Date.now() - started).toBeLessThan(2000);
      expect(await page.locator("[data-timeline-scroll]").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await page.evaluate(() => { const clips = document.querySelectorAll("[data-timeline-clip]"); const state = window as unknown as { clipMutations: number; clipObserver: MutationObserver }; state.clipMutations = 0; state.clipObserver = new MutationObserver((records) => { state.clipMutations += records.length; }); clips.forEach((clip) => state.clipObserver.observe(clip, { attributes: true, subtree: true, childList: true })); });
      await page.getByRole("button", { name: "Play timeline", exact: true }).click();
      await page.waitForFunction(() => Number(document.querySelector('[aria-label="Timeline ruler"]')?.getAttribute("aria-valuenow")) > .3);
      await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
      expect(await page.evaluate(() => { const state = window as unknown as { clipMutations: number; clipObserver: MutationObserver }; state.clipObserver.disconnect(); return state.clipMutations; })).toBe(0);
      await page.locator("[data-timeline-scroll]").evaluate((element) => { element.scrollTop = element.scrollHeight; }); expect(await page.getByRole("button", { name: "Move Track 100 in time", exact: true }).isVisible()).toBe(true);
    } finally { await page.close(); }
  }, 15_000);
  it("freely places and resizes interactive objects and keeps other positions stable on hide", async () => {
    const page = await workspace();
    try {
      await page.getByRole("button", { name: "Use object canvas" }).click();
      const design = (await page.locator("[data-canvas-design]").boundingBox())!, scale = design.width / 1280;
      const move = page.getByRole("button", { name: "Edit Free heading", exact: true }), bounds = (await move.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 120 * scale, bounds.y + bounds.height / 2 + 60 * scale, { steps: 5 }); await page.mouse.up();
      expect((await state(page)).layers[0].placement).toMatchObject({ x: 200, y: 180 });
      const resize = (await page.getByRole("button", { name: "Resize Free heading", exact: true }).boundingBox())!;
      await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2); await page.mouse.down(); await page.mouse.move(resize.x + resize.width / 2 + 60 * scale, resize.y + resize.height / 2 + 30 * scale, { steps: 5 }); await page.mouse.up();
      expect((await state(page)).layers[0].placement).toMatchObject({ width: 540, height: 230 });
      const tabs = (await state(page)).layers[1];
      const before = (await page.locator(`[data-layer-id="${tabs.id}"]`).boundingBox())!;
      await page.getByRole("button", { name: "Hide first object" }).click();
      expect((await page.locator(`[data-layer-id="${tabs.id}"]`).boundingBox())!.y).toBeCloseTo(before.y, 1);
      await page.getByRole("button", { name: "Preview objects" }).click(); await page.getByRole("button", { name: "Explore 1", exact: true }).click();
      expect(await page.getByText("Replace this with the explanation for item 1.", { exact: true }).isVisible()).toBe(true);
      await page.screenshot({ path: resolve("test-results/free-object-canvas.png") });
    } finally { await page.close(); }
  }, 15_000);
  it("keeps HD and Full HD stages fixed when content grows and refits them when the divider moves", async () => {
    const page = await workspace();
    try {
      const stage = page.locator("[data-stage-content]"), frame = page.locator("[data-stage-frame]");
      await page.waitForFunction(() => document.querySelector("[data-stage-frame]")!.getBoundingClientRect().width > 900);
      const before = (await frame.boundingBox())!;
      expect(await stage.evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual([1280, 720]);
      await page.getByRole("button", { name: "Toggle long content" }).click();
      const after = (await frame.boundingBox())!; expect(after.height).toBeCloseTo(before.height, 0);
      expect(await stage.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await page.getByLabel("Frame resolution").selectOption("fullHd");
      expect(await stage.evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual([1920, 1080]);
      const divider = (await page.getByRole("separator", { name: "Resize timeline" }).boundingBox())!;
      const oldHeight = (await page.locator("[data-timeline-panel]").boundingBox())!.height;
      await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2); await page.mouse.down(); await page.mouse.move(divider.x + divider.width / 2, divider.y - 90, { steps: 5 }); await page.mouse.up();
      const newHeight = (await page.locator("[data-timeline-panel]").boundingBox())!.height;
      expect(newHeight).toBeGreaterThan(oldHeight + 80);
      await page.waitForFunction((height) => document.querySelector("[data-stage-frame]")!.getBoundingClientRect().height < height, before.height);
      const resized = (await frame.boundingBox())!; expect(resized.width / resized.height).toBeCloseTo(16 / 9, 2);
      await page.screenshot({ path: resolve("test-results/fixed-stage-timeline.png") });
    } finally { await page.close(); }
  }, 15_000);
  it("trims real audio/video handles, clamps source duration and supports keyboard controls", async () => {
    const page = await workspace();
    try {
      const audio = (await state(page)).layers[0];
      const track = (await page.locator(`[data-timeline-track="${audio.id}"]`).boundingBox())!;
      const handle = page.getByRole("slider", { name: "Trim Narration end", exact: true });
      const bounds = (await handle.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(track.x + track.width * .4, bounds.y + bounds.height / 2, { steps: 5 }); await page.mouse.up();
      expect((await state(page)).layers[0]).toMatchObject({ start: 2, end: 12, trimStart: 0, trimEnd: 10 });
      await handle.focus(); await page.keyboard.press("Shift+ArrowRight"); expect((await state(page)).layers[0]).toMatchObject({ end: 13, trimEnd: 11 });
      await page.getByRole("slider", { name: "Trim Video lesson end", exact: true }).focus(); await page.keyboard.press("End"); expect((await state(page)).layers[1]).toMatchObject({ end: 12, trimEnd: 12 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1400);
    } finally { await page.close(); }
  }, 15_000);
});
