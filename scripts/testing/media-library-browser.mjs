/** Real playback and viewport sizing in shared, nested, and embedded media pickers. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const assets = [
  { id: "1".repeat(24), originalName: "Clip 10.webm", contentType: "video/webm", size: 9000, fileUrl: "/sample.webm", createdAt: "2026-01-02T00:00:00Z" },
  { id: "2".repeat(24), originalName: "Voice.wav", contentType: "audio/wav", size: 6000, fileUrl: "/sample.wav", createdAt: "2026-01-03T00:00:00Z" },
  { id: "3".repeat(24), originalName: "Clip 2.webm", contentType: "video/webm", size: 3000, fileUrl: "/sample.webm", createdAt: "2026-01-04T00:00:00Z" },
  { id: "4".repeat(24), originalName: "Notes.txt", contentType: "text/plain", size: 10, fileUrl: "/notes.txt", createdAt: "2026-01-01T00:00:00Z" },
];
const samples = 16000 * 5;
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
for (let index = 0; index < samples; index++) wav.writeInt16LE(Math.round(Math.sin(index / 16000 * 440 * Math.PI * 2) * 1000), 44 + index * 2);
let video;
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MediaLibraryDialog} from '/app/courses/[courseId]/edit/_components/media-library-dialog.tsx';
import {SlideCanvasMediaReplace} from '/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-canvas-media-replace.tsx';
import {Dialog} from '/components/ui/dialog.tsx';
import {Button} from '/components/ui/button.tsx';
import {blockSchema} from '/lib/schemas/block.ts';
import '/app/globals.css';
function App(){
  const [open,setOpen]=useState(false),[nested,setNested]=useState(false),[nestedLibrary,setNestedLibrary]=useState(false),[zoom,setZoom]=useState(.25);
  const [block,setBlock]=useState(()=>blockSchema.parse({id:'attachment',type:'attachment',version:1,slideFrame:{x:10,y:10,width:30,height:30,z:0},data:{src:'',fileName:'',size:0}}));
  window.__block=block;window.__setZoom=setZoom;
  const choose=asset=>{window.__selected=asset.id;};
  return <main className="p-5"><div className="mb-8 flex flex-wrap gap-2"><Button onClick={()=>setOpen(true)}>Open media library</Button><Button onClick={()=>setNested(true)}>Open popup editor</Button></div>
    <div data-slide-stage className="relative h-[200px] w-full max-w-[480px] overflow-hidden border bg-slate-100">
      <div data-slide-canvas style={{position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left'}}><div data-slide-object-frame data-slide-object-id="attachment" style={{position:'absolute',left:50,top:70,width:200,height:100}}>Media object</div></div>
      <SlideCanvasMediaReplace block={block} courseId="course" onChange={setBlock}/>
    </div>
    <MediaLibraryDialog courseId="course" kind="attachment" open={open} onClose={()=>setOpen(false)} onSelect={choose}/>
    {nested&&<Dialog open title="Popup editor" onClose={()=>setNested(false)}><Button onClick={()=>setNestedLibrary(true)}>Choose popup media</Button><MediaLibraryDialog courseId="course" kind="attachment" open={nestedLibrary} onClose={()=>setNestedLibrary(false)} onSelect={choose}/></Dialog>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const vite = await createServer({
  configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-media-library-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**"] } },
  plugins: [{ name: "media-library-fixture", resolveId: id => id === "/__media.tsx" ? id : null, load: id => id === "/__media.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/__media") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__media.tsx"></script></body></html>'); return; }
      if (url.pathname === "/api/courses/course/assets") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(url.searchParams.has("cursor") ? { assets: assets.slice(2), nextCursor: null } : { assets: assets.slice(0, 2), nextCursor: "older-files" })); return; }
      if (url.pathname === "/sample.wav" || url.pathname === "/sample.webm") {
        const body = url.pathname.endsWith(".wav") ? wav : video;
        response.setHeader("Content-Type", url.pathname.endsWith(".wav") ? "audio/wav" : "video/webm");
        response.setHeader("Accept-Ranges", "bytes");
        const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        if (range) { response.statusCode = 206; response.setHeader("Content-Range", 'bytes '+start+'-'+end+'/'+body.length); }
        response.setHeader("Content-Length", end - start + 1); response.end(body.subarray(start, end + 1)); return;
      }
      next();
    }); },
  }],
});

let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  video = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 90;
    const context = canvas.getContext("2d"), stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }), chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const done = new Promise(resolve => { recorder.onstop = resolve; });
    let frame = 0;
    const draw = setInterval(() => { context.fillStyle = frame++ % 2 ? "#4338ca" : "#0e7490"; context.fillRect(0, 0, 160, 90); }, 50);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 1600)); recorder.stop(); await done;
    clearInterval(draw); stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
  }));
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  async function play(locator) {
    await locator.evaluate(async player => { player.loop = true; await player.play(); });
    await expect.poll(() => locator.evaluate(player => player.currentTime)).toBeGreaterThan(0);
  }
  async function checkPlayback(library) {
    const clip = library.locator("video").first(), audio = library.locator("audio");
    await expect(library.locator("[data-media-asset-id]")).toHaveCount(4);
    await play(clip); assert.equal(await page.evaluate(() => window.__selected), undefined);
    await play(audio); await expect.poll(() => clip.evaluate(player => player.paused)).toBe(true);
    await library.getByRole("button", { name: "Use Voice.wav", exact: true }).click({ trial: true });
    await audio.evaluate(player => { window.__lastPlayer = player; });
  }
  for (const [width, height] of [[1440, 900], [390, 700], [1280, 600], [320, 480], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.goto(`${origin}/__media`);
    await page.getByRole("button", { name: "Open media library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Media library", exact: true });
    await checkPlayback(library);
    const bounds = await library.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, "The shared library must fit the viewport");
    await library.getByRole("button", { name: "Close media library", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__lastPlayer.paused), true, "Closing must stop detached playback");

    await page.getByRole("button", { name: "Replace media", exact: true }).click();
    const replacement = page.getByRole("dialog", { name: "Replace media", exact: true });
    await checkPlayback(replacement);
    const beforeZoom = await replacement.boundingBox();
    assert.ok(Math.abs(beforeZoom.width - Math.min(1024, width - (width >= 640 ? 48 : 24))) < 2, "Replacement width must use the viewport, not the tiny canvas");
    await page.evaluate(() => window.__setZoom(1.5));
    assert.deepEqual(await replacement.boundingBox(), beforeZoom, "Canvas zoom must not resize the media popup");
    await replacement.getByRole("button", { name: "Close dialog", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__lastPlayer.paused), true, "Embedded playback must stop on close");
  }

  await page.getByRole("button", { name: "Open media library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Media library", exact: true });
  await expect(library.locator("[data-media-asset-id]")).toHaveCount(4);
  await library.getByLabel("Sort media", { exact: true }).selectOption("name-asc");
  assert.deepEqual(await library.locator("[data-media-asset-id]").evaluateAll(elements => elements.map(element => element.dataset.mediaAssetId)), [assets[2].id, assets[0].id, assets[3].id, assets[1].id]);
  await library.getByLabel("Search media", { exact: true }).fill("notes text");
  await expect(library.locator("[data-media-asset-id]")).toHaveCount(1);
  await library.getByLabel("Search media", { exact: true }).fill("");
  await library.getByLabel("Filter media by file type", { exact: true }).selectOption("audio/wav");
  await expect(library.locator("[data-media-asset-id]")).toHaveCount(1);
  await play(library.locator("audio"));
  await library.locator("audio").evaluate(player => { window.__lastPlayer = player; });
  await library.getByRole("button", { name: "Use Voice.wav", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__selected), assets[1].id);
  assert.equal(await page.evaluate(() => window.__lastPlayer.paused), true, "Selecting a file must stop playback");

  await page.getByRole("button", { name: "Open popup editor", exact: true }).click();
  const parent = page.getByRole("dialog", { name: "Popup editor", exact: true });
  await parent.getByRole("button", { name: "Choose popup media", exact: true }).click();
  await expect(library.locator("[data-media-asset-id]")).toHaveCount(4);
  const nestedBounds = await library.boundingBox();
  assert.ok(nestedBounds.width > (await parent.boundingBox()).width, "A nested media library must use the screen width, not the enclosing popup width");
  await library.getByRole("button", { name: "Close media library", exact: true }).click({ trial: true });
  await play(library.locator("audio"));
  await library.locator("audio").evaluate(player => { window.__lastPlayer = player; });
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0); await expect(parent).toBeVisible();
  assert.equal(await page.evaluate(() => window.__lastPlayer.paused), true);
  await parent.getByRole("button", { name: "Choose popup media", exact: true }).click();
  await expect(library.locator("[data-media-asset-id]")).toHaveCount(4);
  await play(library.locator("audio"));
  await library.locator("audio").evaluate(player => { window.__lastPlayer = player; });
  await page.locator("[data-media-library]").click({ position: { x: 2, y: 2 } });
  await expect(library).toHaveCount(0); await expect(parent).toBeVisible();
  assert.equal(await page.evaluate(() => window.__lastPlayer.paused), true, "Backdrop dismissal must pause media and preserve the enclosing popup");
  await parent.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log("Media library browser checks passed: real video/audio playback, one active player, close/selection cleanup, paginated search and sorting, nested Escape, and viewport sizing at five screen sizes and canvas zoom levels.");
} finally { await browser?.close(); await vite.close(); }
