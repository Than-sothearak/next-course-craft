/** Verify real text selection and formatting popup placement in authoring. */
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{accordionBlockSchema}from'/lib/schemas/block.ts';
import{AccordionBlockEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/accordion-block-editor.tsx';
import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{Dialog}from'/components/ui/dialog.tsx';import'/app/globals.css';
const initial=()=>accordionBlockSchema.parse({id:'accordion',type:'accordion',version:1,slideFrame:{x:10,y:10,width:80,height:60,z:1},data:{items:[{id:'one',title:'Select this accordion title',body:'Select this explanation to format it.'},{id:'two',title:'Second section',body:'Another explanation.'}]}});
function App(){const[block,setBlock]=useState(initial),[mode,setMode]=useState('standard'),[zoom,setZoom]=useState(.5),[open,setOpen]=useState(false),stage=useRef(null);window.__block=block;
const object=(value,change)=><SlideObject block={value} index={0} total={1} selected area={{width:960,height:540}} onSelect={()=>{}} onFrame={()=>{}} onChange={change} onEditorFocus={()=>{}}/>;
return <main style={{padding:20,fontFamily:'Arial','--course-primary':'#24734f','--course-accent':'#f2a65a'}}><nav style={{display:'flex',gap:8,marginBottom:24}}><button onClick={()=>setMode('standard')}>Standard</button><button onClick={()=>setMode('slides')}>Slides</button>{[.5,1,1.5].map(z=><button key={z} onClick={()=>setZoom(z)}>{z*100}%</button>)}<button onClick={()=>setOpen(true)}>Open popup</button><button onClick={()=>stage.current?.requestFullscreen()}>Fullscreen</button></nav>
{mode==='standard'?<div data-standard style={{width:'min(680px,calc(100vw - 40px))'}}><AccordionBlockEditor block={block} onChange={setBlock}/></div>:<div ref={stage} data-stage style={{width:960*zoom,height:540*zoom,overflow:'hidden',background:'#f8fafc'}}><div data-slide-objects style={{position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left'}}>{object(block,setBlock)}</div></div>}
{open&&<Dialog open title="Popup canvas" onClose={()=>setOpen(false)} className="max-w-4xl"><div style={{width:720,height:405,overflow:'hidden',background:'#f8fafc'}}><div data-slide-objects style={{position:'relative',width:960,height:540,transform:'scale(.75)',transformOrigin:'top left'}}>{object({...block,id:'popup-accordion'},next=>setBlock({...next,id:'accordion'}))}</div></div></Dialog>}</main>;}createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-accordion-editing-browser", root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "accordion-editing-fixture", resolveId: (id) => id === "/__accordion-editing.tsx" ? id : null, load: (id) => id === "/__accordion-editing.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__accordion-editing") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__accordion-editing.tsx"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__accordion-editing`);
  const popup = () => page.locator("[data-text-selection-popup]");
  const field = (scope = page) => scope.locator('[contenteditable="true"][aria-label="Edit accordion section 1 explanation"]');
  async function formatSelectedText(scope = page) {
    const selectedText = await scope.locator('[contenteditable="true"][aria-label="Edit accordion section 1 explanation"]').evaluate((node) => {
      const { from, to } = node.editor.state.selection;
      return node.editor.state.doc.textBetween(from, to);
    });
    const family = popup().getByLabel("Font family", { exact: true });
    await family.click();
    await page.keyboard.press("Enter");
    await family.selectOption("battambang");
    assert.equal(await field(scope).locator('[data-font-family="battambang"]').textContent(), selectedText);
    const size = popup().getByLabel("Custom font size in pixels", { exact: true });
    await size.click();
    await size.fill("");
    await size.pressSequentially("32");
    assert.equal(await size.evaluate((node) => node === document.activeElement), true);
    assert.equal(await field(scope).locator('span[style*="32px"]').textContent(), selectedText);
    await family.click();
    await page.keyboard.press("Enter");
    await family.selectOption("");
    assert.equal(await field(scope).locator('[data-font-family]').count(), 0);
    await popup().waitFor({ state: "visible" });
    await popup().getByLabel("Text color", { exact: true }).click();
    const colorPanel = page.getByRole("dialog", { name: "Text color", exact: true });
    await colorPanel.waitFor({ state: "visible" });
    assert.equal(await colorPanel.evaluate(node => Boolean(node.closest("[data-text-selection-popup]"))), false);
    const colorBounds = await colorPanel.boundingBox(), textBounds = await popup().boundingBox();
    assert.ok(colorBounds.x + colorBounds.width <= textBounds.x || colorBounds.x >= textBounds.x + textBounds.width, "Color picker should sit beside the formatting popup on desktop");
    await colorPanel.getByRole("button", { name: "Color wheel", exact: true }).click();
    const hex = colorPanel.getByLabel("Text color hex code", { exact: true });
    await hex.fill("#123456");
    assert.equal(await hex.evaluate(node => node === document.activeElement), true);
    await colorPanel.getByRole("button", { name: "Close text color", exact: true }).click();
    await colorPanel.waitFor({ state: "hidden" });
    await popup().waitFor({ state: "visible" });
    await popup().getByLabel("Text color", { exact: true }).click();
    await colorPanel.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await colorPanel.waitFor({ state: "hidden" });
    await popup().waitFor({ state: "visible" });
    await popup().getByLabel("Text color", { exact: true }).click();
    await colorPanel.getByRole("button", { name: "Presets", exact: true }).click();
    const primary = colorPanel.getByRole("button", { name: "Text color theme primary", exact: true });
    await expect(primary).toHaveAttribute("title", "Theme primary: #24734f");
    await primary.click();
    assert.equal(await field(scope).locator('span[style*="color: rgb(36, 115, 79)"]').textContent(), selectedText);
    await popup().getByLabel("Text color", { exact: true }).click();
    await colorPanel.getByRole("button", { name: "Theme default", exact: true }).click();
    assert.equal(await field(scope).locator('span[style*="color:"]').count(), 0);
  }
  async function selectText(element) {
    await element.click();
    const rect = await element.evaluate((node) => {
      const text = document.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode();
      const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, Math.min(6, text.textContent.length));
      return range.getBoundingClientRect().toJSON();
    });
    await page.mouse.move(rect.x + 1, rect.y + rect.height / 2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width - 1, rect.y + rect.height / 2, { steps: 6 });
    assert.equal(await popup().count(), 0, "The popup must wait for selection to finish");
    await page.mouse.up();
    await popup().waitFor({ state: "visible" });
    const bounds = await popup().boundingBox(), viewport = page.viewportSize();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, JSON.stringify(bounds));
  }
  await field().waitFor(); await field().click(); assert.equal(await popup().count(), 0);
  await selectText(field());
  await popup().getByRole("button", { name: "Bold", exact: true }).click();
  assert.ok(await field().locator("strong").count());
  await popup().getByLabel("Font size preset", { exact: true }).focus();
  await popup().getByLabel("Font size preset", { exact: true }).selectOption("24px");
  await popup().waitFor({ state: "visible" });
  assert.ok(await field().locator('span[style*="24px"]').count());
  await formatSelectedText();
  await page.keyboard.press("Escape"); assert.equal(await popup().count(), 0);
  await page.getByRole("button", { name: "Slides", exact: true }).click();
  for (const zoom of ["50%", "100%", "150%"]) {
    await page.getByRole("button", { name: zoom, exact: true }).click();
    await selectText(field());
    assert.equal(await popup().evaluate((node) => node.parentElement === document.body), true);
    await formatSelectedText();
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Open popup", exact: true }).click();
  const dialog = page.locator("dialog[open]");
  await selectText(field(dialog));
  assert.equal(await popup().evaluate((node) => node.parentElement.tagName), "DIALOG");
  await popup().getByRole("button", { name: "Italic", exact: true }).click();
  assert.ok(await field(dialog).locator("em").count());
  await formatSelectedText(dialog);
  mkdirSync("test-results", { recursive: true }); await page.screenshot({ path: "test-results/accordion-selection-popup.png" });
  await page.keyboard.press("Escape"); assert.equal(await popup().count(), 0); assert.equal(await dialog.count(), 1);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "50%", exact: true }).click();
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await selectText(field());
  assert.equal(await popup().evaluate((node) => node.parentElement === document.fullscreenElement), true);
  await formatSelectedText();
  await page.keyboard.press("Escape");
  if (await page.evaluate(() => Boolean(document.fullscreenElement))) await page.evaluate(() => document.exitFullscreen());
  await page.getByRole("button", { name: "Standard", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 700 });
  await selectText(field());
  await popup().getByLabel("Text color", { exact: true }).click();
  const narrowColors = page.getByRole("dialog", { name: "Text color", exact: true });
  await narrowColors.waitFor({ state: "visible" });
  const narrowBounds = await narrowColors.boundingBox();
  assert.ok(narrowBounds.x >= 0 && narrowBounds.x + narrowBounds.width <= 360 && narrowBounds.y >= 0 && narrowBounds.y + narrowBounds.height <= 700);
  await page.keyboard.press("Escape");
  await narrowColors.waitFor({ state: "hidden" });
  await popup().waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log("Accordion formatting browser checks passed: real text selection, preserved Bold/font-size/Italic actions, popup bounds at 50/100/150% zoom, modal and fullscreen portals, Escape dismissal and narrow viewport placement.");
} finally { await browser?.close(); await vite.close(); }
