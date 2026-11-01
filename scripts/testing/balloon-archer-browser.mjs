/** Isolated component and compiled-export smoke test; does not connect to an application database. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fixture = `
import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {BalloonArcher} from '/components/balloon-archer.tsx';
import {SlideObjectContent} from '/app/courses/[courseId]/_components/slide-presentation/slide-object-content.tsx';
import {SlidePlaybackContext} from '/app/courses/[courseId]/_components/slide-presentation/slide-playback-context.tsx';
import {balloonArcherDataSchema} from '/lib/schemas/balloon-archer.ts'; import '/app/globals.css';
window.__hits=[]; window.__positions=[];
const initial=balloonArcherDataSchema.parse({balloons:[{id:'gravity',word:'Gravity',content:'A force that attracts objects.',x:50,y:25},{id:'energy',word:'Energy',content:'The ability to do work.',x:25,y:40}]});
function App(){
 const[data,setData]=useState(initial),[presentation,setPresentation]=useState(false),[editing,setEditing]=useState(false),[progress,setProgress]=useState(new Set());
 const game=React.createElement(BalloonArcher,{blockId:'browser-game',data,presentation,authoring:editing,editing,interactedContentIds:progress,onProgress:id=>{window.__hits.push(id);setProgress(current=>new Set([...current,id]));},onPositionChange:(id,point)=>{window.__positions.push({id,...point});setData(current=>({...current,balloons:current.balloons.map(balloon=>balloon.id===id?{...balloon,...point}:balloon)}));}});
 return React.createElement('main',{style:{maxWidth:800,width:'100%',padding:16,margin:'0 auto',boxSizing:'border-box'}},React.createElement('div',{style:{display:'flex',gap:8,marginBottom:16}},React.createElement('button',{onClick:()=>setPresentation(!presentation)},'Switch layout'),React.createElement('button',{onClick:()=>setEditing(!editing)},'Switch authoring')),React.createElement(SlidePlaybackContext.Provider,{value:true},presentation?React.createElement('div',{style:{height:600,position:'relative'}},React.createElement(SlideObjectContent,null,game)):game));
}createRoot(document.getElementById('root')).render(React.createElement(App));`;
const balloons = [
  { id: "gravity", word: "Gravity", content: "A force that attracts objects.", x: 50, y: 25 },
  { id: "energy", word: "Energy", content: "The ability to do work.", x: 25, y: 40 },
];
let exportData;
const vite = await createServer({
  configFile: false, root: process.cwd(), resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge"] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "archer-browser-test",
    resolveId: (id) => id === "/__archer-harness.js" ? id : null,
    load: (id) => id === "/__archer-harness.js" ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === "/__archer") {
          response.setHeader("Content-Type", "text/html");
          response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__archer-harness.js"></script></body></html>');
        } else if (request.url?.startsWith("/__archer-export")) {
          const lms = `const values=JSON.parse(sessionStorage.getItem('archer-lms')||'{}');window.__lmsValues=values;window.API={LMSInitialize:()=>"true",LMSFinish:()=>"true",LMSCommit:()=>"true",LMSGetValue:key=>values[key]||"",LMSSetValue:(key,value)=>{values[key]=value;sessionStorage.setItem('archer-lms',JSON.stringify(values));return"true";}};`;
          const data = { ...exportData, courseLayout: request.url.includes("standard") ? "standard" : "slides", scorm12Enabled: !request.url.includes("plain") };
          const html = readFileSync("public/course-export/index.html", "utf8").replaceAll("./assets/", "/course-export/assets/").replace("<body>", `<body><script>${lms}window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll("<", "\\u003c")};</script>`);
          response.setHeader("Content-Type", "text/html"); response.end(html);
        } else next();
      });
    },
  }],
});
let browser;
try {
  const { editorSnapshotSchema } = await vite.ssrLoadModule("/lib/editor/schemas.ts");
  exportData = { courseId: "archer-browser-export", ...editorSnapshotSchema.parse({ title: "Balloon course", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Games", order: 0 }], lessons: [{ id: "lesson", title: "Discover science", sectionId: "section", order: 0, blocks: [{ id: "export-game", version: 1, type: "balloonArcher", slideFrame: { x: 5, y: 20, width: 90, height: 70, z: 0 }, data: { balloons } }] }] }) };
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto(`${origin}/__archer`); await page.locator("[data-archer-scene]").waitFor();
  assert.equal(await page.getByLabel("Choose balloon to aim at").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Shoot arrow", exact: true }).count(), 0);
  const initialCenter = await page.locator('[data-archer-balloon="gravity"] ellipse').first().evaluate((element) => ({ x: Number(element.getAttribute("cx")), y: Number(element.getAttribute("cy")) }));
  await page.waitForFunction((initial) => { const balloon = document.querySelector('[data-archer-balloon="gravity"] ellipse'); return balloon && Math.hypot(Number(balloon.getAttribute("cx")) - initial.x, Number(balloon.getAttribute("cy")) - initial.y) > 1; }, initialCenter);
  const world = (x, y) => page.locator("[data-archer-scene]").evaluate((svg, point) => {
    const position = svg.createSVGPoint(); position.x = point.x; position.y = point.y;
    const screen = position.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y };
  }, { x, y });
  const physicalShot = async () => {
    const start = await world(400, 490), end = await world(400, 580);
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up();
    await page.getByRole("region", { name: "Revealed balloon: Gravity", exact: true }).waitFor();
  };
  const keyboardShot = async (sideways = 0) => {
    const arrow = page.getByRole("button", { name: "Grab arrow, pull down and release to shoot", exact: true });
    await arrow.focus();
    for (let index = 0; index < Math.abs(sideways); index++) await arrow.press(sideways > 0 ? "ArrowLeft" : "ArrowRight");
    for (let index = 0; index < 9; index++) await arrow.press("ArrowDown");
    await arrow.press("Enter");
  };
  mkdirSync("test-results", { recursive: true });
  await physicalShot(); assert.equal(await page.evaluate(() => window.__hits.length), 1);
  await page.screenshot({ path: "test-results/balloon-archer-standard.png" });
  await page.getByRole("button", { name: "Close balloon reveal", exact: true }).click();
  await keyboardShot(10);
  await page.getByRole("region", { name: "Revealed balloon: Energy", exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__hits.length), 2);
  await page.getByRole("button", { name: "Replay Balloon Archer", exact: true }).click(); assert.equal(await page.locator("[data-archer-balloon][data-popped]").count(), 0);
  await page.getByRole("button", { name: "Switch layout", exact: true }).click();
  await page.getByRole("button", { name: "Replay Balloon Archer", exact: true }).click();
  await keyboardShot();
  await page.getByRole("region", { name: "Revealed balloon: Gravity", exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__hits.length), 2);
  await page.screenshot({ path: "test-results/balloon-archer-presentation.png" });
  await page.getByRole("button", { name: "Switch authoring", exact: true }).click();
  const start = await world(400, 150), end = await world(480, 210);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 10 }); assert.equal(await page.evaluate(() => window.__positions.length), 0); await page.mouse.up();
  await page.waitForFunction(() => window.__positions.length === 1);
  const position = await page.evaluate(() => window.__positions[0]); assert.ok(Math.abs(position.x - 60) < 0.1 && Math.abs(position.y - 35) < 0.1);
  await page.setViewportSize({ width: 380, height: 1000 }); await page.screenshot({ path: "test-results/balloon-archer-mobile.png" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole("button", { name: "Switch authoring", exact: true }).click();
  await page.getByRole("button", { name: "Replay Balloon Archer", exact: true }).click();
  const touchStart = await world(400, 490), touchEnd = await world(380, 580);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...touchStart, id: 1 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touchEnd, id: 1 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("region", { name: "Revealed balloon: Gravity", exact: true }).waitFor();
  await touch.detach();
  await page.setViewportSize({ width: 1000, height: 1000 });
  const apiCalls = []; await page.route("**/api/**", (route) => { apiCalls.push(route.request().url()); return route.abort(); });
  await page.goto(`${origin}/__archer-export`); await page.locator("[data-archer-scene]").waitFor();
  await page.locator("[data-slide-object-frame]").evaluate(async (element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))));
  await physicalShot();
  await page.waitForFunction(() => { const state = JSON.parse(window.__lmsValues["cmi.suspend_data"] || "{}"); return Boolean(state.i && (atob(state.i).charCodeAt(0) & 1)); });
  await page.reload(); await page.locator('[data-archer-balloon="gravity"][data-popped="true"]').waitFor();
  await page.goto(`${origin}/__archer-export-standard-plain`);
  await page.getByRole("button", { name: "Start learning", exact: true }).click();
  await keyboardShot();
  await page.getByRole("region", { name: "Revealed balloon: Gravity", exact: true }).waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("coursecraft-progress-v2-archer-browser-export") || "{}").interactedContentIds?.includes("export-game:balloon:gravity"));
  await page.reload(); await page.getByRole("button", { name: "Start learning", exact: true }).click();
  await page.locator('[data-archer-balloon="gravity"][data-popped="true"]').waitFor();
  assert.equal(apiCalls.length, 0); assert.deepEqual(errors, []);
  console.log("Balloon Archer browser checks passed: moving targets, pointer and touch shots, manual keyboard controls, replay, scaled author dragging, mobile sizing, compiled Standard/Presentation exports, local resume, and LMS resume.");
} finally { await browser?.close(); await vite.close(); }
