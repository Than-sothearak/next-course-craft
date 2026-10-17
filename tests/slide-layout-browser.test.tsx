import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TemplateSurface } from "../components/slides/template-surface";
import styles from "../components/slides/template-surface.module.css";
import { createTemplateContent } from "../lib/slides/templates";
import { slideTemplateDefinitions, type SlideTemplateId } from "../lib/slides/template-definitions";
import { defaultSlideTheme } from "../lib/slides/themes";

const rawCss = readFileSync(resolve("components/slides/template-surface.module.css"), "utf8");
const css = rawCss.replace(/\.([a-zA-Z_][\w-]*)/g, (selector, key: string) => styles[key] ? `.${styles[key]}` : selector);
let browser: Browser, page: Page;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); page = await browser.newPage(); mkdirSync(resolve("test-results"), { recursive: true }); }, 20_000);
afterAll(async () => { await browser?.close(); }, 30_000);
async function show(id: SlideTemplateId, width: number, longContent = false) {
  const template = createTemplateContent(id);
  if (longContent) template.slots.body = { type: "text", content: "An accessible explanation with important details. ".repeat(50) };
  const markup = renderToStaticMarkup(<TemplateSurface template={template} theme={defaultSlideTheme} />);
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button{cursor:pointer}*{box-sizing:border-box}${css}</style></head><body>${markup}</body></html>`);
}
describe("responsive slide layouts in Chromium", () => {
  for (const width of [1280, 768, 390]) {
    it.each(slideTemplateDefinitions)(`renders $name at ${width}px without clipping or horizontal scrolling`, async ({ id }) => {
      await show(id, width);
      const metrics = await page.evaluate(() => {
        const surface = document.querySelector("section")!, heading = document.querySelector("h2")!;
        const bounds = surface.getBoundingClientRect(), title = heading.getBoundingClientRect();
        return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, headingSize: parseFloat(getComputedStyle(heading).fontSize), titleInside: title.left >= bounds.left && title.right <= bounds.right + 1 && title.bottom <= bounds.bottom + 1 };
      });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
      expect(metrics.titleInside).toBe(true); expect(metrics.headingSize).toBeGreaterThanOrEqual(28);
    });
  }
  it("reflows columns and cards to a single column on mobile", async () => {
    for (const id of ["two-column", "three-cards"] as const) {
      await show(id, 1280);
      const grid = page.locator("article").first().locator("..");
      expect((await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(id === "two-column" ? 2 : 3);
      await show(id, 390);
      expect((await page.locator("article").first().locator("..").evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(1);
    }
  });
  it("grows to fit long text and keeps mobile navigation touch-friendly", async () => {
    await show("title-description", 390, true);
    const body = page.locator("p").nth(1), surface = page.locator("section");
    const bodyBounds = await body.boundingBox(), surfaceBounds = await surface.boundingBox();
    expect(bodyBounds!.y + bodyBounds!.height).toBeLessThanOrEqual(surfaceBounds!.y + surfaceBounds!.height);
    await show("cover", 390);
    expect((await page.getByRole("button", { name: "Let’s begin" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: resolve("test-results/slide-template-mobile.png"), fullPage: true });
    await show("text-image", 1280);
    await page.screenshot({ path: resolve("test-results/slide-template-desktop.png"), fullPage: true });
  });
});
