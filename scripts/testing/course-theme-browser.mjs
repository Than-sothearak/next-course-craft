/** Theme/gradient authoring and compiled HTML/SCORM typography. Build export first. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{CourseThemeSettings}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/course-theme-settings.tsx';
import{StandardLessonEditor}from'/app/courses/[courseId]/edit/standard-mode/_components/standard-lesson-editor.tsx';
import{PreviewBlock}from'/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block.tsx';
import{CoursePreview}from'/app/courses/[courseId]/preview/course-preview.tsx';
import{CourseThemeContext}from'/lib/editor/course-theme-context.ts';
import{defaultCourseTheme,courseTypographyAttributes}from'/lib/editor/theme.ts';
import{editorSnapshotSchema}from'/lib/editor/schemas.ts';import'/app/globals.css';
const initial=editorSnapshotSchema.parse({title:'Theme defaults',description:'',revision:0,sections:[{id:'s',title:'Learn',order:0}],lessons:[{id:'l',sectionId:'s',title:'Lesson title',order:0,blocks:[
{id:'h1',version:1,type:'heading',data:{text:'Title sample',level:1}},
{id:'h2',version:1,type:'heading',data:{text:'Subtitle sample',level:2}},
{id:'h3',version:1,type:'heading',data:{text:'Heading sample',level:3}},
{id:'text',version:1,type:'richText',data:{html:'<p>Body sample</p><p><span style="font-size:30px">Authored size</span></p><p><span style="font-size:27px">Authored paragraph</span></p>'}},
{id:'gradient',version:1,type:'richText',data:{html:'<p>Gradient surface</p>'}}]}]});
function App(){const[theme,setTheme]=useState(()=>JSON.parse(localStorage.getItem('theme-test')||'null')||defaultCourseTheme),[lesson,setLesson]=useState(initial.lessons[0]);
const change=next=>{setTheme(next);localStorage.setItem('theme-test',JSON.stringify(next));};
window.__theme=theme;window.__snapshot={...initial,theme,lessons:[lesson]};
if(new URLSearchParams(location.search).has('preview'))return <CoursePreview initialData={{...window.__snapshot,courseId:'theme-preview'}} initialLessonId="l" authorName="Author"/>;
return <CourseThemeContext.Provider value={theme}><main {...courseTypographyAttributes(theme)} className="p-4"><header className="sticky top-0 z-50 mb-4 flex justify-end bg-white p-2"><CourseThemeSettings theme={theme} onChange={change} courseId="fixture" courseTitle="Theme defaults"/></header>
<section data-author><StandardLessonEditor lesson={lesson} courseId="fixture" sections={initial.sections} lessons={[lesson]} saveState="saved" hasUnsavedChanges={false} saveMessage="" onRetrySave={()=>{}} onTitleChange={()=>{}} onTitleValidityChange={()=>{}} onReorderBlocks={()=>{}} onAddBlock={()=>{}} onMoveBlock={()=>{}} onDuplicateBlock={()=>{}} onDeleteBlock={()=>{}} onChangeBlock={(id,next)=>setLesson(current=>({...current,blocks:current.blocks.map(block=>block.id===id?next:block)}))} onReplaceTemplate={()=>{}}/></section>
<section data-preview className="mt-8">{lesson.blocks.map(block=><PreviewBlock key={block.id} block={block} device="desktop" orientation="landscape"/>)}</section></main></CourseThemeContext.Provider>};createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: 'node_modules/.vite-course-theme-browser', define: { 'process.env': JSON.stringify({ NODE_ENV: 'development' }) }, resolve: { alias: { '@': process.cwd() } }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', 'framer-motion', 'zod', 'class-variance-authority', 'clsx', 'tailwind-merge', 'next/image', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-mathematics', '@tiptap/extension-subscript', '@tiptap/extension-superscript', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'] }, server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.next/**', '**/test-results/**', '**/public/course-export/**'] } }, plugins: [{ name: 'theme-fixture', resolveId: id => id === '/__theme.tsx' ? id : null, load: id => id === '/__theme.tsx' ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url?.split('?')[0] !== '/__theme') return next(); response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__theme.tsx"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: 'development' } }; });
  const url = `http://127.0.0.1:${vite.httpServer.address().port}/__theme`;
  await page.goto(url);
  await page.getByLabel('Course theme settings', { exact: true }).click();
  const panel = page.locator('[data-course-theme-settings]');
  await panel.getByRole('button', { name: 'Toggle Advanced settings', exact: true }).click();
  for (const [label, value] of [['Default title size', '40'], ['Default subtitle size', '26'], ['Default heading size', '20'], ['Default normal text size', '18'], ['Default text line spacing', '1.6']]) {
    await panel.getByLabel(label, { exact: true }).fill(value);
    await panel.getByLabel(label, { exact: true }).press('Tab');
  }
  await panel.getByRole('button', { name: 'Default title alignment: Center', exact: true }).click();
  await panel.getByRole('button', { name: 'Use Forest theme', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__theme.typography.bodySize), 18);
  mkdirSync('test-results', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.getByRole('button', { name: 'Toggle Palette & colors settings', exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await panel.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
    await panel.screenshot({ path: `test-results/course-theme-settings-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Course theme settings', { exact: true }).click();
  const author = page.locator('[data-author]'), preview = page.locator('[data-preview]');
  for (const scope of [author, preview]) {
    for (const [text, size] of [['Title sample', '40px'], ['Subtitle sample', '26px'], ['Heading sample', '20px'], ['Body sample', '18px'], ['Authored size', '30px'], ['Authored paragraph', '27px']]) await expect(scope.getByText(text, { exact: true })).toHaveCSS('font-size', size);
    await expect(scope.getByText('Title sample', { exact: true })).toHaveCSS('text-align', 'center');
    await expect(scope.getByText('Body sample', { exact: true })).toHaveCSS('line-height', '28.8px');
  }
  const gradientBlock = author.locator('[data-editor-block-id="gradient"]');
  await gradientBlock.hover();
  await gradientBlock.getByRole('button', { name: 'Format block', exact: true }).click();
  const format = page.getByRole('dialog', { name: 'Block format settings', exact: true });
  await format.getByRole('button', { name: 'Use theme brand to accent background', exact: true }).click();
  await format.getByLabel('Choose background color end hex code', { exact: true }).fill('#fedcba');
  await format.getByLabel('Choose background color end hex code', { exact: true }).press('Tab');
  await page.keyboard.press('Escape');
  const snapshot = await page.evaluate(() => window.__snapshot);
  assert.equal(snapshot.lessons[0].blocks.at(-1).backgroundColor, 'linear-gradient(90deg, #24734f 0%, #fedcba 100%)');
  assert.equal(await gradientBlock.locator('[style*="background-image"]').evaluate(element => getComputedStyle(element).backgroundImage.includes('linear-gradient')), true);
  const previewColor = await preview.getByText('Gradient surface', { exact: true }).evaluate(element => getComputedStyle(element).color);
  await expect(gradientBlock.getByText('Gradient surface', { exact: true })).toHaveCSS('color', previewColor);
  await page.reload();
  await expect(page.locator('[data-author]').getByText('Body sample', { exact: true })).toHaveCSS('font-size', '18px');
  await page.goto(`${url}?preview`);
  await expect(page.getByText('Body sample', { exact: true })).toHaveCSS('font-size', '18px');
  const { editorSnapshotSchema } = await vite.ssrLoadModule('/lib/editor/schemas.ts');
  const { inlineLocalFontAssets } = await vite.ssrLoadModule('/lib/export/inline-font-assets.ts');
  const data = editorSnapshotSchema.parse(snapshot);
  const directory = resolve('public/course-export/assets'), files = readdirSync(directory);
  const js = readFileSync(resolve(directory, files.find(file => file.endsWith('.js'))), 'utf8');
  const css = await inlineLocalFontAssets(readFileSync(resolve(directory, files.find(file => file.endsWith('.css'))), 'utf8'), directory);
  for (const format of ['html', 'scorm12', 'scorm2004']) {
    const file = resolve(`test-results/course-theme-${format}.html`);
    writeFileSync(file, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=' + JSON.stringify({ ...data, courseId: `theme-${format}`, scorm12Enabled: format === 'scorm12', scorm2004Enabled: format === 'scorm2004' }).replaceAll('<', '\u003c') + '</script><script>' + js + '</script></body></html>');
    const offline = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const requests = [];
    offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    offline.on('pageerror', error => errors.push(error.message));
    await offline.goto(pathToFileURL(file).href);
    await offline.getByRole('button', { name: 'Start learning', exact: true }).click();
    for (const [text, size] of [['Title sample', '40px'], ['Subtitle sample', '26px'], ['Heading sample', '20px'], ['Body sample', '18px'], ['Authored size', '30px'], ['Authored paragraph', '27px']]) await expect(offline.getByText(text, { exact: true })).toHaveCSS('font-size', size);
    await expect(offline.getByText('Title sample', { exact: true })).toHaveCSS('text-align', 'center');
    assert.equal(await offline.getByText('Gradient surface', { exact: true }).evaluate(element => { for (let node = element; node; node = node.parentElement) if (node.style.backgroundImage.includes('linear-gradient')) return true; return false; }), true);
    await offline.setViewportSize({ width: 390, height: 900 });
    await expect(offline.getByText('Body sample', { exact: true })).toHaveCSS('font-size', '16px');
    await expect(offline.getByText('Title sample', { exact: true })).toHaveCSS('font-size', '22px');
    assert.deepEqual(requests, []);
    await offline.close();
  }
  assert.deepEqual(errors, []);
  console.log('Theme checks passed: responsive settings, live defaults, inline overrides, theme gradient presets, reload, preview, and compiled HTML/SCORM typography without network requests.');
} finally { await browser?.close(); await vite.close(); }
