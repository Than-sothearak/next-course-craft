/** Isolated real-browser physics and compiled HTML/SCORM checks. No application database. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fixture = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{PeelToReveal}from'/components/physics-interaction/peel-to-reveal.tsx';import{peelSettingsSchema}from'/lib/schemas/peel-to-reveal.ts';
import{SlidePlaybackContext}from'/app/courses/[courseId]/_components/slide-presentation/slide-playback-context.tsx';import'/app/globals.css';
window.__reveals=[];
function App(){
 const[presentation,setPresentation]=useState(false),[authoring,setAuthoring]=useState(false),[direction,setDirection]=useState('top-right');
 const content=React.createElement('div',{style:{padding:24}},
   React.createElement('p',{style:{textTransform:'uppercase',fontSize:12,color:'#4338ca'}},'A moment of discovery'),
   React.createElement('h2',{style:{fontSize:36,fontWeight:600,margin:'16px 0'}},'Curiosity changes everything.'),
   React.createElement('p',null,'Explore an idea. Ask a better question. Make a connection.'),
   React.createElement('div',{style:{height:100,marginTop:24,borderRadius:16,background:'linear-gradient(135deg,#e0e7ff,#fce7f3)'}}));
 const interaction=React.createElement(PeelToReveal,{blockId:'browser-paper',settings:peelSettingsSchema.parse({direction}),presentation,authoring,onProgress:id=>window.__reveals.push(id)},content);
 const nav=React.createElement('nav',{style:{display:'flex',gap:16,marginBottom:24}},
   React.createElement('button',{onClick:()=>setPresentation(!presentation)},'Switch layout'),
   React.createElement('button',{onClick:()=>setAuthoring(!authoring)},'Switch authoring'),
   React.createElement('button',{onClick:()=>setDirection(direction==='top-right'?'bottom-left':'top-right')},'Switch corner'));
 return React.createElement('main',{style:{padding:24,maxWidth:900,margin:'auto'}},nav,
   React.createElement(SlidePlaybackContext.Provider,{value:true},
     React.createElement('div',{style:presentation?{width:680,height:440,transform:'scale(.7)',transformOrigin:'top left'}:{}},interaction)));
}createRoot(document.getElementById('root')).render(React.createElement(App));`;
let exportData;
const vite = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge"] }, server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "peel-browser-test", resolveId: (id) => id === "/__peel-harness.js" ? id : null, load: (id) => id === "/__peel-harness.js" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => {
  if (request.url === "/__peel") { response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__peel-harness.js"></script></body></html>'); }
  else if (request.url?.startsWith("/__peel-export")) {
    const kind = request.url.includes("2004") ? "2004" : request.url.includes("plain") ? "plain" : "12";
    const data = { ...exportData, courseId: `peel-export-${kind}`, courseLayout: request.url.includes("standard") ? "standard" : "slides", scorm12Enabled: kind === "12", scorm2004Enabled: kind === "2004" };
    const lms = `const values=JSON.parse(sessionStorage.getItem('peel-lms-${kind}')||'{}');window.__lmsValues=values;const get=k=>values[k]||'',set=(k,v)=>{values[k]=v;sessionStorage.setItem('peel-lms-${kind}',JSON.stringify(values));return'true';};window.API={LMSInitialize:()=> 'true',LMSFinish:()=> 'true',LMSCommit:()=> 'true',LMSGetValue:get,LMSSetValue:set};window.API_1484_11={Initialize:()=> 'true',Terminate:()=> 'true',Commit:()=> 'true',GetValue:get,SetValue:set};`;
    response.setHeader("Content-Type", "text/html"); response.end(readFileSync("public/course-export/index.html", "utf8").replaceAll("./assets/", "/course-export/assets/").replace("<body>", `<body><script>${lms}window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll("<", "\\u003c")};</script>`));
  } else next();
}); } }] });
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  exportData = { courseId: "peel-export", ...editorSnapshotSchema.parse({ title: "Discovery course", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Discoveries", order: 0 }], lessons: [{ id: "lesson", title: "A discovery", sectionId: "section", order: 0, blocks: [{ id: "paper", type: "peelToReveal", version: 1, slideAnimation: { effect: "none", duration: 1000, delay: 0 }, slideFrame: { x: 10, y: 23, width: 80, height: 60, z: 0 }, data: { blocks: [{ id: "text", type: "richText", version: 1, blockPadding: 12, data: { html: '<h2>Curiosity changes everything.</h2><p>A <strong>learning moment</strong> that survives export.</p>' } }] } }] }] }) };
  await vite.listen(); const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/__peel`); const paper = page.locator("[data-peel-to-reveal]"), card = page.locator("[data-peel-card]"); await paper.waitFor();
  mkdirSync("test-results", { recursive: true }); await page.screenshot({ path: "test-results/peel-idle.png" });
  const reset = async () => { await page.getByRole("button", { name: "Replay peel", exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'idle'); };
  const drag = async (fraction, hold = false, corner = "top-right") => { const box = await card.boundingBox(); const right = corner.endsWith("right"), bottom = corner.startsWith("bottom"); const start = { x: box.x + (right ? box.width - 24 : 24), y: box.y + (bottom ? box.height - 24 : 24) }; await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + (right ? -1 : 1) * box.width * fraction, start.y + (bottom ? -1 : 1) * box.height * fraction, { steps: 16 }); if (!hold) await page.mouse.up(); };
  await drag(.15); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'idle'); assert.equal(await page.evaluate(() => window.__reveals.length), 0);
  await drag(.3, true); await page.waitForFunction(() => Number(document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-peel-progress')) > .3); await page.screenshot({ path: "test-results/peel-fold.png" }); await page.mouse.up(); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'idle');
  await drag(.8); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); assert.equal(await page.evaluate(() => window.__reveals.length), 1); assert.equal(await page.locator("[data-peel-content]").getAttribute("aria-hidden"), "false"); await page.screenshot({ path: "test-results/peel-revealed.png" });
  await reset(); await page.locator("[data-peel-activation]").click(); assert.equal(await paper.getAttribute("data-phase"), "revealing"); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); assert.equal(await page.evaluate(() => window.__reveals.length), 1);
  await reset(); await page.getByRole("button", { name: "Switch layout", exact: true }).click(); await drag(.8); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); await reset();
  await page.getByRole("button", { name: "Switch corner", exact: true }).click(); await drag(.8, false, "bottom-left"); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); await reset();
  await page.getByRole("button", { name: "Switch layout", exact: true }).click(); await page.setViewportSize({ width: 380, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const box = await card.boundingBox(), touch = await page.context().newCDPSession(page); const start = { x: box.x + 24, y: box.y + box.height - 24 }; await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] }); await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width * .85, y: box.y + box.height * .1, id: 1 }] }); await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); await touch.detach(); await page.screenshot({ path: "test-results/peel-mobile.png" });
  await reset(); await page.emulateMedia({ reducedMotion: "reduce" }); await page.locator("[data-peel-handle]").focus(); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1100, height: 900 }); const apiCalls = []; await page.route("**/api/**", (route) => { apiCalls.push(route.request().url()); return route.abort(); });
  for (const route of ["slides-12", "slides-2004", "standard-plain"]) {
    await page.goto(`${origin}/__peel-export-${route}`); if (route.startsWith("standard")) await page.getByRole("button", { name: "Start learning", exact: true }).click(); await paper.waitFor();
    if (route === "slides-12") {
      await page.getByRole("button", { name: "Present full screen", exact: true }).first().click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement)); await drag(.8);
    } else await page.locator("[data-peel-activation]").click();
    await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed');
    assert.equal(await page.locator("[data-peel-content] strong").textContent(), "learning moment");
    if (route.includes("plain")) await page.waitForFunction(() => JSON.parse(localStorage.getItem("coursecraft-progress-v2-peel-export-plain") || "{}").interactedContentIds?.includes("paper:revealed"));
    else await page.waitForFunction(() => { const state = JSON.parse(window.__lmsValues["cmi.suspend_data"] || "{}"); return Boolean(state.i && (atob(state.i).charCodeAt(0) & 1)); });
    await page.reload(); if (route.startsWith("standard")) await page.getByRole("button", { name: "Start learning", exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-peel-to-reveal]')?.getAttribute('data-phase') === 'revealed'); assert.equal(await page.locator("[data-peel-content] strong").textContent(), "learning moment");
  }
  assert.equal(apiCalls.length, 0); assert.deepEqual(errors, []);
  console.log("Peel browser checks passed: curved fold, spring-back, drag, tap, scaled slides, reverse corner, touch, keyboard, reduced motion, compiled HTML, SCORM 1.2/2004 and completion resume; no Next.js API calls.");
} finally { await browser?.close(); await vite.close(); }
