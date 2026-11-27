/** Check computed heading sizes in the real block editors against learner preview. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{ContentBlockEditor}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor.tsx';
import{PreviewBlock}from'/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block.tsx';
import{blockSchema}from'/lib/schemas/block.ts';import'/app/globals.css';
const item={id:'one',label:'Label sample',title:'Title sample',body:'Body sample'};
const seeds=[
  {type:'heading',data:{text:'Heading sample',level:3}},
  {type:'richText',data:{html:'<p>Body sample</p>'}},
  {type:'statement',data:{style:'info',title:'Title sample',body:'Body sample'}},
  {type:'accordion',data:{items:[item,{...item,id:'two',title:'Second section'}]}},
  {type:'processSteps',data:{style:'slider',steps:[item,{...item,id:'two',title:'Second step'}]}},
  {type:'timeline',data:{items:[item]}},
];
function Sample({seed}){const[block,setBlock]=useState(()=>blockSchema.parse({id:seed.type,version:1,...seed}));
return <section data-case={seed.type} style={{marginBottom:32}}><div data-author><ContentBlockEditor block={block} courseId="fixture" onChange={setBlock}/></div><div data-preview><PreviewBlock block={block} device="desktop" orientation="landscape"/></div></section>;}
function App(){return <main style={{width:900,padding:20}}>{seeds.map(seed=><Sample key={seed.type} seed={seed}/>)}</main>}
createRoot(document.getElementById('root')).render(<App/>);`;

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: "node_modules/.vite-editor-heading-sizes-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  esbuild: { jsx: "automatic" },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@tiptap/extension-mathematics", "@tiptap/extension-subscript", "@tiptap/extension-superscript", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**"] } },
  plugins: [{
    name: "editor-heading-sizes-fixture",
    resolveId: id => id === "/__heading-sizes.tsx" ? id : null,
    load: id => id === "/__heading-sizes.tsx" ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__heading-sizes") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__heading-sizes.tsx"></script></body></html>');
      });
    },
  }],
});

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__heading-sizes`);
  const fields = [
    ["heading", "Edit heading text", "Heading sample"],
    ["richText", "Edit body text", "Body sample"],
    ["statement", "Statement title", "Title sample"],
    ["statement", "Statement text", "Body sample"],
    ["accordion", "Edit accordion section 1 title", "Title sample"],
    ["accordion", "Edit accordion section 1 explanation", "Body sample"],
    ["processSteps", "Edit process step 1 title", "Title sample"],
    ["processSteps", "Edit process step 1 instructions", "Body sample"],
    ["timeline", "Edit timeline event 1 label", "Label sample"],
    ["timeline", "Edit timeline event 1 title", "Title sample"],
    ["timeline", "Edit timeline event 1 text", "Body sample"],
  ];
  const desktopSizes = [48, 36, 30, 24, 20, 18];
  const popup = page.locator("[data-text-selection-popup]");
  async function expectPopupSize(field, size) {
    await field.scrollIntoViewIfNeeded();
    await field.evaluate(node => {
      node.focus();
      node.editor.commands.setTextSelection({ from: 1, to: 4 });
    });
    await expect(popup.getByLabel("Custom font size in pixels", { exact: true })).toHaveValue(String(size));
    await expect(popup.getByLabel("Font size preset", { exact: true })).toHaveValue(`${size}px`);
  }
  for (const [type, label, text] of fields) {
    const sample = page.locator(`[data-case="${type}"]`);
    const field = sample.locator(`[contenteditable="true"][aria-label="${label}"]`);
    const previewText = sample.locator("[data-preview]").getByText(text, { exact: true }).first();
    await expect(field).toBeAttached();
    if (label === "Statement title" || label === "Edit process step 1 title") {
      await expect(field.locator("p")).toHaveText(text);
      await expect(field.locator("p")).toHaveCSS("font-size", "20px");
      await expect(previewText).toHaveCSS("font-size", "20px");
      await expect(previewText).toHaveJSProperty("tagName", "P");
      // Course body defaults must not change paragraph-based title sizing.
      await sample.evaluate(node => {
        node.setAttribute("data-course-typography", "body leading");
        node.style.setProperty("--course-body-size", "24px");
        node.style.setProperty("--course-body-leading", "2");
      });
      await expect(field.locator("p")).toHaveCSS("font-size", "20px");
      await expect(previewText).toHaveCSS("font-size", "20px");
      await sample.evaluate(node => node.removeAttribute("data-course-typography"));
    }
    // Open the first accordion body in both authoring and preview.
    if (type === "accordion" && label.endsWith("explanation")) {
      const previewToggle = sample.locator('[data-preview] [aria-expanded="false"]').first();
      if (await previewToggle.count()) await previewToggle.click();
    }
    const initialHtml = await field.evaluate(node => node.editor.getHTML());
    const initialSize = await field.locator("p, h1, h2, h3, h4, h5, h6").first().evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
    await expectPopupSize(field, initialSize);
    assert.equal(await field.evaluate(node => node.editor.getHTML()), initialHtml, "Reading the font size must not format the text");
    for (let level = 1; level <= 6; level += 1) {
      await field.evaluate((node, headingLevel) => {
        node.editor.commands.selectAll();
        node.editor.commands.setHeading({ level: headingLevel });
      }, level);
      await expect(field.locator(`h${level}`).first()).toHaveCSS("font-size", `${desktopSizes[level - 1]}px`);
      await expect(previewText).toHaveCSS("font-size", `${desktopSizes[level - 1]}px`);
      await expectPopupSize(field, desktopSizes[level - 1]);
    }
    // Explicit authored sizing must still take precedence over heading defaults.
    await field.evaluate(node => {
      node.editor.commands.selectAll();
      node.editor.commands.setMark("inlineStyle", { fontSize: "37px" });
    });
    await expect(field.locator("span[style*='font-size']")).toHaveCSS("font-size", "37px");
    await expect(previewText).toHaveCSS("font-size", "37px");
    await expectPopupSize(field, 37);
    await field.evaluate(node => {
      node.editor.commands.selectAll();
      node.editor.commands.unsetMark("inlineStyle");
      node.editor.commands.setParagraph();
    });
    await expect(field.locator("p").first()).toHaveText(text);
    if (label === "Statement title" || label === "Edit process step 1 title") {
      await expect(field.locator("p").first()).toHaveCSS("font-size", "20px");
      await expect(previewText).toHaveCSS("font-size", "20px");
    }
    await expect(field.locator("h1, h2, h3, h4, h5, h6")).toHaveCount(0);
  }
  const heading = page.locator('[data-case="heading"] [contenteditable="true"]');
  await heading.evaluate(node => node.editor.commands.setHeading({ level: 1 }));
  await expectPopupSize(heading, 48);
  await heading.evaluate(node => { node.style.transform = "scale(0.5)"; });
  await expectPopupSize(heading, 48);
  await heading.evaluate(node => {
    const sample = node.closest("[data-case]");
    sample.setAttribute("data-course-typography", "title");
    sample.style.setProperty("--course-title-size", "43px");
  });
  await expect(popup.getByLabel("Custom font size in pixels", { exact: true })).toHaveValue("43");
  await expect(popup.getByLabel("Font size preset", { exact: true })).toHaveValue("43px");
  await heading.evaluate(node => node.closest("[data-case]").removeAttribute("data-course-typography"));
  await expect(popup.getByLabel("Custom font size in pixels", { exact: true })).toHaveValue("48");
  await page.setViewportSize({ width: 390, height: 900 });
  await expectPopupSize(heading, 36);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectPopupSize(heading, 48);
  assert.deepEqual(errors, []);
  console.log("Heading and popup font sizes passed across all 11 editable fields: inherited defaults, H1–H6, inline overrides, paragraph restoration, scaled canvases and viewport changes.");
} finally {
  await browser?.close();
  await vite.close();
}
