/** Sample real CSS flip transitions to verify that presentation borders are never clipped. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `import React from 'react';import{createRoot}from'react-dom/client';
import{InteractiveFlipCard}from'/app/courses/[courseId]/preview/interactive-blocks.tsx';
import'/app/globals.css';
window.revealed=[];
const card={id:'one',frontLabel:'Question',backLabel:'Answer',front:{type:'text',text:'Front with a complete rounded border'},back:{type:'text',text:'Back with a complete rounded border'}};
createRoot(document.getElementById('root')).render(<main style={{padding:40,display:'flex',flexDirection:'column',gap:40}}>{[0,12].map(padding=><section key={padding} data-padding={padding} style={{width:700,height:240,overflow:'hidden',background:'#e2e8f0'}}><InteractiveFlipCard blockId={'block-'+padding} cards={[card]} cardStyle="outlined" cardTextColor="#dc2626" presentation presentationLayout={{mode:'custom',padding,cardPadding:16,columnGap:0,rowGap:0,borderRadius:24,textAlign:'center'}} onCardReveal={id=>window.revealed.push(id)}/></section>)}</main>);
`;
const vite = await createServer({
  configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-flip-border-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"] },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [{ name: "flip-border-fixture", resolveId: (id) => id === "/__flip-border.tsx" ? id : null,
    load: (id) => id === "/__flip-border.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      if (request.url !== "/__flip-border") return next();
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/__flip-border.tsx"></script></body></html>');
    }); },
  }],
});
let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__flip-border`);
  await page.locator('[data-flip-card-id]').first().waitFor();
  for (const zoom of [0.5, 1, 1.5]) {
    await page.locator("main").evaluate((element, zoom) => { element.style.transform = `scale(${zoom})`; element.style.transformOrigin = "top left"; }, zoom);
    for (const padding of [0, 12]) {
      const card = page.locator(`[data-padding="${padding}"] [data-flip-card-id]`);
      for (const direction of ["back", "front"]) {
        await card.click();
        // Pause at several points on both sides of the rotation, rather than checking only the end state.
        const samples = await card.evaluate(async (button) => {
          const rotor = button.firstElementChild;
          const transition = rotor.getAnimations()[0];
          if (!transition) throw new Error("Expected a running flip transition");
          transition.pause();
          const samples = [];
          for (const progress of [0.05, 0.15, 0.3, 0.5, 0.75, 0.95]) {
            transition.currentTime = Number(transition.effect.getTiming().duration) * progress;
            await new Promise(requestAnimationFrame);
            const frontVisible = new DOMMatrix(getComputedStyle(rotor).transform).m11 >= 0;
            const face = rotor.children[frontVisible ? 0 : 1];
            const bounds = face.getBoundingClientRect(), frame = button.getBoundingClientRect();
            samples.push({ progress, bounds: bounds.toJSON(), frame: frame.toJSON() });
          }
          transition.finish();
          return samples;
        });
        for (const { progress, bounds, frame } of samples) {
          assert.ok(bounds.left >= frame.left - 1 && bounds.right <= frame.right + 1 && bounds.top >= frame.top - 1 && bounds.bottom <= frame.bottom + 1,
            `Border clipped at zoom ${zoom}, padding ${padding}, ${direction}, progress ${progress}: ${JSON.stringify({ bounds, frame })}`);
        }
      }
    }
  }
  assert.equal(await page.evaluate(() => window.revealed.length), 6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-flip-card-id]').first().click();
  assert.equal(await page.locator('[data-flip-card-id]').first().getAttribute("aria-pressed"), "true");
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/flip-card-border.png" });
  assert.deepEqual(errors, []);
  console.log("Flip-card borders fit throughout forward/back animation at 50/100/150% zoom, with zero/default padding; reveal tracking and reduced motion also pass.");
} finally { await browser?.close(); await vite.close(); }
