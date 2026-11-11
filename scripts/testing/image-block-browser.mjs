/** Verify image settings across every layout, slides, crops, and fullscreen previews. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#24734f"/><circle cx="400" cy="200" r="80" fill="white"/></svg>')}`;
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ImageBlockSettings} from '/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/image-block-settings.tsx';
import {ContentBlockPreview} from '/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/content-block-preview.tsx';
import {PreviewBlock} from '/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block.tsx';
import {SlideMediaObject} from '/app/courses/[courseId]/_components/slide-presentation/slide-media-object.tsx';
import {imageBlockSchema} from '/lib/schemas/block.ts';
import '/app/globals.css';
function App(){
  const [block,setBlock]=useState(()=>imageBlockSchema.parse({id:'image',version:1,type:'image',data:{src:${JSON.stringify(image)},alt:'Landscape',layout:'text-left',title:'Image and text',body:'Supporting text.'}}));
  return <main className="mx-auto max-w-5xl space-y-8 p-4">
    <section aria-label="Settings"><ImageBlockSettings block={block} onChange={setBlock} setMediaLibraryTarget={()=>{}}/></section>
    <section aria-label="Editor"><ContentBlockPreview block={block} onChange={setBlock}/></section>
    <section aria-label="Learner"><PreviewBlock block={block} device="desktop" orientation="landscape"/></section>
    <section aria-label="Slide" className="h-80"><PreviewBlock block={{...block,data:{...block.data,layout:'full'}}} device="desktop" orientation="landscape" slideLayout/></section>
    <section aria-label="Cropped slide" className="h-80"><SlideMediaObject block={{...block,data:{...block.data,layout:'full'},slideMedia:{source:block.data.src,width:800,height:400},slideCrop:{source:block.data.src,x:0,y:0,width:50,height:50}}}/></section>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const vite = await createServer({
  configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-image-block-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**"] } },
  plugins: [{
    name: "image-block-fixture",
    resolveId: id => id === "/__image-block.tsx" ? id : null,
    load: id => id === "/__image-block.tsx" ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__image-block") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__image-block.tsx"></script></body></html>');
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__image-block`);
  const editor = page.getByRole("region", { name: "Editor", exact: true });
  const learner = page.getByRole("region", { name: "Learner", exact: true });
  const slide = page.getByRole("region", { name: "Slide", exact: true });
  await expect(page.getByLabel("Image fit", { exact: true })).toHaveValue("cover");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const layout of ["full", "banner", "text-left", "text-right", "text-overlay", "card", "cover"]) {
      await page.getByLabel("Image layout", { exact: true }).selectOption(layout);
      await page.getByLabel("Image frame ratio", { exact: true }).selectOption("4/3");
      for (const fit of ["cover", "contain", "fill"]) {
        await page.getByLabel("Image fit", { exact: true }).selectOption(fit);
        for (const scope of [editor, learner, slide]) {
          const frame = scope.locator("[data-image-frame]");
          const image = frame.locator("img").first();
          await expect.poll(() => image.evaluate(node => getComputedStyle(node).objectFit)).toBe(fit);
          const bounds = await frame.boundingBox(), imageBounds = await image.boundingBox();
          assert.ok(Math.abs(bounds.width - imageBounds.width) < 2 && Math.abs(bounds.height - imageBounds.height) < 2, "The image element must fill its frame for every fit mode");
        }
      }
      for (const [ratio, value] of [["4/3", 4 / 3], ["16/9", 16 / 9], ["1/1", 1], ["3/4", 3 / 4]]) {
        await page.getByLabel("Image frame ratio", { exact: true }).selectOption(ratio);
        for (const scope of [editor, learner, slide]) {
          const bounds = await scope.locator("[data-image-frame]").boundingBox();
          assert.ok(Math.abs(bounds.width / bounds.height - value) < .01, "Frame dimensions must follow the selected aspect ratio");
        }
      }
      await page.getByLabel("Image focal point", { exact: true }).selectOption("top");
      await expect.poll(() => learner.locator("[data-image-frame] img").first().evaluate(node => getComputedStyle(node).objectPosition)).toBe("50% 0%");
      await learner.getByRole("button", { name: "View image full screen: Landscape", exact: true }).focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Image preview: Landscape", exact: true });
      await expect(dialog).toBeVisible();
      assert.equal(await dialog.locator("img").evaluate(node => getComputedStyle(node).objectFit), "contain", "Fill mode must not stretch fullscreen previews");
      assert.equal(await dialog.locator("img").evaluate(node => getComputedStyle(node).objectPosition), "50% 50%", "Frame focal points must not change fullscreen previews");
      await dialog.getByRole("button", { name: "Close image preview", exact: true }).click();
    }
    const cropped = page.getByRole("region", { name: "Cropped slide", exact: true });
    for (const fit of ["cover", "contain", "fill"]) {
      await page.getByLabel("Image fit", { exact: true }).selectOption(fit);
      const frame = await cropped.locator("[data-image-frame]").boundingBox();
      const viewport = await cropped.locator("[data-slide-media-crop]").boundingBox();
      if (fit === "cover") assert.ok(viewport.width >= frame.width - 1 && viewport.height >= frame.height - 1, "Cropped Cover must fill the frame");
      else if (fit === "contain") assert.ok(viewport.width <= frame.width + 1 && viewport.height <= frame.height + 1, "Cropped Contain must keep the crop visible");
      else assert.ok(Math.abs(viewport.width - frame.width) < 1 && Math.abs(viewport.height - frame.height) < 1, "Cropped Fill must stretch to the frame");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Image layouts must fit mobile screens");
  }
  assert.deepEqual(errors, []);
  console.log("Image block browser checks passed: all seven layouts, slide images, crops, three fit modes, four frame ratios, focal points, fullscreen isolation, and desktop/mobile sizing.");
} finally {
  await browser?.close();
  await vite.close();
}
