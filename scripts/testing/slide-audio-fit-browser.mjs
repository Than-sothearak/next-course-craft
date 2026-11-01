/** Verify native audio dimensions and saved object geometry in the real editor renderer. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SlideObject}from'/app/courses/[courseId]/edit/_components/slide-presentation/slide-editable-object.tsx';
import{SlidePlaybackControls}from'/app/courses/[courseId]/edit/_components/slide-presentation/slide-playback-controls.tsx';
import{SlideAudioSizeControls}from'/app/courses/[courseId]/edit/_components/slide-presentation/slide-audio-size-controls.tsx';
import{blockTemplates}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import{createSlideBlocksFromTemplate}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';
import{defaultSlideMaster}from'/lib/editor/slide-design.ts';import'/app/globals.css';
function App(){const[zoom,setZoom]=useState(1),[revision,reload]=useState(0),[block,setBlock]=useState(()=>({...createSlideBlocksFromTemplate(blockTemplates.find(t=>t.id==='media-audio'),'audio')[0],data:{src:'',fileName:'Narration.mp3'},slideFrame:{x:10,y:20,width:24,height:70,z:0}}));window.__block=block;
return React.createElement('main',{style:{padding:24}},React.createElement('nav',null,...[.5,1,1.5].map(z=>React.createElement('button',{key:z,onClick:()=>setZoom(z)},String(z))),React.createElement('button',{onClick:()=>{setBlock(JSON.parse(JSON.stringify(block)));reload(r=>r+1);}},'Reload'),React.createElement(SlideAudioSizeControls,{block,index:0,total:1,area:{width:960,height:540},onChange:setBlock}),React.createElement(SlidePlaybackControls,{block,onChange:setBlock})),
React.createElement('div',{style:{marginTop:24,position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left',background:'#f8fafc'},'data-slide-objects':true},React.createElement(SlideObject,{key:revision,block,index:0,total:1,selected:true,area:{width:960,height:540},master:defaultSlideMaster,onSelect:()=>{},onFrame:slideFrame=>setBlock(b=>({...b,slideFrame})),onChange:setBlock,onEditorFocus:()=>{},onFooterSnap:()=>{}})));}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-slide-audio-browser", root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "slide-audio-fixture", resolveId: (id) => id === "/__slide-audio.js" ? id : null, load: (id) => id === "/__slide-audio.js" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__slide-audio") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__slide-audio.js"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__slide-audio`);
  await page.waitForFunction(() => window.__block?.slideFrame.height < 20);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[data-slide-audio-title]').count(), 0);
  assert.equal(await page.getByRole('checkbox', { name: 'Show audio file name' }).isChecked(), false);
  const initial = await page.evaluate(() => window.__block);
  mkdirSync('test-results', { recursive: true });
  assert.equal(initial.blockPadding, 0); assert.equal(initial.slideFrame.width, 24); assert.equal(initial.slidePlayback.audioSize, "small");
  for (const [label, width, height] of [['Medium', 32, 54], ['Large', 48, 68], ['Small', 24, 32]]) {
    await page.getByRole('button', { name: label + ' audio size', exact: true }).click();
    await page.waitForFunction((width) => window.__block.slideFrame.width === width, width);
    assert.equal(await page.getByRole('button', { name: label + ' audio size', exact: true }).getAttribute('aria-pressed'), 'true');
    const geometry = await page.locator('[data-slide-object-frame]').evaluate((element) => ({ object: element.getBoundingClientRect().toJSON(), audio: element.querySelector('audio').getBoundingClientRect().toJSON() }));
    assert.ok(Math.abs(geometry.object.width - 960 * width / 100) < 1);
    assert.ok(Math.abs(geometry.object.height - geometry.audio.height - 4) < 1);
    assert.equal(geometry.audio.height, height, label + ' must change the actual player height');
    assert.ok(Math.abs((await page.evaluate(() => window.__block.slideFrame.height)) * 540 / 100 - height - 4) < 1);
    if (label === 'Small') await page.screenshot({ path: 'test-results/slide-audio-small.png' });
  }
  for (const zoom of [.5, 1.5, 1]) {
    await page.getByRole('button', { name: String(zoom), exact: true }).click();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const geometry = await page.locator('[data-slide-object-frame]').evaluate((element) => ({ object: element.getBoundingClientRect().toJSON(), audio: element.querySelector('audio').getBoundingClientRect().toJSON(), scale: element.querySelector('[data-slide-object-content]').dataset.contentScale }));
    assert.ok(Math.abs(geometry.object.height / zoom - geometry.audio.height / zoom - 4) < 1, JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.object.width / zoom - geometry.audio.width / zoom - 4) < 1, JSON.stringify(geometry));
    assert.equal(geometry.scale, '1');
    assert.ok(Math.abs((await page.evaluate(() => window.__block.slideFrame.height)) - initial.slideFrame.height) < .01);
  }
  await page.getByRole('checkbox', { name: 'Show audio file name' }).check();
  await page.waitForFunction((height) => window.__block.slideFrame.height > height + 3, initial.slideFrame.height);
  await page.getByRole('checkbox', { name: 'Show audio file name' }).uncheck();
  await page.waitForFunction((height) => Math.abs(window.__block.slideFrame.height - height) < .01, initial.slideFrame.height);
  await page.getByRole('checkbox', { name: 'Show media player controls' }).uncheck();
  await page.waitForFunction((height) => window.__block.slideFrame.height < height - .2, initial.slideFrame.height);
  assert.equal(await page.getByRole('button', { name: 'Play audio', exact: true }).count(), 1);
  await page.getByRole('checkbox', { name: 'Show media player controls' }).check();
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await page.waitForFunction((height) => Math.abs(window.__block.slideFrame.height - height) < .01, initial.slideFrame.height);
  mkdirSync('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/slide-audio-fit.png' });
  assert.deepEqual(errors, []); console.log('Slide audio browser checks passed: Small/Medium/Large presets, hidden title, native player fit, no padding, preserved width, title/control resizing, saved reload, and stable frames at 50%, 100%, and 150% zoom.');
} finally { await browser?.close(); await vite.close(); }
