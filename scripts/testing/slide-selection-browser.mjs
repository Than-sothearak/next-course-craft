/** Real pointer, keyboard, touch and modal checks for the shared authoring tools. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{blockSchema}from'/lib/schemas/block.ts';
import{defaultSlideMaster}from'/lib/editor/slide-design.ts';
import{reorderSlideLayers}from'/lib/editor/slide-layers.ts';
import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{useSlideSelection}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/use-slide-selection.ts';
import{SlideSelectionOverlay}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-selection-overlay.tsx';
import{SlideSelectionControls}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-selection-controls.tsx';
import{SlideObjectLayers}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-object-layers.tsx';
import{InteractionPopupEditor}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/interaction-popup-editor.tsx';
import'/app/globals.css';
const area={width:960,height:540};
const make=()=>[['one','heading',10,30],['two','richText',40,40],['three','image',70,50]].map(([id,type,x,y],z)=>blockSchema.parse({id,type,version:1,slideFrame:{x,y,width:20,height:20,z},slideTextLayout:{fitToText:false},data:type==='heading'?{text:'Heading',level:2}:type==='richText'?{html:'<p>Text</p>'}:{src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#86efac"/></svg>'),alt:'Image'}}));
function App(){const[blocks,setBlocks]=useState(make),[zoom,setZoom]=useState(.5),[history,setHistory]=useState([]),[open,setOpen]=useState(false),[popup,setPopup]=useState(()=>blockSchema.parse({id:'popup',type:'interactionButton',version:1,data:{popup:{blocks:make().slice(0,2)}}}).data.popup);const ref=useRef(null);
function commit(next){setHistory(h=>[...h,blocks]);setBlocks(next);}
const selection=useSlideSelection({blocks,area,scopeRef:ref,onBlocksChange:commit});
window.__blocks=blocks;window.__selected=selection.selectedIds;window.__member=selection.memberGroupId;window.__popup=popup;window.__history=history.length;
return <main style={{padding:20,fontFamily:'Arial'}}><nav style={{display:'flex',gap:8,marginBottom:15}}><button onClick={()=>{setBlocks(make());setHistory([]);selection.clear();}}>Reset</button>{[.5,1,1.5].map(z=><button key={z} onClick={()=>setZoom(z)}>{z*100}%</button>)}<button onClick={()=>{setBlocks(history.at(-1));setHistory(h=>h.slice(0,-1));}} disabled={!history.length}>Undo</button><button onClick={()=>setOpen(true)}>Open popup editor</button></nav>
<div ref={ref} tabIndex={-1} onPointerDownCapture={selection.backgroundPointerDown} onPointerMoveCapture={selection.pointerMove} onPointerUpCapture={selection.pointerUp} onPointerCancelCapture={selection.cancel} style={{display:'flex',gap:20,alignItems:'flex-start'}}>
<div style={{width:960*zoom,height:540*zoom,flexShrink:0}}><div data-slide-canvas style={{position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left',background:'#f8fafc'}}><div data-slide-objects style={{position:'relative',height:'100%',width:'100%'}}>{selection.renderBlocks.map((block,index)=>!selection.hiddenIds.has(block.id)&&<SlideObject key={block.id} block={block} lessonBlocks={blocks} index={index} total={blocks.length} area={area} master={defaultSlideMaster} selected={selection.selectedIds.includes(block.id)} readOnly={selection.lockedIds.has(block.id)} suppressTransforms={selection.selectedIds.length>1||Boolean(block.slideGroupId&&selection.memberGroupId!==block.slideGroupId)} suspendAutoFit={selection.transforming} onPointerSelect={e=>selection.objectPointerDown(block.id,e)} onEnterMember={()=>selection.enterMember(block.id)} onSelect={()=>selection.selectObject(block.id)} onFrame={slideFrame=>commit(blocks.map(b=>b.id===block.id?{...b,slideFrame}:b))} onChange={next=>commit(blocks.map(b=>b.id===next.id?next:b))} onEditorFocus={()=>selection.selectObject(block.id)}/>) }<SlideSelectionOverlay selection={selection}/></div></div></div>
<aside style={{width:380,flexShrink:0}}><SlideSelectionControls selection={selection} blocks={blocks}/><SlideObjectLayers blocks={blocks} selectedId={selection.selectedId} selectedIds={selection.selectedIds} onSelect={selection.selectLayer} onToggleSelect={id=>selection.selectLayer(id,{shiftKey:true})} onSelectMember={selection.enterMember} onToggleFlag={selection.toggleFlag} onReorder={(a,b)=>commit(reorderSlideLayers(blocks,a,b,area))}/></aside></div>
{open&&<InteractionPopupEditor popup={popup} courseId="course" sections={[]} lessons={[]} onClose={()=>setOpen(false)} onApply={p=>{setPopup(p);setOpen(false);}}/>}</main>;}
createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({ configFile: false, root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "selection-fixture", resolveId: (id) => id === "/__selection.tsx" ? id : null, load: (id) => id === "/__selection.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__selection") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__selection.tsx"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2000, height: 1300 } }); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  const url = `http://127.0.0.1:${vite.httpServer.address().port}/__selection`;
  await page.goto(url); await page.locator('[data-slide-object-id="three"]').waitFor();
  const row = (id) => page.locator(`[data-slide-layer="${id}"]`);
  async function drag(selector, dx, dy, cancel = false) {
    const box = await page.getByRole("button", { name: selector, exact: true }).boundingBox(); assert.ok(box);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 5 });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  for (const zoom of [.5, 1.5]) {
    await page.getByRole("button", { name: "Reset", exact: true }).click(); await page.getByRole("button", { name: `${zoom * 100}%`, exact: true }).click();
    await row("one").getByRole("checkbox").check(); await row("two").getByRole("checkbox").check(); await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.waitForFunction(() => window.__blocks[0].slideGroupId && window.__blocks[0].slideGroupId === window.__blocks[1].slideGroupId);
    await drag("Move selected objects", 96 * zoom, 54 * zoom);
    await page.waitForFunction(() => Math.abs(window.__blocks[0].slideFrame.x - 20) < .01);
    const committed = await page.evaluate(() => structuredClone(window.__blocks));
    await drag("Move selected objects", 48 * zoom, 27 * zoom, true);
    assert.deepEqual(await page.evaluate(() => window.__blocks), committed, "Escape must discard the whole group gesture");
    await drag("Resize selection bottom right", 48 * zoom, 16.2 * zoom);
    await page.waitForFunction(() => Math.abs(window.__blocks[0].slideFrame.width - 22) < .01);
    assert.equal(await page.evaluate(() => window.__history), 3, "Group, move, and resize each commit once");
    await page.locator('[data-slide-object-id="one"]').dblclick();
    await page.waitForFunction(() => window.__member && window.__selected.length === 1);
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !window.__member && window.__selected.length === 2);
    await page.getByRole("button", { name: /^Lock group/ }).click();
    assert.equal(await page.locator('[data-slide-object-id="one"]').getAttribute("data-slide-object-locked"), "true");
    await page.getByRole("button", { name: /^Hide group/ }).click(); assert.equal(await page.locator('[data-slide-object-id="one"]').count(), 0);
    await page.getByRole("button", { name: /^Show group/ }).click(); await page.getByRole("button", { name: /^Unlock group/ }).click();
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click(); await page.getByRole("button", { name: "50%", exact: true }).click();
  const canvas = await page.locator('[data-slide-canvas]').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * .05, canvas.y + canvas.height * .25); await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * .62, canvas.y + canvas.height * .62, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => window.__selected.length === 2);
  await page.getByRole("button", { name: "Open popup editor", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit popup mini slide" });
  await dialog.locator('[data-slide-layer="two"]').getByRole("checkbox").check(); await dialog.getByRole("button", { name: "Group", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply popup", exact: true }).click();
  assert.ok(await page.evaluate(() => window.__popup.blocks[0].slideGroupId === window.__popup.blocks[1].slideGroupId));
  assert.equal(await page.evaluate(() => window.__blocks.length), 3, "Popup editing cannot change the parent canvas");
  await page.getByRole("button", { name: "Open popup editor", exact: true }).click();
  await dialog.getByRole("button", { name: /^Hide group/ }).click(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__popup.blocks.some((block) => block.slideHiddenInEditor)), false);
  mkdirSync("test-results", { recursive: true }); await page.screenshot({ path: "test-results/slide-selection-tools.png" });

  const touch = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true, isMobile: true }); const phone = await touch.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; }); await phone.goto(url);
  await phone.locator('[data-slide-layer="one"]').getByRole("checkbox").tap(); await phone.locator('[data-slide-layer="two"]').getByRole("checkbox").tap();
  await phone.getByRole("button", { name: "Group", exact: true }).tap();
  const move = await phone.getByRole("button", { name: "Move selected objects", exact: true }).boundingBox();
  const session = await touch.newCDPSession(phone), x = move.x + move.width / 2, y = move.y + move.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 5; step++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 48 * step / 5, y: y + 27 * step / 5 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await phone.waitForFunction(() => Math.abs(window.__blocks[0].slideFrame.x - 20) < .01);
  assert.deepEqual(errors, []);
  console.log("Presentation selection browser checks passed: mouse/touch selection and movement, 50%/150% proportional resizing, atomic commits, cancellation, group member editing, lock/hide, marquee, and popup Apply/Cancel isolation.");
} finally { await browser?.close(); await vite.close(); }
