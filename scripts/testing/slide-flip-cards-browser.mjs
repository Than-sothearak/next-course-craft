/** Real canvas editing, responsive card geometry, media, and learner flip checks. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SlideObject}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object.tsx';
import{ContentBlockEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor.tsx';
import{BlockTemplatePicker}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/block-template-picker.tsx';
import{PreviewBlock}from'/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block.tsx';
import{blockTemplates}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import{createSlideBlocksFromTemplate}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';
import{slideFrameStyle}from'/lib/editor/slide-design.ts';import'/app/globals.css';
function App(){const[zoom,setZoom]=useState(1),[preview,setPreview]=useState(false),[revealed,setRevealed]=useState([]),[stylePicker,setStylePicker]=useState(false),[block,setBlock]=useState(()=>({...createSlideBlocksFromTemplate(blockTemplates.find(t=>t.id==='interactive-reveal'),'cards')[0],slideFrame:{x:10,y:15,width:78,height:65,z:0}}));window.__block=block;window.__setBlock=setBlock;window.__revealed=revealed;
return <main style={{padding:20}}><nav style={{display:'flex',gap:12,marginBottom:12}}>{[.5,1,1.5].map(z=><button key={z} onClick={()=>setZoom(z)}>Zoom {z}</button>)}<button onClick={()=>setPreview(p=>!p)}>{preview?'Editor':'Learner'}</button></nav>
<div style={{display:'flex',gap:20,alignItems:'flex-start'}}><div data-slide-stage style={{position:'relative',width:960*zoom,height:540*zoom,flexShrink:0}}><div data-slide-canvas data-slide-objects style={{position:'relative',width:960,height:540,transform:'scale('+zoom+')',transformOrigin:'top left',background:'#e2e8f0'}}>{preview?<div data-learner-object style={{position:'absolute',...slideFrameStyle(block.slideFrame)}}><PreviewBlock block={block} slideLayout device="desktop" orientation="landscape" onInteractiveProgress={id=>setRevealed(ids=>[...new Set([...ids,id])])}/></div>:<SlideObject block={block} courseId="course" index={0} total={1} area={{width:960,height:540}} selected onSelect={()=>{}} onFrame={slideFrame=>setBlock(b=>({...b,slideFrame}))} onChange={setBlock} onEditorFocus={()=>{}}/>}</div></div>
<aside style={{width:380,maxHeight:720,overflowY:'auto',flexShrink:0}}><ContentBlockEditor block={block} courseId="course" inlineSettings onChange={setBlock} onReplaceTemplate={()=>setStylePicker(true)}/></aside></div><BlockTemplatePicker open={stylePicker} mode="replace" initialCategory="Interactive" onClose={()=>setStylePicker(false)} onSelect={()=>setStylePicker(false)}/></main>};createRoot(document.getElementById('root')).render(<App/>);`;

const vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-flip-cards-browser", define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "flip-cards-fixture", resolveId: (id) => id === "/__flip-cards.tsx" ? id : null, load: (id) => id === "/__flip-cards.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => {
  if (request.url === "/__flip-cards") { response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__flip-cards.tsx"></script></body></html>'); return; }
  if (request.url === "/api/courses/course/assets") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ assets: [{ id: "aaaaaaaaaaaaaaaaaaaaaaaa", originalName: "Card.png", contentType: "image/png", size: 100, createdAt: "2026-01-01", fileUrl: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file" }] })); return; }
  if (request.url === "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file") { response.setHeader("Content-Type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#2563eb"/></svg>'); return; }
  next();
}); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2100, height: 1150 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__flip-cards`);
  await page.waitForFunction(() => window.__block?.data.cards.length === 3);
  await page.evaluate(() => document.fonts.ready);
  const original = await page.evaluate(() => window.__block);
  const originalIds = original.data.cards.map((card) => card.id);
  async function fit() {
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const result = await page.locator('[data-slide-flip-card-editor]').evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll('[data-flip-card-id]')].map((card) => card.getBoundingClientRect().toJSON());
      return { frame: frame.toJSON(), cards };
    });
    for (const card of result.cards) { assert.ok(card.left >= result.frame.left - 1); assert.ok(card.right <= result.frame.right + 1); assert.ok(card.top >= result.frame.top - 1); assert.ok(card.bottom <= result.frame.bottom + 1); }
    assert.ok(result.cards.every((card) => Math.abs(card.width - result.cards[0].width) < 1 && Math.abs(card.height - result.cards[0].height) < 1));
  }
  for (const zoom of [.5, 1.5, 1]) {
    await page.getByRole('button', { name: `Zoom ${zoom}`, exact: true }).click(); await fit();
    const field = page.getByLabel('Canvas card 2 front text', { exact: true });
    await field.fill(`Question at zoom ${zoom}`);
    await page.waitForFunction((text) => window.__block.data.cards[1].front.text === text, `Question at zoom ${zoom}`);
    assert.deepEqual(await page.evaluate(() => window.__block.slideFrame), original.slideFrame);
    const action = await page.getByRole('button', { name: 'Duplicate selected card', exact: true }).boundingBox();
    const card = await page.locator('[data-flip-card-id]').nth(1).boundingBox();
    assert.ok(Math.abs(action.y - (card.y + card.height)) < 120 || action.y < card.y, JSON.stringify({ zoom, action, card }));
  }
  const beforeStylePicker = await page.evaluate(() => JSON.stringify(window.__block));
  await page.getByRole('button', { name: 'Change block style', exact: true }).click();
  const styleDialog = page.getByRole('dialog', { name: 'Change block template', exact: true });
  await styleDialog.waitFor({ state: 'visible' });
  const cardToolbar = page.locator('[role="toolbar"][aria-label="Selected flip card actions"]');
  await cardToolbar.waitFor({ state: 'hidden' });
  assert.equal(await cardToolbar.evaluate((toolbar) => toolbar.hidden && getComputedStyle(toolbar).display === 'none'), true, 'Card actions must be hidden while the block style picker is open');
  await page.getByRole('button', { name: 'Close block picker', exact: true }).click();
  await styleDialog.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__block)), beforeStylePicker);
  await page.getByRole('toolbar', { name: 'Selected flip card actions', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Edit card back', exact: true }).click();
  await page.getByLabel('Canvas card 2 back text', { exact: true }).fill('Back edited directly');
  await page.getByRole('button', { name: 'Duplicate selected card', exact: true }).click();
  await page.waitForFunction(() => window.__block.data.cards.length === 4);
  const copied = await page.evaluate(() => window.__block.data.cards[2]);
  assert.ok(!originalIds.includes(copied.id)); assert.equal(copied.back.text, 'Back edited directly');
  await page.getByRole('button', { name: 'Move selected card right', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__block.data.cards[3].id), copied.id);
  await page.getByRole('button', { name: 'Replace selected card image', exact: true }).click();
  await page.getByRole('button', { name: 'Use Card.png', exact: true }).click();
  await page.waitForFunction(() => window.__block.data.cards[3].front.type === 'image');
  await page.getByLabel('Flip card grid mode').selectOption('custom'); await page.getByLabel('Cards per row', { exact: true }).selectOption('2');
  await fit();
  const handle = page.getByRole('button', { name: 'Reorder flip card 1', exact: true });
  await handle.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(100);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForFunction((id) => window.__block.data.cards[1].id === id, originalIds[0]);
  await page.getByLabel('Card background color hex code', { exact: true }).fill('#112233');
  const secondDetails = page.locator('[data-flip-card-settings] details').nth(1);
  if (await secondDetails.getAttribute('open') === null) await secondDetails.locator('summary').click();
  await page.getByLabel('Card 2 background color hex code', { exact: true }).fill('#ff8800');
  assert.equal(await page.locator('[data-flip-card-id]').nth(1).evaluate((card) => getComputedStyle(card).backgroundColor), 'rgb(255, 136, 0)');
  await page.getByRole('button', { name: 'Use master colors for card 2', exact: true }).click();
  assert.equal(await page.locator('[data-flip-card-id]').nth(1).evaluate((card) => getComputedStyle(card).backgroundColor), 'rgb(17, 34, 51)');
  for (const details of await page.locator('[data-flip-card-settings] details').all()) if (await details.getAttribute('open') !== null) await details.locator('summary').click();
  const firstHandle = page.getByRole('button', { name: 'Reorder flip card 1', exact: true }), secondHandle = page.getByRole('button', { name: 'Reorder flip card 2', exact: true });
  await firstHandle.scrollIntoViewIfNeeded();
  const from = await firstHandle.boundingBox(), to = await secondHandle.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 7, from.y + from.height / 2, { steps: 2 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction((id) => window.__block.data.cards[0].id === id, originalIds[0]);
  await page.waitForTimeout(100);
  await page.getByLabel('Card text color hex code', { exact: true }).fill('#ffffff');
  await page.getByRole('button', { name: 'Learner', exact: true }).click();
  await page.locator('[data-learner-object]').getByRole('button', { name: 'Flip card 1 to reveal the back', exact: true }).click();
  await page.waitForFunction(() => window.__revealed.length === 1);
  const learner = await page.locator('[data-learner-object] [data-flip-card-grid]').evaluate((grid) => ({ width: grid.clientWidth, height: grid.clientHeight, columns: grid.dataset.flipCardColumns }));
  assert.equal(learner.columns, '2'); assert.ok(learner.height > 300);
  mkdirSync('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/slide-flip-cards-learner.png' });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await page.getByLabel('Canvas card 2 front text', { exact: true }).fill('A long explanation. '.repeat(80));
  const textField = page.getByLabel('Canvas card 2 front text', { exact: true });
  assert.ok(await textField.evaluate((element) => element.scrollHeight > element.clientHeight));
  await fit(); await page.screenshot({ path: 'test-results/slide-flip-cards-editor.png' });
  await page.evaluate(() => window.__setBlock((block) => ({ ...block, slideFrame: { ...block.slideFrame, width: 24, height: 26 }, data: { ...block.data, presentationLayout: { ...block.data.presentationLayout, mode: 'auto' }, cards: Array.from({ length: 12 }, (_, index) => ({ ...block.data.cards[0], id: 'dense-' + index })) } })));
  await page.waitForFunction(() => window.__block.data.cards.length === 12); await fit();
  mkdirSync('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/slide-flip-cards.png' });
  assert.deepEqual(errors, []);
  console.log('Flip-card browser checks passed: direct front/back editing, stable object geometry at 50/100/150% zoom, nearby toolbar, duplication, ordering, owned media, master and individual colors, responsive grids, dense fitting, and learner reveal.');
} finally { await browser?.close(); await vite.close(); }
