/** Check focus scrolling in an expanded presentation object inspector. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SlideObjectWorkspace } from '/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-object-workspace.tsx';
import { createSlideBlocksFromTemplate } from '/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template.ts';
import { blockTemplates } from '/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data.ts';
import { defaultSlideMaster } from '/lib/editor/slide-design.ts';
import '/app/globals.css';
function App() {
  const [blocks, setBlocks] = useState(() => createSlideBlocksFromTemplate(blockTemplates.find(item => item.id === 'interactive-reveal'), 'cards'));
  const [master, setMaster] = useState(defaultSlideMaster);
  const [zoom, setZoom] = useState();
  const [appearance, setAppearance] = useState();
  const [snap, setSnap] = useState(true);
  window.__blocks = blocks;
  const change = next => setBlocks(current => current.map(block => block.id === next.id ? next : block));
  return <main className="fixed inset-0 flex h-dvh min-h-0 flex-col overflow-hidden">
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center border-b bg-white px-5">Presentation editor</header>
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
      <div className="grid h-full min-h-0 min-w-0 grid-cols-[180px_minmax(0,1fr)] grid-rows-1 gap-2 overflow-hidden">
        <aside className="min-h-0 overflow-auto rounded border bg-slate-100 p-3">Slides</aside>
        <section aria-label="Slide canvas" className="min-h-0 min-w-0 overflow-hidden">
          <SlideObjectWorkspace initialSelectedId={blocks[0].id} title="Flip cards" courseTitle="Presentation" slideNumber={1} slideCount={1}
            blocks={blocks} sections={[]} lessons={[]} master={master} courseId="fixture" zoom={zoom} onZoomChange={setZoom}
            appearance={appearance} onAppearanceChange={setAppearance} snapEnabled={snap} onSnapEnabledChange={setSnap}
            onTitleChange={() => {}} onHeaderStyleChange={() => {}} onMasterChange={setMaster} onCoverChange={() => {}}
            onApplyCover={() => {}} onCourseTitleChange={() => {}} onBlockChange={change} onBlocksChange={setBlocks}
            onReorderLayer={() => {}} onAddTemplate={() => null} onMoreTemplates={() => {}} onReplaceTemplate={() => {}}
            onDuplicate={() => {}} onPasteObject={() => ''} onDelete={() => {}} />
        </section>
      </div>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
`;

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: "node_modules/.vite-inspector-scroll-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  esbuild: { jsx: "automatic" },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "framer-motion", "zod", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder", "@tiptap/extension-mathematics", "@tiptap/extension-subscript", "@tiptap/extension-superscript", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } },
  plugins: [{
    name: "inspector-scroll-fixture",
    resolveId: id => id === "/__inspector-scroll.tsx" ? id : null,
    load: id => id === "/__inspector-scroll.tsx" ? fixture : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__inspector-scroll") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__inspector-scroll.tsx"></script></body></html>');
      });
    },
  }],
});

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.route("**/api/**", route => route.fulfill({ json: { assets: [] } }));
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;

  for (const [width, height] of [[1440, 900], [1280, 600], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/__inspector-scroll`);
    const inspector = page.getByRole("complementary", { name: "Slide inspector", exact: true });
    await inspector.getByRole("button", { name: "Show all Object block settings", exact: true }).click();
    const toggle = inspector.getByRole("switch", { name: "Required for progress", exact: true });
    const label = toggle.locator("..");
    await label.scrollIntoViewIfNeeded();
    const state = () => toggle.evaluate(input => {
      const ancestors = [];
      for (let element = input.parentElement; element; element = element.parentElement) {
        if (element.scrollHeight > element.clientHeight || element.scrollTop) ancestors.push({ name: element.getAttribute("aria-label") ?? element.tagName, top: element.scrollTop });
      }
      return { checked: input.checked, inputY: input.getBoundingClientRect().y, labelY: input.parentElement.getBoundingClientRect().y, ancestors };
    });
    const before = await state();
    await label.locator('span[aria-hidden="true"]').click();
    const after = await state();
    assert.equal(after.checked, !before.checked);
    assert.deepEqual(after.ancestors, before.ancestors, "Toggling progress must preserve sidebar and workspace scroll positions");
    assert.equal(await page.locator('[data-slide-canvas]').isVisible(), true);
    await page.keyboard.press("Space");
    const keyboard = await state();
    assert.equal(keyboard.checked, before.checked, "The switch must retain keyboard focus and toggle with Space");
    assert.deepEqual(keyboard.ancestors, before.ancestors, "Keyboard toggles must preserve sidebar and workspace scroll positions");
  }
  assert.deepEqual(errors, []);
  console.log("Expanded inspector scroll checks passed at three viewport sizes, including pointer and keyboard toggles.");
} finally {
  await browser?.close();
  await vite.close();
}
