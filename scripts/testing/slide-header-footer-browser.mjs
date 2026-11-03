/** Check header borders and footer backgrounds through their real settings and renderer. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const imageSrc = "/api/assets/123456789012345678901234/file";
const fixture = `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SlideSurface}from'/app/courses/[courseId]/_components/slide-presentation/slide-surface.tsx';
import{SlideHeaderControls}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-header-controls.tsx';
import{SlideFooterControls}from'/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-footer-controls.tsx';
import{slideMasterSchema}from'/lib/editor/slide-design.ts';
import{GradientColorContext}from'/components/ui/color-picker.tsx';import{Button}from'/components/ui/button.tsx';import'/app/globals.css';
function App(){const[master,setMaster]=useState(()=>slideMasterSchema.parse(JSON.parse(localStorage.getItem('chrome-master')||'null')||{backgroundColor:'#e0f2fe',accentColor:'#4f46e5',footerText:'Training partners',background:{type:'abstract',design:'waves'}}));
window.__master=master;function change(next){setMaster(next);localStorage.setItem('chrome-master',JSON.stringify(next));}
return <GradientColorContext.Provider value={true}><main className="grid grid-cols-[960px_380px] items-start gap-5 p-5"><div data-slide-canvas className="relative h-[540px] w-[960px] overflow-hidden border"><SlideSurface title="Presentation styling" master={master} number={1} total={2} controls={<Button aria-label="Next" onClick={()=>{window.__navigated=(window.__navigated||0)+1;}}>Next</Button>}><p className="absolute left-20 top-52 text-xl text-slate-700">Shared editor and learner presentation</p></SlideSurface></div>
<aside className="max-h-[calc(100dvh-40px)] space-y-5 overflow-y-auto border bg-white p-3"><SlideHeaderControls master={master} courseId="course" onChange={change}/><SlideFooterControls master={master} courseId="course" onChange={change}/></aside></main></GradientColorContext.Provider>;
}createRoot(document.getElementById('root')).render(<App/>);`;
const vite = await createServer({
  configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-header-footer-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**"] } },
  plugins: [{ name: "chrome-fixture", resolveId: id => id === "/__chrome.tsx" ? id : null, load: id => id === "/__chrome.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      if (request.url === "/__chrome") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__chrome.tsx"></script></body></html>'); return; }
      if (request.url === "/api/courses/course/assets") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ assets: [{ id: "123456789012345678901234", originalName: "Footer.png", contentType: "image/png", fileUrl: imageSrc, size: 100, createdAt: "2026-01-01T00:00:00Z" }], nextCursor: null })); return; }
      if (request.url === imageSrc) { response.setHeader("Content-Type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="160"><rect width="960" height="160" fill="#67e8f9"/><path d="M0 100L960 0V160H0Z" fill="#0e7490"/></svg>'); return; }
      next();
    }); },
  }],
});

let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__chrome`);
  const canvas = page.locator("[data-slide-canvas]"), footer = canvas.locator("[data-slide-footer]");
  await expect(canvas.locator('[data-slide-header-border="top"]')).toHaveCSS("height", "8px");
  await page.getByRole("checkbox", { name: "Header bottom border", exact: true }).check();
  await page.getByRole("checkbox", { name: "Header top border", exact: true }).uncheck();
  await page.getByLabel("Header border width", { exact: true }).fill("6");
  await page.getByLabel("Header border color hex code", { exact: true }).fill("#ff8800");
  await expect(canvas.locator('[data-slide-header-border="bottom"]')).toHaveCSS("height", "6px");
  await expect(canvas.locator('[data-slide-header-border="bottom"]')).toHaveCSS("background-color", "rgb(255, 136, 0)");
  assert.equal(await canvas.locator('[data-slide-header-border="top"]').count(), 0);
  const preview = page.getByLabel("Header style preview", { exact: true });
  const previewBorder = await preview.locator('[data-slide-header-border="bottom"]').boundingBox();
  const previewBounds = await preview.boundingBox();
  assert.ok(Math.abs(previewBorder.y + previewBorder.height - (previewBounds.y + previewBounds.height - 1)) < 1, "The miniature preview must show the complete bottom border");
  await page.getByRole("button", { name: "Header border color gradient", exact: true }).click();
  await page.getByLabel("Header border color end hex code", { exact: true }).fill("#22c55e");
  await expect(canvas.locator('[data-slide-header-border="bottom"]')).toHaveCSS("background-image", /linear-gradient/);

  await page.getByLabel("Footer background style", { exact: true }).selectOption("transparent");
  await expect(footer).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(footer).toHaveCSS("opacity", "1");
  await page.getByLabel("Footer background color hex code", { exact: true }).fill("#123456");
  await expect(footer).toHaveAttribute("data-slide-footer-background", "color");
  await expect(footer).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await page.getByLabel("Footer background style", { exact: true }).selectOption("image");
  await page.getByRole("button", { name: "Choose or upload footer background image", exact: true }).click();
  await page.getByRole("button", { name: "Use Footer.png", exact: true }).click();
  await expect.poll(() => canvas.locator("[data-slide-footer-image] img").evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByLabel("Footer image position", { exact: true }).selectOption("bottom");
  await page.getByLabel("Footer image overlay", { exact: true }).fill("45");
  await page.getByLabel("Footer image overlay color hex code", { exact: true }).fill("#ff8800");
  await expect(footer.locator("[data-slide-color-overlay]")).toHaveCSS("opacity", "0.45");
  await expect(footer.locator("[data-slide-color-overlay]")).toHaveCSS("background-color", "rgb(255, 136, 0)");
  await page.getByLabel("Footer content", { exact: true }).selectOption("both");
  await page.getByRole("button", { name: "Add footer logo", exact: true }).click();
  await page.getByRole("button", { name: "Use Footer.png", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__master.footer.logos.length), 1);
  assert.equal(await page.evaluate(() => window.__master.footer.imageSrc), imageSrc);
  await footer.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__navigated), 1, "Footer artwork cannot block navigation");
  const before = await page.evaluate(() => JSON.parse(JSON.stringify(window.__master)));
  await page.reload(); await expect(footer.locator("[data-slide-footer-image] img")).toBeVisible();
  assert.deepEqual(await page.evaluate(() => window.__master), before, "New chrome settings must survive a parsed snapshot reload");
  mkdirSync("test-results", { recursive: true }); await canvas.screenshot({ path: "test-results/presentation-header-footer.png" });
  assert.deepEqual(errors, []);
  console.log("Presentation header/footer browser checks passed: transparent/color/image backgrounds, owned-image selection, overlays, independent borders, gradient colors, preview geometry, navigation hit testing, and reload.");
} finally { await browser?.close(); await vite.close(); }
