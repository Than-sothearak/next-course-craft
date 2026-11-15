/** Standard content/format section behavior and responsive presentation styling. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ContentBlockEditor } from '/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor.tsx';
import { BlockFormatMenu } from '/app/courses/[courseId]/edit/_components/(editor_client_components)/block-format-menu.tsx';
import { blockSchema } from '/lib/schemas/block.ts';
import '/app/globals.css';
function App() {
  const params = new URLSearchParams(location.search), flip = params.get('block') === 'flipCard', presentation = params.get('mode') === 'slides';
  const [block, setBlock] = useState(() => blockSchema.parse(flip ? { id: 'cards', version: 1, type: 'flipCard', data: { cardsPerRow: 2, cards: [{ id: 'first', frontLabel: 'Question', front: { type: 'text', text: 'What makes a good learning experience?' }, backLabel: 'Answer', back: { type: 'text', text: 'Clear content and useful feedback.' } }, { id: 'second', frontLabel: 'Question', front: { type: 'text', text: 'Try a second question' }, backLabel: 'Answer', back: { type: 'text', text: 'Add your explanation.' } }] } } : { id: 'question', version: 1, type: 'knowledgeCheck', requiredForProgress: true, data: { question: 'Which format works best?', options: ['Standard', 'Presentation'] } }));
  const [changes, setChanges] = useState(0);
  window.__block = block; window.__changes = changes;
  const change = next => { setBlock(next); setChanges(count => count + 1); };
  if (presentation) return <main className="mx-auto max-w-[412px] p-4 text-xs"><ContentBlockEditor block={block} inlineSettings courseId="fixture" lessonBlocks={[block]} onChange={change} onReplaceTemplate={() => {}}/></main>;
  return <main className="mx-auto max-w-4xl p-8 text-slate-700">
    <h1 className="mb-8 text-xl font-semibold">Standard lesson settings</h1>
    <div className="mb-4 flex justify-end"><BlockFormatMenu block={block} onChange={change}/></div>
    <div className="group relative ml-12"><ContentBlockEditor block={block} courseId="fixture" lessonBlocks={[block]} onChange={change} onReplaceTemplate={() => {}}/></div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: 'node_modules/.vite-standard-settings-browser',
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'development' }) },
  resolve: { alias: { '@': process.cwd() } },
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', 'framer-motion', 'zod', 'class-variance-authority', 'clsx', 'tailwind-merge', 'next/image', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-mathematics', '@tiptap/extension-subscript', '@tiptap/extension-superscript', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'] },
  server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.next/**', '**/test-results/**', '**/public/course-export/**'] } },
  plugins: [{
    name: 'standard-settings-fixture',
    resolveId: id => id === '/__settings.tsx' ? id : null,
    load: id => id === '/__settings.tsx' ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/__settings') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__settings.tsx"></script></body></html>');
      });
    },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: 'development' } }; });
  await page.route('https://placehold.co/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="50"><rect width="80" height="50" fill="#e0e7ff"/></svg>' }));
  mkdirSync('test-results', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__settings`);
    await page.getByRole('button', { name: 'Open content settings', exact: true }).click();
    const content = page.getByRole('dialog', { name: 'Content settings', exact: true });
    assert.equal(await content.locator('[data-settings-panel-header]').getByRole('button', { name: 'Show all Content settings', exact: true }).count(), 1);
    assert.equal(await content.locator('[data-settings-panel]').getByRole('button', { name: 'Show all Content settings', exact: true }).count(), 0);
    assert.equal(await content.locator('[data-settings-panel] > [data-inspector-section]').evaluateAll(sections => sections.every(section => getComputedStyle(section).borderTopWidth === '1px' && parseFloat(getComputedStyle(section).borderRadius) > 0)), true);
    await content.getByRole('button', { name: 'Toggle Advanced settings', exact: true }).click();
    const required = content.getByRole('switch', { name: 'Required for progress', exact: true });
    assert.equal(await required.isChecked(), true);
    await required.locator('..').click();
    assert.equal(await page.evaluate(() => window.__block.requiredForProgress), false);
    await content.getByRole('button', { name: 'Hide all Content settings', exact: true }).click();
    assert.equal(await required.isVisible(), false);
    await content.getByRole('button', { name: 'Show all Content settings', exact: true }).click();
    assert.equal(await required.isVisible(), true);
    assert.equal(await page.evaluate(() => window.__changes), 1);
    await content.screenshot({ path: `test-results/standard-content-settings-${width}.png` });
    await page.mouse.click(width - 4, 4);
    assert.equal(await content.count(), 0);
    await page.getByRole('button', { name: 'Format block', exact: true }).click();
    const format = page.getByRole('dialog', { name: 'Block format settings', exact: true });
    assert.equal(await format.locator('[data-settings-panel-header]').getByRole('button', { name: 'Hide all Block format settings', exact: true }).count(), 1);
    assert.equal(await format.locator('[data-settings-panel] > [data-inspector-section]').evaluateAll(sections => sections.every(section => getComputedStyle(section).borderTopWidth === '1px' && parseFloat(getComputedStyle(section).borderRadius) > 0)), true);
    await format.getByRole('button', { name: 'Toggle Advanced settings', exact: true }).focus();
    await page.keyboard.press('Enter');
    await format.getByLabel('Block padding', { exact: true }).selectOption('80');
    assert.equal(await page.evaluate(() => window.__block.blockPadding), 80);
    await format.getByLabel('Background color hex code', { exact: true }).fill('123abc');
    await format.getByLabel('Background color hex code', { exact: true }).press('Tab');
    assert.equal(await page.evaluate(() => window.__block.backgroundColor), '#123abc');
    const bounds = await format.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, viewport: innerWidth, overflow: [...element.querySelectorAll('[data-settings-panel], [data-inspector-section]')].some(child => child.scrollWidth > child.clientWidth + 1) }));
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport, JSON.stringify(bounds));
    assert.equal(bounds.overflow, false, JSON.stringify(bounds));
    assert.equal(await format.getByLabel('Content width', { exact: true }).evaluate(element => getComputedStyle(element).fontSize), '12px');
    await format.screenshot({ path: `test-results/standard-format-settings-${width}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await format.count(), 0);
    await page.getByRole('button', { name: 'Format block', exact: true }).click();
    await format.getByRole('button', { name: 'Toggle Advanced settings', exact: true }).click();
    assert.equal(await format.getByLabel('Block padding', { exact: true }).inputValue(), '80');
    await page.keyboard.press('Escape');
  }
  for (const mode of ['standard', 'slides']) for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__settings?block=flipCard&mode=${mode}`);
    if (mode === 'standard') await page.getByRole('button', { name: 'Open content settings', exact: true }).click();
    const settings = page.locator('[data-flip-card-content-settings]');
    const card = settings.locator('[data-flip-card-settings]').first();
    await card.getByLabel('Card 1 front text', { exact: true }).fill('Updated question');
    const tabs = card.getByRole('tablist', { name: 'Card 1 sides', exact: true });
    await tabs.getByRole('tab', { name: 'Front', exact: true }).focus();
    await page.keyboard.press('End');
    assert.equal(await tabs.getByRole('tab', { name: 'Back', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await card.getByLabel('Card 1 front text', { exact: true }).isVisible(), false);
    await card.getByLabel('Card 1 back text', { exact: true }).fill('Updated explanation');
    await tabs.getByRole('tab', { name: 'Front', exact: true }).click();
    assert.equal(await card.getByLabel('Card 1 front text', { exact: true }).inputValue(), 'Updated question');
    await settings.screenshot({ path: `test-results/flip-card-settings-${mode}-${width}.png` });
    await card.getByLabel('Card 1 front content type', { exact: true }).selectOption('image');
    assert.equal(await card.getByRole('button', { name: 'Choose from media library', exact: true }).isVisible(), true);
    await card.getByLabel('Card 1 front image alternative text', { exact: true }).fill('An illustrated example');
    const overflow = await settings.evaluate(element => [...element.querySelectorAll('details, fieldset, [role="tablist"], [data-inspector-section]')].filter(child => child.getBoundingClientRect().width > 0).some(child => child.scrollWidth > child.clientWidth + 1));
    assert.equal(overflow, false, `${mode} flip-card controls overflow at ${width}px`);
    await card.getByRole('button', { name: 'Toggle Card appearance settings', exact: true }).click();
    await card.getByLabel('Card 1 front background color hex code', { exact: true }).fill('#336699');
    await card.getByLabel('Card 1 front background color hex code', { exact: true }).press('Tab');
    await page.waitForFunction(() => window.__block.data.cards[0].backgroundColor === '#336699');
    const data = await page.evaluate(() => window.__block.data.cards[0]);
    assert.equal(data.front.alt, 'An illustrated example');
    assert.equal(data.back.text, 'Updated explanation');
    await card.getByRole('button', { name: 'Duplicate flip card 1', exact: true }).click();
    assert.equal(await settings.locator('[data-flip-card-settings]').count(), 3);
    const copy = settings.locator('[data-flip-card-settings]').nth(1);
    await copy.locator('summary').click();
    await copy.getByRole('button', { name: 'Delete flip card 2', exact: true }).click();
    assert.equal(await settings.locator('[data-flip-card-settings]').count(), 2);
    await card.getByRole('button', { name: 'Move flip card 1 right', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__block.data.cards.map(card => card.id)), ['second', 'first']);
  }
  assert.deepEqual(errors, []);
  console.log('Settings checks passed at 1440, 390, and 320px: Standard sections and Standard/Presentation flip-card tabs, keyboard, text/image editing, colors, duplication, deletion, reordering, and overflow.');
} finally {
  await browser?.close();
  await vite.close();
}
