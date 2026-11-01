/** Real pointer/touch and compiled HTML/SCORM verification. Uses no application database. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{HangingRopeCards}from'/components/physics-interaction/hanging-rope-cards.tsx';
import{hangingRopeCardsBlockSchema}from'/lib/schemas/block.ts';import{SlidePlaybackContext}from'/app/courses/[courseId]/_components/slide-presentation/slide-playback-context.tsx';import'/app/globals.css';
window.__reveals=[];
const data=hangingRopeCardsBlockSchema.parse({id:'ropes',type:'hangingRopeCards',version:1,data:{}}).data;
function App(){const[slides,setSlides]=useState(false),[authoring,setAuthoring]=useState(false),[progress,setProgress]=useState(new Set());
return React.createElement('main',{style:{padding:20,maxWidth:900,margin:'auto'}},
React.createElement('nav',{style:{display:'flex',gap:20,marginBottom:20}},React.createElement('button',{onClick:()=>setSlides(!slides)},'Switch layout'),React.createElement('button',{onClick:()=>setAuthoring(!authoring)},'Switch authoring')),
React.createElement(SlidePlaybackContext.Provider,{value:true},React.createElement('div',{style:slides?{width:850,height:500,transform:'scale(.65)',transformOrigin:'top left'}:{}},
React.createElement(HangingRopeCards,{blockId:'ropes',data,presentation:slides,authoring,interactedContentIds:progress,onProgress:id=>{window.__reveals.push(id);setProgress(current=>new Set([...current,id]));},renderContent:card=>React.createElement('div',{style:{padding:24}},React.createElement('h2',{style:{fontSize:24,fontWeight:600}},card.title+' the idea'),React.createElement('p',null,'A ',React.createElement('strong',null,'learning discovery'),' behind a hanging card.'))}))));}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
let exportData;
const vite = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "rope-browser-test", resolveId: (id) => id === "/__rope-harness.js" ? id : null, load: (id) => id === "/__rope-harness.js" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => {
  if (request.url === "/__ropes") { response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__rope-harness.js"></script></body></html>'); }
  else if (request.url?.startsWith("/__rope-export")) {
    const kind = request.url.includes("2004") ? "2004" : request.url.includes("plain") ? "plain" : "12";
    const data = { ...exportData, courseId: `rope-export-${kind}`, courseLayout: request.url.includes("standard") ? "standard" : "slides", scorm12Enabled: kind === "12", scorm2004Enabled: kind === "2004" };
    const lms = `const values=JSON.parse(sessionStorage.getItem('rope-lms-${kind}')||'{}');window.__lmsValues=values;const get=k=>values[k]||'',set=(k,v)=>{values[k]=v;sessionStorage.setItem('rope-lms-${kind}',JSON.stringify(values));return'true';};window.API={LMSInitialize:()=> 'true',LMSFinish:()=> 'true',LMSCommit:()=> 'true',LMSGetValue:get,LMSSetValue:set};window.API_1484_11={Initialize:()=> 'true',Terminate:()=> 'true',Commit:()=> 'true',GetValue:get,SetValue:set};`;
    response.setHeader("Content-Type", "text/html"); response.end(readFileSync("public/course-export/index.html", "utf8").replaceAll("./assets/", "/course-export/assets/").replace("<body>", `<body><script>${lms}window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll("<", "\\u003c")};</script>`));
  } else next();
}); } }] });
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  exportData = { courseId: "rope-export", ...editorSnapshotSchema.parse({ title: "Rope discoveries", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Discover", order: 0 }], lessons: [{ id: "lesson", title: "Hanging discoveries", sectionId: "section", order: 0, blocks: [{ id: "ropes", type: "hangingRopeCards", version: 1, slideAnimation: { effect: "none", duration: 1000, delay: 0 }, slideFrame: { x: 5, y: 20, width: 90, height: 65, z: 0 }, data: {} }] }] }) };
  await vite.listen(); const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  const scene = (id = "rope-1") => page.locator(`[data-rope-scene="${id}"]`);
  const screenPoint = (x, y, id = "rope-1") => scene(id).evaluate((svg, point) => { const p = svg.createSVGPoint(); p.x = point.x; p.y = point.y; const screen = p.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y }; }, { x, y });
  const drag = async (x = 140, y = 348, hold = false) => { const start = await screenPoint(140, 193), end = await screenPoint(x, y); await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 14 }); if (!hold) await page.mouse.up(); };
  const waitReveal = () => page.getByRole("region", { name: "Rope discovery: Explore", exact: true }).waitFor();
  const replay = async () => { const close = page.getByRole("button", { name: "Close rope discovery", exact: true }); if (await close.count()) await close.click(); await page.getByRole("button", { name: "Replay hanging cards", exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-rope-scene="rope-1"]')?.getAttribute("data-phase") === "idle"); };
  await page.goto(`${origin}/__ropes`); await scene().waitFor(); mkdirSync("test-results", { recursive: true }); await page.screenshot({ path: "test-results/rope-idle.png" });
  await drag(180, 265, true); await page.waitForFunction(() => Number(document.querySelector('[data-rope-scene="rope-1"]')?.getAttribute("data-card-y")) > 240); await page.screenshot({ path: "test-results/rope-stretched.png" }); await page.mouse.up();
  await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-rope-scene="rope-1"]')?.getAttribute("data-card-y")) - 193) < .1); assert.equal(await page.evaluate(() => window.__reveals.length), 0);
  await drag(); await waitReveal(); assert.equal(await page.evaluate(() => window.__reveals.length), 1); await page.screenshot({ path: "test-results/rope-revealed.png" });
  await page.getByRole("button", { name: "Close rope discovery", exact: true }).click(); await page.getByRole("button", { name: "Review rope card: Explore", exact: true }).click(); await waitReveal(); assert.equal(await page.evaluate(() => window.__reveals.length), 1);
  await replay(); await page.getByRole("button", { name: "Switch layout", exact: true }).click(); await drag(); await waitReveal(); assert.equal(await page.evaluate(() => window.__reveals.length), 1); await replay();
  await page.getByRole("button", { name: "Pull rope card: Connect", exact: true }).focus(); await page.keyboard.press("Enter"); await page.getByRole("region", { name: "Rope discovery: Connect", exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__reveals.length), 2);
  await replay(); await page.getByRole("button", { name: "Switch authoring", exact: true }).click(); await drag(); await waitReveal(); assert.equal(await page.evaluate(() => window.__reveals.length), 2); await replay();
  await page.getByRole("button", { name: "Switch layout", exact: true }).click(); await page.setViewportSize({ width: 380, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const start = await screenPoint(140, 193), end = await screenPoint(140, 348), touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] }); await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 1 }] }); await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await waitReveal(); await touch.detach();
  await page.waitForFunction(() => { const bounds = document.querySelector('[aria-label="Rope discovery: Explore"]').getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom <= innerHeight + 1; });
  await page.screenshot({ path: "test-results/rope-mobile.png" });
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.reload(); await scene().waitFor(); await page.getByRole("button", { name: "Pull rope card: Explore", exact: true }).focus(); await page.keyboard.press("Space"); await waitReveal(); await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1100, height: 900 }); const apiCalls = []; await page.route("**/api/**", (route) => { apiCalls.push(route.request().url()); return route.abort(); });
  for (const route of ["slides-12", "slides-2004", "standard-plain"]) {
    await page.goto(`${origin}/__rope-export-${route}`); if (route.startsWith("standard")) await page.getByRole("button", { name: "Start learning", exact: true }).click(); await scene().waitFor();
    if (route === "slides-12") { await page.getByRole("button", { name: "Present full screen", exact: true }).first().click(); await page.waitForFunction(() => Boolean(document.fullscreenElement)); await drag(); }
    else { await page.getByRole("button", { name: "Pull rope card: Explore", exact: true }).focus(); await page.keyboard.press("Enter"); }
    await waitReveal(); assert.ok((await page.getByRole("region", { name: "Rope discovery: Explore", exact: true }).textContent()).includes("learning content"));
    if (route.includes("plain")) await page.waitForFunction(() => JSON.parse(localStorage.getItem("coursecraft-progress-v2-rope-export-plain") || "{}").interactedContentIds?.includes("ropes:rope:rope-1"));
    else await page.waitForFunction(() => { const state = JSON.parse(window.__lmsValues["cmi.suspend_data"] || "{}"); return Boolean(state.i && (atob(state.i).charCodeAt(0) & 1)); });
    await page.reload(); if (route.startsWith("standard")) await page.getByRole("button", { name: "Start learning", exact: true }).click(); await page.getByRole("button", { name: "Review rope card: Explore", exact: true }).waitFor();
    await page.getByRole("button", { name: "Review rope card: Explore", exact: true }).click(); await waitReveal();
  }
  assert.equal(apiCalls.length, 0); assert.deepEqual(errors, []);
  console.log("Hanging Rope Cards browser checks passed: stretching/sway, missed-drop recovery, physical reveals, replay/review, scaled/fullscreen slides, touch, keyboard, reduced motion, author preview, compiled HTML, SCORM 1.2/2004 and resume, with no Next.js API calls.");
} finally { await browser?.close(); await vite.close(); }
