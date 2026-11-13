/** Timeline editing, responsive layouts, popup isolation and compiled offline learners. Build export first. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{timelineBlockSchema}from'/lib/schemas/block.ts';import{timelineSample}from'/lib/editor/timeline.ts';
import{TimelineBlockEditor,TimelineBlockSettings}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/timeline-block-editor.tsx';
import{TimelineBlock}from'/components/timeline-block.tsx';import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{Dialog}from'/components/ui/dialog.tsx';import'/app/globals.css';
function App(){const[block,setBlock]=useState(()=>timelineBlockSchema.parse({id:'timeline',version:1,type:'timeline',slideFrame:{x:5,y:5,width:90,height:90,z:1},data:{items:timelineSample}})),[mode,setMode]=useState('standard'),[popup,setPopup]=useState(false),[theme,setTheme]=useState('#24734f');window.__timeline=block;
const slide=()=> <div style={{width:768,height:432}}><div style={{position:'relative',width:960,height:540,transform:'scale(.8)',transformOrigin:'top left'}}><SlideObject block={block} courseId="course" index={0} total={1} selected onSelect={()=>{}} onFrame={()=>{}} onChange={setBlock} onEditorFocus={()=>{}}/></div></div>;
return <main style={{padding:16,'--course-primary':theme}}><nav style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:24}}><button onClick={()=>setMode('standard')}>Standard</button><button onClick={()=>setMode('slide')}>Slide</button><button onClick={()=>setMode('learner')}>Learner</button><button onClick={()=>setPopup(true)}>Open popup</button><button onClick={()=>setTheme('#b45309')}>Change theme</button></nav>{mode==='standard'?<><TimelineBlockEditor block={block} onChange={setBlock}/><aside style={{maxWidth:360,marginTop:32}}><TimelineBlockSettings block={block} onChange={setBlock}/></aside></>:mode==='slide'?slide():<div className="timeline-block-surface" style={{paddingTop:40,paddingBottom:40}}><div className="timeline-block-content px-4"><TimelineBlock data={block.data}/></div></div>}<Dialog open={popup} title="Timeline popup" onClose={()=>setPopup(false)} className="max-w-4xl">{popup&&slide()}</Dialog></main>};createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-timeline-browser", root: process.cwd(),
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/pm/view", "@tiptap/pm/history", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@tiptap/extension-mathematics", "@tiptap/extension-superscript", "@tiptap/extension-subscript"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } },
  plugins: [{ name: "timeline-fixture", resolveId: (id) => id === "/__timeline.tsx" ? id : null, load: (id) => id === "/__timeline.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      if (request.url !== "/__timeline") return next();
      response.setHeader("Content-Type", "text/html");
      response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__timeline.tsx"></script></body></html>');
    }); },
  }],
});
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__timeline`);
  const text = (scope = page) => scope.locator('[contenteditable="true"][aria-label="Edit timeline event 1 text"]');
  await page.locator('[contenteditable="true"][aria-label="Edit timeline event 1 label"]').fill("2026");
  await text().fill("A defining moment in the timeline.");
  await text().press("ControlOrMeta+a");
  await page.locator('[data-text-selection-popup]').getByRole("button", { name: "Bold", exact: true }).click();
  await expect(text().locator("strong")).toHaveText("A defining moment in the timeline.");
  await page.keyboard.press("Escape");
  for (const style of ["vertical", "horizontal", "stacked"]) {
    await page.getByLabel("Timeline layout", { exact: true }).selectOption(style);
    await expect(page.locator("[data-timeline-style]")).toHaveAttribute("data-timeline-style", style);
    await expect(text().locator("strong")).toHaveText("A defining moment in the timeline.");
    const cards = await page.locator(".timeline-card").evaluateAll(nodes => nodes.map(node => { const { x, y, width } = node.getBoundingClientRect(); return { x, y, width }; }));
    if (style === "vertical") assert.ok(cards[1].x > cards[0].x + cards[0].width, "Vertical cards alternate around the center line");
    if (style === "horizontal") assert.ok(Math.abs(cards[1].y - cards[0].y) < 2 && cards[1].x > cards[0].x, "Horizontal cards share a row");
    if (style === "stacked") assert.ok(Math.abs(cards[1].x - cards[0].x) < 2 && cards[1].y > cards[0].y, "Stacked cards share a center line");
    await page.setViewportSize({ width: 360, height: 900 });
    await expect(page.locator(".timeline-card").first()).toHaveCSS("padding", "16px");
    if (style === "stacked") {
      const { cardWidth, listWidth } = await page.locator("[data-timeline-style='stacked']").evaluate(node => ({
        cardWidth: node.querySelector(".timeline-card").getBoundingClientRect().width,
        listWidth: node.querySelector(".timeline-list").getBoundingClientRect().width,
      }));
      assert.ok(Math.abs(cardWidth - listWidth) < 1, `Mobile stacked cards fill the timeline width without horizontal inset (${cardWidth}px vs ${listWidth}px)`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Mobile ${style} should not overflow the page`);
    if (style === "horizontal") assert.ok(await page.locator(".timeline-list").evaluate(node => node.scrollWidth > node.clientWidth), "Horizontal timeline scrolls inside its container");
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator(".timeline-card").first()).toHaveCSS("padding", "16px");
  }
  await page.getByRole("button", { name: "Learner", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.locator(".timeline-block-surface")).toHaveCSS("padding-top", "0px");
  await expect(page.locator(".timeline-block-surface")).toHaveCSS("padding-bottom", "0px");
  await expect(page.locator(".timeline-block-content")).toHaveCSS("padding-left", "0px");
  await expect(page.locator(".timeline-block-content")).toHaveCSS("padding-right", "0px");
  await expect(page.locator(".timeline-card").first()).toHaveCSS("padding", "16px");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.locator(".timeline-block-surface")).toHaveCSS("padding-top", "40px");
  await expect(page.locator(".timeline-block-content")).toHaveCSS("padding-left", "16px");
  await page.getByRole("button", { name: "Standard", exact: true }).click();
  await page.getByLabel("Timeline layout", { exact: true }).selectOption("vertical");
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  assert.equal(await page.locator(".timeline-marker > span").first().evaluate(node => getComputedStyle(node).backgroundColor), "rgb(180, 83, 9)");
  await page.getByRole("button", { name: "Move timeline event 1 down", exact: true }).click();
  await expect(page.locator('[contenteditable="true"][aria-label="Edit timeline event 2 text"] strong')).toHaveText("A defining moment in the timeline.");
  await page.getByRole("button", { name: "Move timeline event 2 up", exact: true }).click();
  await page.getByRole("button", { name: "Slide", exact: true }).click();
  await text().fill("Edited on a scaled slide.");
  await page.getByRole("button", { name: "Open popup", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Timeline popup", exact: true });
  await text(popup).fill("Edited inside a popup.");
  await text(popup).press("ControlOrMeta+a");
  const toolbar = page.locator('[data-text-selection-popup]');
  await expect(toolbar).toBeVisible();
  assert.equal(await toolbar.evaluate(node => node.parentElement === document.querySelector("dialog[open]")), true);
  await toolbar.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(text(popup).locator("em")).toHaveText("Edited inside a popup.");
  await page.keyboard.press("Escape");
  await popup.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Learner", exact: true }).click();
  await expect(page.locator(".timeline-card em").first()).toHaveText("Edited inside a popup.");
  assert.deepEqual(errors, []);

  const authored = await page.evaluate(() => window.__timeline);
  const directory = resolve("public/course-export/assets"), names = readdirSync(directory);
  const js = readFileSync(resolve(directory, names.find(name => name.endsWith(".js"))), "utf8");
  const { inlineLocalFontAssets } = await vite.ssrLoadModule("/lib/export/inline-font-assets.ts");
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  const css = await inlineLocalFontAssets(readFileSync(resolve(directory, names.find(name => name.endsWith(".css"))), "utf8"), directory);
  const snapshot = editorSnapshotSchema.parse({ title: "Timeline", description: "", revision: 0, sections: [{ id: "s", title: "History", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Timeline", order: 0, blocks: [authored] }] });
  mkdirSync("test-results", { recursive: true });
  const serialize = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
  for (const courseLayout of ["standard", "slides"]) for (const style of ["vertical", "horizontal", "stacked"]) {
    const data = { ...structuredClone(snapshot), courseId: `timeline-${courseLayout}-${style}`, courseLayout };
    data.lessons[0].blocks[0].data.style = style;
    const file = resolve(`test-results/timeline-${courseLayout}-${style}.html`);
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${serialize(data)}</script><script>${js}</script></body></html>`);
    const offline = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const requests = [], offlineErrors = [];
    offline.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    offline.on("pageerror", error => offlineErrors.push(error.message));
    await offline.goto(pathToFileURL(file).href);
    if (courseLayout === "standard") await offline.getByRole("button", { name: "Start learning", exact: true }).click();
    const active = courseLayout === "slides" ? offline.locator('[data-slide-active="true"]') : offline;
    const timeline = active.locator(`[data-timeline-style="${style}"]:visible`);
    await expect(timeline).toBeVisible();
    await expect(timeline.locator(".timeline-card em").first()).toHaveText("Edited inside a popup.");
    assert.equal(await timeline.locator("[data-timeline-item]").count(), 3);
    if (courseLayout === "standard") {
      await offline.setViewportSize({ width: 360, height: 900 });
      await expect(timeline.locator(".timeline-card h3").first()).toHaveCSS("font-size", "18px");
      await expect(timeline.locator(".timeline-card em").first()).toHaveCSS("font-size", "14px");
      await expect(timeline.locator(".timeline-card").first()).toHaveCSS("padding", "16px");
      await offline.setViewportSize({ width: 1100, height: 900 });
      await expect(timeline.locator(".timeline-card h3").first()).toHaveCSS("font-size", "20px");
      await expect(timeline.locator(".timeline-card").first()).toHaveCSS("padding", "16px");
    }
    assert.deepEqual(requests, []); assert.deepEqual(offlineErrors, []);
    await offline.close();
  }
  console.log("Timeline browser checks passed: three layouts, formatting, ordering, theme inheritance, mobile overflow, scaled slides, popup toolbar isolation and six compiled offline learners without network requests.");
} finally { await browser?.close(); await vite.close(); }
