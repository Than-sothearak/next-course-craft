import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{ResponsiveBlockText}from'/components/responsive-block-text.tsx';import'/app/globals.css';
function App(){const[expanded,setExpanded]=useState(false);return <div data-preview-screen><ResponsiveBlockText>
<h1 style={{fontSize:48}}>Course <span>heading</span></h1><ul><li style={{fontSize:72}}><p><strong>List title</strong></p><p><span style={{fontSize:20}}>Supporting text</span></p></li></ul>
<div data-block-text-role="title"><p data-formatted-title style={{fontSize:72}}>Formatted title <em>with formatting</em></p></div>
<section data-interactive-block><h3 data-interactive-title style={{fontSize:48}}>Interactive title</h3><p data-interactive-body style={{fontSize:36}}>Interactive body <strong>with formatting</strong></p></section>
<button style={{fontSize:16}} onClick={()=>setExpanded(value=>!value)}>Reveal explanation</button>
{expanded&&<p data-explanation style={{fontSize:24}}>New content <span>inherits its font size</span></p>}
<small style={{fontSize:10}}>Small caption</small><div data-block-text-canvas><h2 style={{fontSize:40}}>Scaled slide</h2></div>
</ResponsiveBlockText></div>};createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({
  configFile: false, root: process.cwd(), esbuild: { jsx: "automatic" },
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "mobile-text-fixture", resolveId: (id) => id === "/__mobile-text.tsx" ? id : null,
    load: (id) => id === "/__mobile-text.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      if (request.url !== "/__mobile-text") return next();
      response.setHeader("Content-Type", "text/html");
      response.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__mobile-text.tsx"></script></body></html>');
    }); },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__mobile-text`);
  await page.waitForSelector("[data-mobile-block-text]");
  const sizes = () => page.evaluate(() => Object.fromEntries(["h1", "h1 span", "[data-formatted-title]", "[data-formatted-title] em", "[data-interactive-title]", "[data-interactive-body]", "[data-interactive-body] strong", "li", "strong", "li span", "button", "small", "h2", "[data-explanation]", "[data-explanation] span"].map(selector => {
    const element = document.querySelector(selector);
    return [selector, element ? Number.parseFloat(getComputedStyle(element).fontSize) : null];
  })));
  let result = await sizes();
  assert.equal(result.h1, 22);
  assert.equal(result["h1 span"], 22);
  assert.equal(result["[data-formatted-title]"], 22);
  assert.equal(result["[data-formatted-title] em"], 22);
  assert.equal(result["[data-interactive-title]"], 18);
  assert.equal(result["[data-interactive-body]"], 14);
  assert.equal(result["[data-interactive-body] strong"], 14);
  assert.equal(result.li, 16);
  assert.equal(result.strong, 16);
  assert.equal(result["li span"], 16);
  assert.equal(result.button, 16);
  assert.equal(result.small, 10);
  assert.equal(result.h2, 40);
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-explanation]")).fontSize === "16px");
  result = await sizes();
  assert.equal(result["[data-explanation] span"], 16);
  assert.equal(result.h1, 22, "Nested updates must not compound scaling");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForFunction(() => !document.querySelector("[data-mobile-block-text]"));
  result = await sizes();
  assert.equal(result.h1, 48);
  assert.equal(result.strong, 72);
  assert.equal(result["[data-interactive-title]"], 48);
  assert.equal(result["[data-interactive-body]"], 36);
  await page.setViewportSize({ width: 640, height: 800 });
  await page.waitForSelector("[data-mobile-block-text]");
  assert.equal((await sizes()).h1, 22);
  // A framed phone preview on a desktop must use its screen's width.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.locator("[data-preview-screen]").evaluate(element => { element.style.width = "390px"; });
  await page.waitForSelector("[data-mobile-block-text]");
  assert.equal((await sizes()).h1, 22);
  assert.deepEqual(errors, []);
  console.log("Mobile text browser checks passed: inline and inherited fonts, new content, slide isolation, desktop restoration and framed phone preview.");
} finally {
  await browser?.close();
  await vite.close();
}
