/** Verify carousel gestures, fit settings, slide zoom, dialogs, and offline learners. Run build:export first. */
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const images = [[800,400,"#24734f"],[300,600,"#6941c6"],[500,500,"#bd4e3b"]].map(([width,height,color],index)=>({src:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="50%" cy="50%" r="50" fill="white"/></svg>`)}`,alt:`Image ${index+1}`}));
const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{GalleryBlockSettings}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/gallery-block-settings.tsx';
import{ContentBlockPreview}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/content-block-preview.tsx';
import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{PreviewBlock}from'/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block.tsx';
import{Dialog}from'/components/ui/dialog.tsx';import'/app/globals.css';
const initial={id:'gallery',type:'gallery',version:1,width:'medium',widthCustom:false,backgroundColor:'#ffffff',blockPadding:40,slideFrame:{x:5,y:5,width:90,height:85,z:1},data:{layout:'carousel',imageFit:'cover',images:${JSON.stringify(images)}}};
function App(){const[block,setBlock]=useState(initial),[mode,setMode]=useState('standard'),[zoom,setZoom]=useState(.5),[open,setOpen]=useState(false);window.__gallery=block;
const slide=()=> <div style={{width:960*zoom,height:540*zoom}}><div data-slide-objects style={{position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left'}}><SlideObject block={block} index={0} total={1} selected area={{width:960,height:540}} onSelect={()=>{}} onFrame={frame=>setBlock({...block,slideFrame:frame})} onChange={setBlock} onEditorFocus={()=>{}}/></div></div>;
return <main style={{padding:20}}><nav>{['standard','slides','learner'].map(m=><button key={m} onClick={()=>setMode(m)}>{m}</button>)}{[.5,1,1.5].map(z=><button key={z} onClick={()=>setZoom(z)}>{z*100}%</button>)}<button onClick={()=>setOpen(true)}>Open popup</button><button onClick={()=>document.querySelector('[data-stage]').requestFullscreen()}>Fullscreen</button></nav><div data-stage style={{maxWidth:900}}>{mode==='standard'?<ContentBlockPreview block={block} onChange={setBlock}/>:mode==='slides'?slide():<PreviewBlock block={block} device="desktop" orientation="landscape"/>}</div><div data-settings style={{maxWidth:380,marginTop:24}}><GalleryBlockSettings block={block} onChange={setBlock} setSelectedGalleryImageIndex={()=>{}} setMediaLibraryTarget={()=>{}}/></div>{open&&<Dialog open title="Gallery popup" onClose={()=>setOpen(false)} className="max-w-4xl">{slide()}</Dialog>}</main>;}createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-gallery-carousel-browser", root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "gallery-fixture", resolveId: (id) => id === "/__gallery.tsx" ? id : null, load: (id) => id === "/__gallery.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__gallery") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__gallery.tsx"></script></body></html>'); }); } }] });
let browser;
async function checkCarousel(page, scope) {
  const gallery=scope.locator('[data-gallery-carousel]');
  const track=gallery.locator('[data-gallery-track]');
  await gallery.waitFor({state:'visible'});
  const geometry=await track.evaluate(node=>({paddingLeft:getComputedStyle(node).paddingLeft,paddingRight:getComputedStyle(node).paddingRight,frame:node.clientWidth,image:node.children[0].clientWidth}));
  assert.equal(geometry.paddingLeft,'0px');assert.equal(geometry.paddingRight,'0px');
  assert.ok(Math.abs(geometry.frame-geometry.image)<2,'Each image should fill the carousel width');
  const centered=async index=>expect.poll(()=>track.evaluate((node,index)=>{const slide=node.children[index];return Math.abs(slide.offsetLeft+slide.clientWidth/2-node.scrollLeft-node.clientWidth/2);},index)).toBeLessThan(2);
  await track.focus(); await page.keyboard.press('Home'); await centered(0);
  await gallery.getByRole('button',{name:'Next gallery image',exact:true}).click();
  await centered(1);
  await gallery.getByRole('button',{name:'Next gallery image',exact:true}).click();
  await centered(2);
  await expect(gallery.getByRole('button',{name:'Next gallery image',exact:true})).toBeDisabled();
  await gallery.getByRole('button',{name:'Previous gallery image',exact:true}).click();
  await centered(1);
  await track.focus(); await page.keyboard.press('Home'); await centered(0);
  const imageTrigger=gallery.locator('[data-gallery-slide]').nth(1).getByRole('button');
  await imageTrigger.click();
  const zoom=page.getByRole('dialog',{name:'Image preview: Image 2',exact:true});
  await zoom.waitFor({state:'visible'});
  assert.equal(await zoom.locator('img').getAttribute('src'),await gallery.locator('[data-gallery-slide]').nth(1).locator('img').getAttribute('src'));
  assert.equal(await zoom.locator('img').evaluate(node=>getComputedStyle(node).objectFit),'contain');
  assert.equal(await zoom.evaluate(node=>Boolean(node.closest('[data-slide-objects], [data-gallery-track]'))),false);
  const zoomBounds=await zoom.boundingBox(),viewport=page.viewportSize();
  assert.ok(Math.abs(zoomBounds.width-viewport.width)<2&&Math.abs(zoomBounds.height-viewport.height)<2,'Zoom should fill the viewport independently of slide scale');
  await page.keyboard.press('ArrowRight');
  await expect(gallery.locator('[role="status"]')).toHaveText('2 / 3');
  await page.keyboard.press('Escape');
  await zoom.waitFor({state:'hidden'});
  await expect(imageTrigger).toBeFocused();
  await centered(1);
  await track.focus(); await page.keyboard.press('End'); await centered(2);
  await page.keyboard.press('Home'); await centered(0);
  await track.hover(); await page.mouse.wheel(500,0);
  await expect.poll(()=>track.evaluate(node=>node.scrollLeft)).toBeGreaterThan(20);
  await expect.poll(()=>track.evaluate(node=>Math.min(...Array.from(node.children).map(slide=>Math.abs(slide.offsetLeft+slide.clientWidth/2-node.scrollLeft-node.clientWidth/2))))).toBeLessThan(2);
  await page.emulateMedia({reducedMotion:'reduce'});
  await track.focus(); await page.keyboard.press('Home'); await centered(0);
  await page.keyboard.press('End'); await centered(2);
  await page.emulateMedia({reducedMotion:'no-preference'});
}
try {
  await vite.listen();
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1800,height:1100}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.process={env:{NODE_ENV:'development'}};});
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__gallery`);
  const firstImage=page.locator('[data-stage] [data-gallery-slide]').first().getByRole('button');
  const firstZoomIcon=firstImage.locator('[data-gallery-zoom-icon]');
  const outside=page.getByRole('button',{name:'standard',exact:true});
  await outside.hover();
  await expect(firstZoomIcon).toHaveCSS('opacity','0');
  await firstImage.hover();
  await expect(firstZoomIcon).toHaveCSS('opacity','1');
  await outside.hover();
  await expect(firstZoomIcon).toHaveCSS('opacity','0');
  await firstImage.focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-stage] [data-gallery-slide]').nth(1).locator('[data-gallery-zoom-icon]')).toHaveCSS('opacity','1');
  if(process.env.GALLERY_HOVER_ONLY==='1') {
    await page.close();
    console.log('Gallery zoom icon checks passed: hidden normally, visible on image hover or keyboard focus.');
  } else {
  await checkCarousel(page,page.locator('[data-stage]'));
  assert.deepEqual(await page.locator('[data-stage] [data-gallery-slide] img').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).objectFit)),['cover','cover','cover']);
  await page.getByLabel('Gallery image fit',{exact:true}).selectOption('cover');
  assert.deepEqual(await page.locator('[data-stage] [data-gallery-slide] img').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).objectFit)),['cover','cover','cover']);
  await page.getByLabel('Gallery image fit',{exact:true}).selectOption('fill');
  assert.deepEqual(await page.locator('[data-stage] [data-gallery-slide] img').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).objectFit)),['fill','fill','fill']);
  await page.getByLabel('Gallery image fit',{exact:true}).selectOption('cover');
  await page.getByLabel('Gallery image 2 fit',{exact:true}).selectOption('contain');
  assert.deepEqual(await page.locator('[data-stage] [data-gallery-slide] img').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).objectFit)),['cover','contain','cover']);
  await page.getByRole('button',{name:'slides',exact:true}).click();
  for (const zoom of ['50%','100%','150%']) {
    await page.getByRole('button',{name:zoom,exact:true}).click();
    await checkCarousel(page,page.locator('[data-stage]'));
    const fits=await page.locator('[data-stage] [data-gallery-track]').evaluate(node=>node.getBoundingClientRect().height>30);
    assert.equal(fits,true);
  }
  await page.getByRole('button',{name:'50%',exact:true}).click();
  await page.getByRole('button',{name:'Open popup',exact:true}).click();
  await checkCarousel(page,page.locator('dialog[open]'));
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'learner',exact:true}).click();
  await checkCarousel(page,page.locator('[data-stage]'));
  await page.setViewportSize({width:360,height:800});
  await checkCarousel(page,page.locator('[data-stage]'));
  await page.setViewportSize({width:1200,height:900});
  await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
  await page.locator('[data-stage] [data-gallery-slide]').last().getByRole('button').click();
  const fullscreenZoom=page.getByRole('dialog',{name:'Image preview: Image 3',exact:true});
  await fullscreenZoom.waitFor({state:'visible'});
  assert.equal(await fullscreenZoom.evaluate(node=>node.parentElement===document.fullscreenElement),true);
  await fullscreenZoom.getByRole('button',{name:'Close dialog',exact:true}).click();
  await fullscreenZoom.waitFor({state:'hidden'});
  await page.evaluate(()=>document.exitFullscreen());
  assert.deepEqual(errors,[]);
  await page.close();

  // Load the compiled standalone runtime directly from disk with no server APIs.
  const directory=resolve('public/course-export/assets'), names=readdirSync(directory);
  const js=readFileSync(resolve(directory,names.find(name=>name.endsWith('.js'))),'utf8');
  const {inlineLocalFontAssets}=await vite.ssrLoadModule('/lib/export/inline-font-assets.ts');
  const {editorSnapshotSchema}=await vite.ssrLoadModule('/lib/editor/schemas.ts');
  const css=await inlineLocalFontAssets(readFileSync(resolve(directory,names.find(name=>name.endsWith('.css'))),'utf8'),directory);
  mkdirSync('test-results',{recursive:true});
  for (const courseLayout of ['standard','slides']) {
    const data={courseId:'gallery-'+courseLayout,...editorSnapshotSchema.parse({title:'Gallery',description:'',revision:0,courseLayout,sections:[{id:'s',title:'Section',order:0}],lessons:[{id:'l',sectionId:'s',title:'Images',order:0,blocks:[{id:'gallery',type:'gallery',version:1,slideFrame:{x:5,y:5,width:90,height:80,z:1},data:{layout:'carousel',imageFit:'cover',images}}]}]})};
    const file=resolve('test-results/gallery-'+courseLayout+'.html');
    writeFileSync(file,`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${JSON.stringify(data).replaceAll('<','\\u003c')}</script><script>${js}</script></body></html>`);
    const offline=await browser.newPage({viewport:{width:1200,height:900}});
    const requests=[],offlineErrors=[];
    offline.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
    offline.on('pageerror',error=>offlineErrors.push(error.message));
    await offline.goto(pathToFileURL(file).href);
    if(courseLayout==='standard')await offline.getByRole('button',{name:'Start learning',exact:true}).click();
    await checkCarousel(offline,offline);
    assert.deepEqual(requests,[]);assert.deepEqual(offlineErrors,[]);
    await offline.close();
  }
  console.log('Gallery browser checks passed: Previous/Next, image click snapping, horizontal wheel, keyboard/reduced motion, fit overrides, scaled slides, popup, mobile, image zoom with Escape/focus restoration/fullscreen, and static Standard/Presentation exports without network requests.');
  }
} finally {await browser?.close();await vite.close();}
