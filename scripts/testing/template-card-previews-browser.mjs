import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{BlockTemplatePicker}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/block-template-picker.tsx';
import'/app/globals.css';
function App(){const[selected,setSelected]=useState('');return <main data-course-typography="subtitle body leading alignment" style={{'--course-subtitle-size':'64px','--course-body-size':'40px','--course-body-leading':'2','--course-title-align':'center'}}><output data-selected className="sr-only">{selected}</output><BlockTemplatePicker open standardOnly initialCategory="Diagram" onClose={()=>{}} onSelect={template=>setSelected(template.id)}/></main>};
createRoot(document.getElementById('root')).render(<App/>);`;

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: "node_modules/.vite-template-previews-browser",
  esbuild: { jsx: "automatic" },
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "zod", "katex", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "next/link", "@tiptap/react", "@tiptap/core", "@tiptap/pm/state", "@tiptap/pm/view", "@tiptap/pm/history", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@tiptap/extension-mathematics", "@tiptap/extension-superscript", "@tiptap/extension-subscript"] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "template-preview-fixture",
    resolveId: (id) => id === "/__template-previews.tsx" ? id : null,
    load: (id) => id === "/__template-previews.tsx" ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__template-previews") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__template-previews.tsx"></script></body></html>');
      });
    },
  }],
});

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  page.on("console", (message) => { if (message.type() === "error") console.error(message.text()); });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__template-previews`);
  const screenshotDirectory = process.env.TEMPLATE_PREVIEW_SCREENSHOTS;
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
  const measurements = [];

  for (const width of [1280, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const category of ["Diagram", "Statement", "Chart", "Formula", "Table", "Code", "Link"]) {
      await page.getByRole("navigation", { name: "Block categories" }).getByRole("button", { name: category, exact: true }).click();
      await page.getByRole("heading", { name: `${category} templates` }).waitFor();
      const cards = await page.locator("[data-template-card]").evaluateAll((elements) => elements.map((element) => {
        const preview = element.firstElementChild.firstElementChild;
        const bounds = preview.getBoundingClientRect();
        return { id: element.dataset.templateCard, height: bounds.height, width: bounds.width, overflow: preview.scrollWidth - preview.clientWidth, verticalOverflow: preview.scrollHeight - preview.clientHeight };
      }));
      assert.ok(cards.length > 0);
      for (const card of cards) {
        assert.ok(card.height <= 176, `${width}px ${card.id} is too tall: ${card.height}px`);
        assert.ok(card.overflow <= 1, `${width}px ${card.id} overflows horizontally by ${card.overflow}px`);
        assert.ok(card.verticalOverflow <= 1, `${width}px ${card.id} overflows vertically by ${card.verticalOverflow}px`);
        assert.ok(card.width >= 180, `${width}px ${card.id} is squeezed to ${card.width}px`);
      }
      measurements.push({ width, category, maxHeight: Math.round(Math.max(...cards.map((card) => card.height))) });

      if (category === "Link") {
        const links = await page.locator("[data-template-link-preview]").evaluateAll((elements) => elements.map((element) => ({
          label: getComputedStyle(element.querySelector("[data-template-link-label]")).fontSize,
          description: element.querySelector("[data-template-link-description]") ? getComputedStyle(element.querySelector("[data-template-link-description]")).fontSize : null,
          interactiveChild: Boolean(element.querySelector("a, button, input")),
        })));
        assert.equal(links.length, 3);
        for (const link of links) {
          assert.equal(link.label, "11px");
          if (link.description) assert.equal(link.description, "10px");
          assert.equal(link.interactiveChild, false);
        }
      }

      if (category === "Statement") {
        const sizes = await page.locator("[data-template-statement-preview]").first().evaluate((element) => ({
          title: getComputedStyle(element.querySelector("h3")).fontSize,
          body: getComputedStyle(element.querySelector("p")).fontSize,
        }));
        assert.deepEqual(sizes, { title: "13px", body: "11px" });
      }
      if (category === "Code") {
        const sizes = await page.locator("[data-template-code-preview]").evaluateAll((elements) => elements.map((element) => ({
          code: getComputedStyle(element.querySelector("pre")).fontSize,
          title: element.querySelector("h2") ? getComputedStyle(element.querySelector("h2")).fontSize : null,
          overflow: element.querySelector("pre").scrollWidth - element.querySelector("pre").clientWidth,
        })));
        for (const size of sizes) {
          assert.equal(size.code, "9px");
          if (size.title) assert.equal(size.title, "12px");
          assert.ok(size.overflow <= 1, "The code sample should fit without horizontal scrolling");
        }
      }
      if (screenshotDirectory && [1280, 390].includes(width)) {
        await page.screenshot({ path: path.join(screenshotDirectory, `${width}-${category.toLowerCase()}.png`) });
      }
      const firstCard = page.locator("[data-template-card]").first();
      const selectedId = await firstCard.getAttribute("data-template-card");
      await firstCard.focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("[data-selected]").textContent(), selectedId);
    }
  }
  assert.deepEqual(errors, []);
  console.log("Template card browser checks passed: compact height, responsive width, no overflow, preview fonts, and keyboard insertion.");
  console.table(measurements);
} finally {
  await browser?.close();
  await vite.close();
}
