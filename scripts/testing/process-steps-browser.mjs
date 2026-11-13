/** Real step editing, media selection, scaled canvases and standalone learners. Run build:export first. */
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const assetId = "a".repeat(24);
const fileId = "b".repeat(24), videoId = "c".repeat(24);
let video;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{processStepsBlockSchema}from'/lib/schemas/block.ts';
import{ContentBlockEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor.tsx';
import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{Dialog}from'/components/ui/dialog.tsx';import'/app/globals.css';
const initial=()=>processStepsBlockSchema.parse({id:'steps',type:'processSteps',version:1,slideFrame:{x:5,y:5,width:90,height:90,z:1},data:{style:'timeline',steps:[{id:'one',title:'Prepare',body:'Read these instructions.'},{id:'two',title:'Review',body:'Check the result.'}]}});
function App(){const[block,setBlock]=useState(initial),[mode,setMode]=useState('standard'),[open,setOpen]=useState(false),[theme,setTheme]=useState('#24734f');window.__steps=block;
const slide=()=> <div style={{width:768,height:432}}><div data-slide-objects style={{position:'relative',width:960,height:540,transform:'scale(.8)',transformOrigin:'top left'}}><SlideObject block={block} courseId="course" index={0} total={1} selected area={{width:960,height:540}} onSelect={()=>{}} onFrame={()=>{}} onChange={setBlock} onEditorFocus={()=>{}}/></div></div>;
return <main style={{padding:20,'--course-primary':theme}}><nav style={{display:'flex',gap:16,marginBottom:24}}><button onClick={()=>setMode('standard')}>Standard</button><button onClick={()=>setMode('slide')}>Slide</button><button onClick={()=>setOpen(true)}>Open popup</button><button onClick={()=>setTheme('#b45309')}>Change theme</button><button onClick={()=>setBlock(value=>({...value,data:{...value.data,style:"slider"}}))}>Step slider</button></nav>{mode==='standard'?<div style={{maxWidth:720,marginInline:'auto'}}><ContentBlockEditor block={block} courseId="course" onChange={setBlock}/></div>:slide()}{open&&<Dialog open title="Step popup" onClose={()=>setOpen(false)} className="max-w-4xl">{slide()}</Dialog>}</main>;}createRoot(document.getElementById('root')).render(<App/>);`;

const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-process-steps-browser", root: process.cwd(),
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/pm/view", "@tiptap/pm/history", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@tiptap/extension-mathematics", "@tiptap/extension-superscript", "@tiptap/extension-subscript"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } },
  plugins: [{ name: "process-steps-fixture", resolveId: (id) => id === "/__steps.tsx" ? id : null, load: (id) => id === "/__steps.tsx" ? fixture : null, configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url === "/api/courses/course/assets") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ assets: [
          { id: assetId, originalName: "Step guide.png", contentType: "image/png", size: png.length, fileUrl: `/api/assets/${assetId}/file`, createdAt: "2026-01-01T00:00:00Z" },
          { id: fileId, originalName: "Worksheet.txt", contentType: "text/plain", size: 10, fileUrl: `/api/assets/${fileId}/file`, createdAt: "2026-01-01T00:00:00Z" },
          { id: videoId, originalName: "Step demo.webm", contentType: "video/webm", size: video.length, fileUrl: `/api/assets/${videoId}/file`, createdAt: "2026-01-01T00:00:00Z" },
        ] }));
      } else if (request.url === `/api/assets/${assetId}/file`) {
        response.setHeader("Content-Type", "image/png"); response.end(png);
      } else if (request.url === `/api/assets/${fileId}/file`) {
        response.setHeader("Content-Type", "text/plain"); response.end("Worksheet");
      } else if (request.url === `/api/assets/${videoId}/file`) {
        response.setHeader("Content-Type", "video/webm"); response.end(video);
      } else if (request.url === "/__steps") {
        response.setHeader("Content-Type", "text/html");
        response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__steps.tsx"></script></body></html>');
      } else next();
    });
  } }],
});

let browser;
async function checkImageZoom(page, scope = page, { keyboard = false, escape = false } = {}) {
  const trigger = scope.getByRole("button", { name: "View image full screen: Step guide.png", exact: true });
  const src = await trigger.locator("img").getAttribute("src");
  if (keyboard) { await trigger.focus(); await trigger.press("Enter"); }
  else await trigger.click();
  const zoom = page.getByRole("dialog", { name: "Image preview: Step guide.png", exact: true });
  await expect(zoom).toBeVisible();
  await expect(zoom.locator("img")).toHaveAttribute("src", src);
  const bounds = await zoom.boundingBox(), viewport = page.viewportSize();
  assert.ok(Math.abs(bounds.width - viewport.width) < 2 && Math.abs(bounds.height - viewport.height) < 2, "Step image zoom must fill the viewport outside scaled canvases");
  if (escape) await page.keyboard.press("Escape");
  else await zoom.getByRole("button", { name: "Close image preview", exact: true }).click();
  await expect(zoom).toBeHidden();
  await expect(trigger).toBeFocused();
}
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__steps`);
  video = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 160;
    const context = canvas.getContext("2d"), stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }), chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const finished = new Promise(resolve => { recorder.onstop = resolve; });
    const draw = setInterval(() => { context.fillStyle = "#24734f"; context.fillRect(0, 0, 320, 160); }, 40);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 300)); recorder.stop(); await finished;
    clearInterval(draw); stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
  }));
  const field = (scope = page) => scope.locator('[contenteditable="true"][aria-label="Edit process step 1 instructions"]');
  await field().fill("Read the resource and continue.");
  await field().press("ControlOrMeta+a");
  await page.locator('[data-text-selection-popup]').getByRole("button", { name: "Bold", exact: true }).click();
  await expect(field().locator("strong")).toHaveText("Read the resource and continue.");
  await page.locator('[data-text-selection-popup]').getByRole("button", { name: "Add link to selected text", exact: true }).click();
  const link = page.getByRole("dialog", { name: "Link", exact: true });
  await link.getByLabel("Link URL", { exact: true }).fill("https://example.com/guide");
  await link.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(field().locator("a")).toHaveAttribute("href", "https://example.com/guide");
  await page.keyboard.press("Escape");
  await page.locator('[contenteditable="true"][aria-label="Edit process step 1 title"]').fill("");
  await page.getByLabel("Edit process next button label", { exact: true }).fill("Continue learning");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Add process step 1 media", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Media library", exact: true });
  await library.waitFor({ state: "visible" });
  await library.getByRole("button", { name: "Use Step guide.png", exact: true }).click();
  await expect(page.locator("[data-process-media-frame] > button img")).toHaveAttribute("src", `/api/assets/${assetId}/file`);
  await checkImageZoom(page);
  await checkImageZoom(page, page, { keyboard: true, escape: true });
  await page.getByRole("button", { name: "Add process step 1 file", exact: true }).click();
  await library.getByRole("button", { name: "Use Worksheet.txt", exact: true }).click();
  await expect(page.locator(`article a[href="/api/assets/${fileId}/file"]`)).toBeVisible();
  await page.getByRole("button", { name: "Remove process step 1 file", exact: true }).click();
  await expect(page.locator("[data-process-media-frame] > button img")).toBeVisible();
  await page.getByRole("button", { name: "Add process step 1 file", exact: true }).click();
  await library.getByRole("button", { name: "Use Worksheet.txt", exact: true }).click();
  await page.getByRole("button", { name: "Go to next process step", exact: true }).click();
  await expect(page.locator("article")).toContainText("Check the result.");
  await page.getByLabel("Process step 2 media type", { exact: true }).selectOption("video");
  await page.getByRole("button", { name: "Add process step 2 media", exact: true }).click();
  await expect(library.getByRole("button", { name: "Use Worksheet.txt", exact: true })).toHaveCount(0);
  await library.getByRole("button", { name: "Use Step demo.webm", exact: true }).click();
  await page.getByRole("button", { name: "Go to previous process step", exact: true }).click();
  await expect(field().locator("strong a, a strong")).toHaveText("Read the resource and continue.");
  await page.getByRole("button", { name: "Open content settings", exact: true }).click();
  const settings = page.locator("#content-settings-steps");
  await settings.getByLabel("Process media width", { exact: true }).fill("320");
  await settings.getByLabel("Process media width", { exact: true }).blur();
  await settings.getByLabel("Process media height", { exact: true }).fill("200");
  await settings.getByLabel("Process media height", { exact: true }).blur();
  await settings.getByLabel("Process media fit", { exact: true }).selectOption("cover");
  await settings.getByLabel("Process media focal point", { exact: true }).selectOption("top");
  await settings.getByRole("button", { name: "Replace process step 1 media", exact: true }).click();
  await library.getByRole("button", { name: "Use Step guide.png", exact: true }).click();
  await expect(settings).toBeVisible();
  await page.getByRole("button", { name: "Close content settings", exact: true }).click();
  const imageFrame = await page.locator("[data-process-media-frame]").boundingBox();
  assert.ok(Math.abs(imageFrame.width / imageFrame.height - 1.6) < .01);
  assert.equal(await page.locator("[data-process-media-frame] > button img").evaluate(node => getComputedStyle(node).objectFit), "cover");
  await page.getByRole("button", { name: "Go to next process step", exact: true }).click();
  await expect.poll(() => page.locator("article video").evaluate(node => node.videoWidth)).toBe(320);
  const videoFrame = await page.locator("[data-process-media-frame]").boundingBox();
  assert.ok(Math.abs(imageFrame.width - videoFrame.width) < 1 && Math.abs(imageFrame.height - videoFrame.height) < 1, "Images and videos must retain the same frame size across steps");
  await page.locator("article video").evaluate(async node => { node.loop = true; window.__stepVideo = node; await node.play(); });
  await page.getByRole("button", { name: "Go to previous process step", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__stepVideo.paused), true, "Leaving a step must pause its video");
  const color = () => page.locator("article > span").first().evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.equal(await color(), "rgb(36, 115, 79)");
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  assert.equal(await color(), "rgb(180, 83, 9)");
  assert.equal(await page.evaluate(() => window.__steps.data.accentColor), undefined);

  await page.getByRole("button", { name: "Slide", exact: true }).click();
  await checkImageZoom(page, page, { escape: true });
  await page.locator("[data-slide-objects]").evaluate(node => node.requestFullscreen());
  await checkImageZoom(page);
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole("button", { name: "Replace process step 1 media", exact: true }).click();
  await library.waitFor({ state: "visible" });
  assert.equal(await library.evaluate((node) => Boolean(node.closest("[data-slide-object-frame]"))), false);
  assert.ok((await library.boundingBox()).width > 800, "The media library should fit the viewport independently of canvas zoom");
  await library.getByRole("button", { name: "Use Step guide.png", exact: true }).click();
  await field().fill("Edited on the slide.");
  await page.getByRole("button", { name: "Open popup", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Step popup", exact: true });
  await checkImageZoom(page, popup, { escape: true });
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Replace process step 1 media", exact: true }).click();
  await library.waitFor({ state: "visible" });
  assert.equal(await library.evaluate((node) => Boolean(node.closest("dialog[open]"))), true);
  assert.equal(await library.evaluate((node) => Boolean(node.closest("[data-slide-object-frame]"))), false);
  await library.getByRole("button", { name: "Use Step guide.png", exact: true }).click();
  await field(popup).fill("Edited inside a popup.");
  await field(popup).press("ControlOrMeta+a");
  const toolbar = page.locator('[data-text-selection-popup]');
  await expect(toolbar).toBeVisible();
  assert.equal(await toolbar.evaluate((node) => node.parentElement === document.querySelector("dialog[open]")), true);
  await toolbar.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(field(popup).locator("em")).toHaveText("Edited inside a popup.");
  await page.keyboard.press("Escape");
  await popup.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Standard", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  const stepRegion = page.locator('[aria-label="Process steps"]');
  assert.ok(await stepRegion.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "Step content should fit a narrow viewport");
  await expect(page.getByLabel("Edit process next button label", { exact: true })).toBeVisible();
  await checkImageZoom(page, page, { keyboard: true });
  await page.getByRole("button", { name: "Step slider", exact: true }).click();
  await expect(stepRegion).toHaveAttribute("data-process-style", "slider");
  await expect(stepRegion.getByRole("progressbar", { name: "Process step progress" })).toBeVisible();
  await expect(stepRegion.getByRole("progressbar", { name: "Process step progress" })).toHaveAttribute("aria-valuenow", "50");
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const card = await stepRegion.locator("article").boundingBox();
    for (const direction of ["previous", "next"]) {
      const arrow = await stepRegion.getByRole("button", { name: `Go to ${direction} process step`, exact: true }).boundingBox();
      if (width <= 640) assert.ok(arrow.y >= card.y + card.height - 1, `Slider ${direction} arrow must be below the card on mobile`);
      else assert.ok(Math.abs(arrow.y + arrow.height / 2 - card.y - card.height / 2) < 2, `Slider ${direction} arrow must be centered against the card at ${width}px`);
      assert.ok(arrow.width >= 44 && arrow.height >= 44, "Slider arrows retain touch target sizes");
    }
    assert.ok(await stepRegion.evaluate(node => node.scrollWidth <= node.clientWidth + 1), "Slider card must fit narrow screens");
  }
  const badge = await stepRegion.locator("[data-process-slider-number]").evaluate(node => ({ fontSize: Number.parseFloat(getComputedStyle(node).fontSize), background: getComputedStyle(node).backgroundColor, theme: getComputedStyle(node).getPropertyValue("--course-primary").trim() }));
  assert.equal(badge.fontSize, 12, "Slider step badge retains its original label size");
  assert.notEqual(badge.background, "rgba(0, 0, 0, 0)");
  assert.equal(badge.theme, "#b45309");
  await expect(field().locator("em")).toHaveText("Edited inside a popup.");
  await checkImageZoom(page, page, { keyboard: true });
  await stepRegion.getByRole("button", { name: "Go to next process step", exact: true }).click();
  assert.equal(await stepRegion.locator("[data-process-slide-direction]").evaluate(node => getComputedStyle(node).animationName), "process-slider-from-right");
  await expect(stepRegion.locator("article video")).toBeVisible();
  await expect(stepRegion.getByRole("button", { name: "Go to next process step", exact: true })).toBeDisabled();
  await expect(stepRegion.getByRole("progressbar", { name: "Process step progress" })).toHaveAttribute("aria-valuenow", "100");
  await stepRegion.getByRole("button", { name: "Go to previous process step", exact: true }).click();
  assert.equal(await stepRegion.locator("[data-process-slide-direction]").evaluate(node => getComputedStyle(node).animationName), "process-slider-from-left");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stepRegion.getByRole("button", { name: "Go to next process step", exact: true }).click();
  assert.equal(await stepRegion.locator("[data-process-slide-direction]").evaluate(node => getComputedStyle(node).animationName), "none");
  await stepRegion.getByRole("button", { name: "Go to previous process step", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.deepEqual(errors, []);

  // Exercise the compiled learner from local files, including media, with no application APIs.
  const authored = await page.evaluate(() => window.__steps);
  const directory = resolve("public/course-export/assets"), names = readdirSync(directory);
  const js = readFileSync(resolve(directory, names.find((name) => name.endsWith(".js"))), "utf8");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(directory, names.find((name) => name.endsWith(".css"))), "utf8"), directory);
  mkdirSync("test-results", { recursive: true });
  const snapshot = editorSnapshotSchema.parse({ title: "Process", description: "", revision: 0, sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Steps", order: 0, blocks: [authored] }] });
  const serialize = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
  for (const courseLayout of ["standard", "slides"]) {
    const data = { ...structuredClone(snapshot), courseId: `steps-${courseLayout}`, courseLayout };
    data.lessons[0].blocks[0].data.steps[0].media.src = `coursecraft-media:${assetId}`;
    data.lessons[0].blocks[0].data.steps[0].attachment.src = `coursecraft-media:${fileId}`;
    data.lessons[0].blocks[0].data.steps[1].media.src = `coursecraft-media:${videoId}`;
    const file = resolve(`test-results/process-steps-${courseLayout}.html`);
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${serialize(data)};window.COURSE_EXPORT_MEDIA=${serialize({ [assetId]: `data:image/png;base64,${png.toString("base64")}`, [fileId]: "data:text/plain;base64,V29ya3NoZWV0", [videoId]: `data:video/webm;base64,${video.toString("base64")}` })}</script><script>${js}</script></body></html>`);
    const offline = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const requests = [], offlineErrors = [];
    offline.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    offline.on("pageerror", (error) => offlineErrors.push(error.message));
    await offline.goto(pathToFileURL(file).href);
    if (courseLayout === "standard") await offline.getByRole("button", { name: "Start learning", exact: true }).click();
    const active = (courseLayout === "slides" ? offline.locator('[data-slide-active="true"]') : offline).locator('[aria-label="Process steps"]');
    await expect(active.locator("article em")).toHaveText("Edited inside a popup.");
    assert.equal(await active.locator("article h3").count(), 0);
    await expect(active.locator("[data-process-media-frame] > button img")).toHaveAttribute("src", /^blob:/);
    await checkImageZoom(offline, active, { escape: true });
    await expect(active.locator("article a[download]")).toHaveAttribute("href", /^blob:/);
    const firstBounds = await active.locator("[data-process-media-frame]").boundingBox();
    assert.ok(Math.abs(firstBounds.width / firstBounds.height - 1.6) < .01);
    await active.getByRole("button", { name: "Continue learning", exact: true }).click();
    await expect(active.locator("article")).toContainText("Check the result.");
    await expect(active.locator("article video")).toHaveAttribute("src", /^blob:/);
    const secondBounds = await active.locator("[data-process-media-frame]").boundingBox();
    assert.ok(Math.abs(firstBounds.width - secondBounds.width) < 1 && Math.abs(firstBounds.height - secondBounds.height) < 1, `${courseLayout} media frames must match: ${JSON.stringify({ firstBounds, secondBounds })}`);
    assert.deepEqual(requests, []); assert.deepEqual(offlineErrors, []);
    await offline.close();
  }
  console.log("Process step browser checks passed: editing, media/files, image zoom with keyboard/Escape/focus restoration, scaled/fullscreen slides, nested popups, narrow viewport, and compiled Standard/Presentation exports without network requests.");
} finally { await browser?.close(); await vite.close(); }
