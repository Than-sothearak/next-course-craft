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
  const result = await build({ entryPoints: [resolve("tests/fixtures/master-workspace.tsx")], outdir: resolve("test-results/master-fixture"), bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", minify: true, alias: { "@": resolve(".") }, define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' } });
  script = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  css = (await postcss([tailwind()]).process(readFileSync(resolve("app/globals.css"), "utf8"), { from: resolve("app/globals.css") })).css + result.outputFiles.filter((file) => file.path.endsWith(".css")).map((file) => file.text).join("\n");
  browser = await chromium.launch({ headless: true }); mkdirSync(resolve("test-results"), { recursive: true });
}, 30_000);
afterAll(async () => { await browser?.close(); }, 30_000);
async function workspace() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[]=[]; page.on("pageerror", error=>errors.push(error.message)); page.setDefaultTimeout(2000);
  await page.route("http://localhost/**", (route) => route.request().url().endsWith("/master-fixture") ? route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div></body></html>` }) : route.abort());
  await page.goto("http://localhost/master-fixture"); await page.addScriptTag({ content: script });
  await page.locator("[data-stage-frame]").waitFor().catch(()=>{ throw new Error(`Fixture: ${errors.join("; ")}`); }); return page;
}
const state = async (page: Page) => JSON.parse((await page.locator("[data-layer-state]").textContent())!) as LearningPage;
describe("Institutional Green in Chromium", () => {
  it("fits both resolutions, protects master regions and converts pointer motion into safe-area coordinates", async () => {
    const page = await workspace();
    try {
      const master = page.locator("[data-slide-viewport] [data-slide-master]");
      const header = (await master.locator("[data-master-header]").boundingBox())!, safe = (await page.locator("[data-canvas-design]").boundingBox())!, footer = (await master.locator("[data-master-footer]").boundingBox())!;
      expect(safe.y).toBeGreaterThan(header.y + header.height); expect(safe.y + safe.height).toBeLessThan(footer.y);
      expect(await master.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
      const before = await state(page), handle = page.getByRole("button", { name: "Edit Concept text", exact: true }), bounds = (await handle.boundingBox())!;
      await page.mouse.move(bounds.x + 40, bounds.y + 40); await page.mouse.down(); await page.mouse.move(bounds.x + 40 + 100 * safe.width / 1280, bounds.y + 40 + 60 * safe.height / 720, { steps: 5 }); await page.mouse.up();
      expect((await state(page)).layers[0].placement).toMatchObject({ x: 120, y: 100 }); expect((await state(page)).layers[1]).toEqual(before.layers[1]);
      await page.getByLabel("Preview resolution").selectOption("fullHd");
      expect(await page.locator("[data-stage-content]").evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual([1920, 1080]);
      expect(await master.locator("[data-master-number]").textContent()).toBe("3"); await page.getByRole("button", { name: "Reorder slide", exact: true }).click(); expect(await master.locator("[data-master-number]").textContent()).toBe("4");
      await page.getByLabel("Timeline playhead").fill("30"); expect(await master.locator("[data-master-header]").isVisible()).toBe(true); expect(await master.locator("[data-master-footer]").isVisible()).toBe(true); expect(await page.locator("[data-master-track]").isVisible()).toBe(true);
      await page.screenshot({ path: resolve("test-results/institutional-green-editor.png") });
    } finally { await page.close(); }
  });
  it("previews and cancels local edits, applies footer changes and retains interactive object actions", async () => {
    const page = await workspace();
    try {
      const original = await state(page); await page.getByRole("button", { name: "Open master editor" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit Slide Master" });
      await dialog.getByLabel("Module or lesson text").fill("Institute of Technology · Learn");
      expect(await dialog.locator("[data-master-footer-text]").textContent()).toBe("Institute of Technology · Learn");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(await page.locator("[data-slide-viewport] [data-master-footer-text]").textContent()).toContain("Module 1");
      await page.getByRole("button", { name: "Open master editor" }).click(); await dialog.getByLabel("Module or lesson text").fill("Institute of Technology · Learn"); await dialog.getByRole("button", { name: "Apply master", exact: true }).click();
      expect(await page.locator("[data-slide-viewport] [data-master-footer-text]").textContent()).toBe("Institute of Technology · Learn"); expect(await state(page)).toEqual(original);
      await page.getByRole("button", { name: "Preview timing", exact: true }).click(); await page.getByRole("button", { name: "Explore 1", exact: true }).click(); expect(await page.locator("[data-slide-viewport]").getByText("Replace this with the explanation for item 1.", { exact: true }).isVisible()).toBe(true);
      await page.locator("[data-stage-frame]").screenshot({ path: resolve("test-results/institutional-green-canvas.png") });
    } finally { await page.close(); }
  });
});
