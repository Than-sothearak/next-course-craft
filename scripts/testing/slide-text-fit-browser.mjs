/** Actual font/layout measurements for slide text insertion at different editor zooms. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SlideObject}from'/app/courses/[courseId]/edit/_components/slide-presentation/slide-editable-object.tsx';
import{blockTemplates}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import{createSlideBlocksFromTemplate}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';
import{defaultSlideMaster}from'/lib/editor/slide-design.ts';import'/app/globals.css';
function App(){const[zoom,setZoom]=useState(1),[block,setBlock]=useState(null);
window.__block=block;window.__setText=(html)=>{document.querySelector('[contenteditable=true]').editor.commands.setContent(html);};
const add=id=>setBlock({...createSlideBlocksFromTemplate(blockTemplates.find(t=>t.id===id),id)[0],slideFrame:{x:10,y:10,width:78,height:55,z:0}});
return React.createElement('main',{style:{padding:24}},React.createElement('nav',null,React.createElement('button',{onClick:()=>add('text-subheading')},'Heading'),React.createElement('button',{onClick:()=>add('text-paragraph')},'Text'),...[.5,1,1.5].map(z=>React.createElement('button',{key:z,onClick:()=>setZoom(z)},String(z)))),
React.createElement('div',{style:{marginTop:24,position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left',fontFamily:'Arial',background:'#f8fafc'},'data-slide-objects':true},block&&React.createElement(SlideObject,{key:block.id,block,index:0,total:1,selected:true,area:{width:960,height:540},master:defaultSlideMaster,onSelect:()=>{},onFrame:slideFrame=>setBlock(b=>({...b,slideFrame})),onChange:setBlock,onEditorFocus:()=>{},onFooterSnap:()=>{}})));}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
const vite = await createServer({ configFile: false, root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "slide-text-fixture", resolveId: (id) => id === "/__slide-text.js" ? id : null, load: (id) => id === "/__slide-text.js" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__slide-text") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__slide-text.js"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  page.on("console", (message) => { if (message.type() === "error") console.error(message.text()); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__slide-text`);
  mkdirSync("test-results", { recursive: true });
  for (const label of ["Heading", "Text"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForFunction(() => window.__block && window.__block.slideFrame.width < 70);
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => window.__block);
    assert.equal(initial.blockPadding, 0); assert.equal(initial.slideBorderRadius, 0);
    if (label === "Heading") { assert.equal(await page.locator('[data-slide-text-box] h1').count(), 1); assert.equal(await page.locator('[data-slide-text-box] p').count(), 0); }
    for (const zoom of [.5, 1.5, 1]) {
      await page.getByRole("button", { name: String(zoom), exact: true }).click();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const current = await page.evaluate(() => window.__block.slideFrame);
      assert.ok(Math.abs(current.width - initial.slideFrame.width) < .05, `Text width changed with zoom ${zoom}`);
      assert.ok(Math.abs(current.height - initial.slideFrame.height) < .05, `Text height changed with zoom ${zoom}`);
    }
    const geometry = await page.locator('[data-slide-object-frame]').evaluate((element) => { const paragraph = element.querySelector('.tiptap > *'); const range = document.createRange(); range.selectNodeContents(paragraph); return { object: element.getBoundingClientRect().width, text: range.getBoundingClientRect().width, padding: getComputedStyle(element.querySelector('[data-slide-text-box]')).padding, radius: getComputedStyle(element).borderRadius }; });
    assert.equal(geometry.padding, "0px"); assert.equal(geometry.radius, "0px");
    assert.ok(geometry.object >= geometry.text && geometry.object - geometry.text < 12, `Frame does not fit ${label}: ${JSON.stringify(geometry)}`);
    await page.evaluate((label) => window.__setText(label === "Heading" ? '<h1><span style="font-size:48px">A longer heading</span></h1>' : '<p>A longer sentence that fits its text object.</p>'), label);
    await page.waitForFunction((width) => window.__block.slideFrame.width > width + 3, initial.slideFrame.width);
    await page.screenshot({ path: `test-results/slide-${label.toLowerCase()}-fit.png` });
  }
  assert.deepEqual(errors, []); console.log("Slide text browser checks passed: heading-only insertion, zero padding/radius, measured content width, growth after typing, and stable saved frames at 50%, 100%, and 150% zoom.");
} finally { await browser?.close(); await vite.close(); }
