/** Verify quote/statement defaults and custom formatting in the real editor and preview. */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';
import{StatementContentEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/statement-content-editor.tsx';
import{StatementBlockPreview}from'/app/courses/[courseId]/edit/_components/statement-block-preview.tsx';
import{RichTextBlockEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/rich-text-block-editor.tsx';
import{StatementTextPreview}from'/app/courses/[courseId]/edit/_components/statement-text-preview.tsx';
import{blockTemplates}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import{createBlocksFromTemplate}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';import'/app/globals.css';
const templates=blockTemplates.filter(t=>['Statement','Quote'].includes(t.category));
createRoot(document.getElementById('root')).render(<main style={{color:'#315947','--course-primary':'#b43265'}}>{templates.map(t=>{const b=createBlocksFromTemplate(t,t.id)[0];return <section key={b.id} data-template={b.id}><div data-editor>{b.type==='statement'?<StatementContentEditor block={b} onChange={()=>{}}/>:<RichTextBlockEditor block={b} onChange={()=>{}}/>}</div><div data-preview>{b.type==='statement'?<StatementBlockPreview {...b.data}/>:<StatementTextPreview html={b.data.html} text="" tag="p" className=""/>}</div></section>})}<div data-custom><StatementBlockPreview style="key" title="Title" body="Body" titleHtml='<h3><span style="font-size: 40px; color: #ff0000">Custom</span></h3>'/></div></main>);`;
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-quote-statement-browser", root: process.cwd(), define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/core", "@tiptap/pm/state", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "quote-statement-fixture", resolveId: (id) => id === "/__quote-statement.tsx" ? id : null, load: (id) => id === "/__quote-statement.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__quote-statement") return next(); response.setHeader("Content-Type", "text/html"); response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__quote-statement.tsx"></script></body></html>'); }); } }] });

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__quote-statement`);
  await page.locator('[data-custom] .tiptap span').waitFor();
  for (const section of await page.locator('[data-template]').all()) {
    for (const scope of ['data-editor', 'data-preview']) {
      const result = await section.locator(`[${scope}]`).evaluate(node => {
        const quote = node.querySelector('blockquote');
        const title = quote?.querySelector('p') ?? node.querySelector('h3');
        const body = quote?.querySelector('p + p') ?? node.querySelector('p');
        return { title: getComputedStyle(title).fontSize, body: getComputedStyle(body).fontSize, color: getComputedStyle(title).color, border: quote ? getComputedStyle(quote).borderInlineStartColor : null };
      });
      assert.equal(result.title, '28px');
      assert.equal(result.body, '16px');
      assert.equal(result.color, 'rgb(49, 89, 71)');
      if (result.border) assert.equal(result.border, 'rgb(180, 50, 101)');
    }
  }
  assert.deepEqual(await page.locator('[data-custom] span').evaluate(node => ({size:getComputedStyle(node).fontSize,color:getComputedStyle(node).color})), {size:'40px',color:'rgb(255, 0, 0)'});
  assert.deepEqual(errors, []);
  console.log('Quote and statement browser checks passed: 28px/16px defaults, inherited theme text, theme accent, editor/preview parity, and custom formatting.');
} finally { await browser?.close(); await vite.close(); }
