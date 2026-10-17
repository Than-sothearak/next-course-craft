import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LearningPageSurface } from "../components/slides/learning-page-surface";
import { createLearningBlock, type LearningPage } from "../lib/slides/blocks";
import { defaultSlideTheme } from "../lib/slides/themes";
import { LearningPageEditor } from "../app/courses/[courseId]/slides/edit/_components/learning-page-editor";
import { composeLearningPage } from "../lib/slides/pages";
import { slideSnapshotSchema } from "../lib/slides/schema";

let browser: Browser, css: string;
beforeAll(async () => {
  css = (await postcss([tailwind()]).process(readFileSync(resolve("app/globals.css"), "utf8"), { from: resolve("app/globals.css") })).css;
  browser = await chromium.launch({ headless: true }); mkdirSync(resolve("test-results"), { recursive: true });
}, 30_000);
afterAll(async () => { await browser?.close(); }, 30_000);

describe("responsive learning content blocks in Chromium", () => {
  it("renders the composer, layer inspector and timeline together", async () => {
    const slide = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "Learn through exploration", order: 0, objects: [], revision: 0 }), id: "page" });
    slide.composition!.layers = [createLearningBlock("text"), createLearningBlock("tabs"), createLearningBlock("audio"), createLearningBlock("quiz")];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      const markup = renderToStaticMarkup(<div className="flex h-screen flex-col"><LearningPageEditor courseId="course" slide={{ ...slide, composition: slide.composition! }} theme={defaultSlideTheme} viewport="desktop" advanced disabled={false} onUpdate={() => {}} onAdd={() => {}} /></div>);
      await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${markup}</body></html>`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
      expect(await page.getByLabel("Page timeline").isVisible()).toBe(true);
      expect(await page.getByRole("heading", { name: "Content layers" }).isVisible()).toBe(true);
      await page.screenshot({ path: resolve("test-results/learning-page-editor.png") });
    } finally { await page.close(); }
  });
  it.each([1280, 768, 390])("keeps reading, interactions, quiz and audio usable at %ipx", async (width) => {
    const text = createLearningBlock("text");
    if (text.kind === "text") { text.heading = "Learn, explore and check your understanding"; text.body = "Read the explanation, explore the interactive text, then answer the question. ".repeat(8) + "long-reference-".repeat(30); }
    const audio = createLearningBlock("audio");
    if (audio.kind === "audio") { audio.src = "https://example.invalid/narration.mp3"; audio.transcript = "A readable transcript of the narration."; }
    const content: LearningPage = { duration: 30, layout: "flow", layers: [text, audio, createLearningBlock("accordion"), createLearningBlock("tabs"), createLearningBlock("flashcards"), createLearningBlock("quiz")] };
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    try {
      await page.route("https://example.invalid/**", (route) => route.abort());
      const markup = renderToStaticMarkup(<LearningPageSurface page={content} theme={defaultSlideTheme} />);
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.locator("[data-layer-id]").count()).toBe(6);
      const audioBounds = await page.locator("audio").boundingBox(); expect(audioBounds!.x + audioBounds!.width).toBeLessThanOrEqual(width);
      expect((await page.locator("fieldset label").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.locator("details summary").nth(1).click(); expect(await page.locator("details").nth(1).getAttribute("open")).not.toBeNull();
      await page.screenshot({ path: resolve(`test-results/learning-page-${width}.png`) });
    } finally { await page.close(); }
  });
});
