/** Verify chart theme defaults, per-field colors, persistence, and column label spacing. */
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const fixture = `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';
import{ChartBlockPreview}from'/app/courses/[courseId]/preview/chart-block.tsx';
import{ChartBlockSettings}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/chart-block-settings.tsx';
import{blockTemplates}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import{createBlocksFromTemplate}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';
import{blockSchema}from'/lib/schemas/block.ts';import'/app/globals.css';
const initial=()=>createBlocksFromTemplate(blockTemplates.find(t=>t.id==='chart-columns-quarterly'),'quarterly')[0];
function App(){const[block,setBlock]=useState(()=>blockSchema.parse(JSON.parse(localStorage.getItem('chart')||'null')||initial())),[theme,setTheme]=useState('#24734f');window.__chart=block;useEffect(()=>localStorage.setItem('chart',JSON.stringify(block)),[block]);
return <main style={{padding:20,'--course-primary':theme}}><button onClick={()=>setTheme('#6941c6')}>Change theme</button><div data-settings style={{maxWidth:380}}><ChartBlockSettings block={block} onChange={setBlock}/></div><div data-quarterly style={{maxWidth:900}}><ChartBlockPreview data={block.data}/></div><div data-weekly style={{maxWidth:900}}><ChartBlockPreview data={createBlocksFromTemplate(blockTemplates.find(t=>t.id==='chart-line-trend'),'weekly')[0].data}/></div>{['bar','column','line','donut','stacked'].map(type=><section key={type} data-type={type} style={{maxWidth:900}}><ChartBlockPreview data={{...initial().data,chartType:type,fields:[{id:'theme',label:'Theme',value:20},{id:'custom',label:'Custom',value:30,color:'#cc3344'},{id:'gradient',label:'Gradient',value:50,color:'linear-gradient(90deg, #123456 0%, #abcdef 100%)'}]}}/></section>)}{[[53,28,15],[0,0,0],[100,0,0],[0,0,100],[1,0,2]].map((values,index)=><section key={index} data-donut-case={JSON.stringify(values)}><ChartBlockPreview data={{chartType:'donut',title:'Completion rate',description:'',fields:values.map((value,i)=>({id:String(i),label:'Field '+(i+1),value,color:['#ff0000','#00ff00','#0000ff'][i]}))}}/></section>)}</main>;}createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-chart-browser", root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "chart-fixture", resolveId: (id) => id === "/__chart.tsx" ? id : null, load: (id) => id === "/__chart.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__chart") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__chart.tsx"></script></body></html>'); }); } }] });

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__chart`);
  const columns = page.locator('[data-quarterly] rect');
  await columns.last().waitFor();
  const colorOf = locator => locator.evaluate(node => getComputedStyle(node).fill);
  assert.equal(await colorOf(columns.last()), 'rgb(36, 115, 79)');
  await page.getByRole('button', { name: 'Change theme', exact: true }).click();
  assert.equal(await colorOf(columns.last()), 'rgb(105, 65, 198)');
  await page.getByLabel('Use custom chart field 4 color', { exact: true }).check();
  await page.getByLabel('Chart field 4 color hex code', { exact: true }).fill('#cc3344');
  await expect(columns.last()).toHaveAttribute('fill', '#cc3344');
  assert.equal(await colorOf(columns.first()), 'rgb(105, 65, 198)');
  await page.reload(); await columns.last().waitFor();
  await expect(columns.last()).toHaveAttribute('fill', '#cc3344');
  for (const type of ['column', 'line', 'donut']) {
    const selector = type === 'column' ? 'rect' : type === 'line' ? 'circle' : 'circle:not(:first-of-type)';
    const marks = page.locator(`[data-type="${type}"] ${selector}`);
    assert.equal(await marks.nth(1).getAttribute(type === 'column' ? 'fill' : 'stroke'), '#cc3344');
    const gradient = await marks.nth(2).getAttribute(type === 'column' ? 'fill' : 'stroke');
    assert.ok(gradient.startsWith('url(#'));
    const gradientId = gradient.slice(5, -1);
    assert.equal(await page.locator(`[id="${gradientId}"] stop`).count(), 2);
  }
  for (const type of ['bar','stacked']) {
    const fills = await page.locator(`[data-type="${type}"] span[style]`).evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    assert.ok(fills.includes('rgb(204, 51, 68)'));
    assert.ok(await page.locator(`[data-type="${type}"] span[style*="linear-gradient"]`).count());
  }
  for (const width of [1400, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const group of await page.locator('[data-weekly] g, [data-type="line"] g').all()) {
      const bounds = await group.evaluate(node => {
        const circle = node.querySelector('circle'), label = node.querySelector('text');
        const svg = node.closest('svg');
        const scale = Math.abs(svg.getScreenCTM().a);
        return {
          gap: circle.getBoundingClientRect().top - Number(circle.getAttribute('stroke-width')) / 2 * scale - label.getBoundingClientRect().bottom,
          labelTop: label.getBoundingClientRect().top,
          chartTop: svg.getBoundingClientRect().top,
        };
      });
      assert.ok(bounds.gap > 2, `Line values need space above the point including its stroke at ${width}px, got ${bounds.gap}`);
      assert.ok(bounds.labelTop >= bounds.chartTop, 'Highest line value must remain inside the chart');
    }
    for (const group of await page.locator('[data-quarterly] g').all()) {
      const gap = await group.evaluate(node => node.querySelector('rect').getBoundingClientRect().top - node.querySelector('text').getBoundingClientRect().bottom);
      assert.ok(gap > 1, `Column label needs visible space at ${width}px, got ${gap}`);
    }
  }
  await page.getByLabel('Use custom chart field 4 color', { exact: true }).uncheck();
  assert.equal(await colorOf(columns.last()), 'rgb(36, 115, 79)');
  for (const section of await page.locator('[data-donut-case]').all()) {
    const mismatches = await section.evaluate(async node => {
      const values = JSON.parse(node.getAttribute('data-donut-case'));
      const total = values.reduce((sum, value) => sum + value, 0);
      const svg = node.querySelector('svg').cloneNode(true);
      svg.removeAttribute('class');
      svg.setAttribute('width', '160'); svg.setAttribute('height', '160');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'}));
      const image = new Image(); image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const colors = [[255,0,0],[0,255,0],[0,0,255]];
      const failures = [];
      const boundaries = [0];
      values.forEach(value => boundaries.push(boundaries.at(-1) + (total ? value / total * 360 : 0)));
      for (let angle = 0.5; angle < 360; angle += 1) {
        if (boundaries.some(boundary => Math.min(Math.abs(angle-boundary), 360-Math.abs(angle-boundary)) < 1)) continue;
        const index = boundaries.findIndex((boundary, i) => i > 0 && angle < boundary) - 1;
        const expected = total ? colors[index] : [241,245,249];
        for (const radius of [54,62,70]) {
          const radians = angle * Math.PI / 180;
          const pixel = context.getImageData(Math.floor(80 + radius * Math.cos(radians)), Math.floor(80 + radius * Math.sin(radians)), 1, 1).data;
          if (expected.some((channel, i) => Math.abs(channel - pixel[i]) > 8)) failures.push({angle,radius,pixel:Array.from(pixel),expected});
        }
      }
      return failures;
    });
    assert.deepEqual(mismatches, [], `Donut segments must cover the correct portion of the ring: ${await section.getAttribute('data-donut-case')}`);
  }
  assert.deepEqual(errors, []);
  console.log('Chart browser checks passed: live theme defaults, field colors/gradients in all five styles, settings and reload, resets, and column/line label spacing on desktop/mobile.');
} finally { await browser?.close(); await vite.close(); }
