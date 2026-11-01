/** Check both card popovers, animations, and badge stacking without a database. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CourseCard } from '/app/dashboard/_components/(dashboard_client_components)/course-card.tsx';
import { FolderCard } from '/app/dashboard/_components/(dashboard_client_components)/folder-card.tsx';
import '/app/globals.css';
const course = { id: 'course-1', title: 'Introduction to learning experience design', description: 'Create useful, engaging courses for your team.', courseLayout: 'standard', coverImage: null, folderId: null, status: 'draft', revision: 1, updatedAt: '2026-11-02T00:00:00Z', lessonCount: 6, permissions: ['courses.edit', 'courses.publish', 'courses.export', 'courses.delete'] };
const data = { workspaceId: null, workspaceRole: 'owner', permissions: course.permissions, folderOptions: Array.from({ length: 40 }, (_, i) => ({ id: 'folder-' + i, label: 'Learning materials / Team resources / Folder ' + i })), workspaces: [{ id: 'team-1', name: 'Learning and development', role: 'editor', memberCount: 2 }] };
const folder = { id: 'folder-1', name: 'Team training', parentId: null, courseCount: 6, subfolderCount: 0, createdAt: course.updatedAt, updatedAt: course.updatedAt };
function App() {
  const [current, setCurrent] = useState(course);
  async function request(url, method, body) { window.__request = { url, method, body }; if (method === 'PATCH') setCurrent(value => ({ ...value, ...body })); }
  async function submit(event, url, method) { event.preventDefault(); await request(url, method, Object.fromEntries(new FormData(event.currentTarget))); }
  return <main className="mx-auto max-w-6xl p-5"><h1 className="mb-6 text-2xl font-bold">My courses</h1><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><FolderCard folder={folder} data={data} href="/dashboard" disabled={false} busy={false} onSubmit={submit} onRequest={request}/></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 12 }, (_, i) => <CourseCard key={i} course={{ ...current, id: 'course-' + (i + 1) }} data={data} disabled={false} busy={false} onSubmit={submit} onRequest={request} />)}</div></main>;
}
createRoot(document.getElementById('root')).render(<App />);
`;

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  cacheDir: "node_modules/.vite-course-settings-browser",
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  esbuild: { jsx: "automatic", loader: "tsx", include: /\.[jt]sx?$/ },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge", "next/image", "next/link"] },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } },
  plugins: [{
    name: "course-settings-fixture",
    enforce: "pre",
    // Navigation is outside this fixture; keep the real folder card and its actions.
    resolveId: (id, importer) => id === "/__course-settings.tsx" ? id : id === "../dashboard-link" && importer?.includes("folder-card") ? "\0fixture-dashboard-link" : null,
    load: (id) => id === "/__course-settings.tsx" ? fixture : id === "\0fixture-dashboard-link" ? "import React from 'react'; export function DashboardLink({children,...props}) { return React.createElement('a',props,children); }" : null,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__course-settings") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__course-settings.tsx"></script></body></html>');
      });
    },
  }],
});

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  page.on("console", (message) => { if (message.type() === "error") console.error(message.text()); });
  await page.addInitScript(() => { window.process = { env: { NODE_ENV: "development" } }; });
  await page.route("**/api/courses/*/assets", (route) => route.fulfill({ json: { assets: [] } }));
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  mkdirSync("test-results", { recursive: true });
  for (const [width, height] of [[1440, 900], [1280, 500], [390, 640], [320, 480]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/__course-settings`);
    const trigger = page.locator('article:has(.aspect-video) button[aria-haspopup="dialog"]').last();
    await trigger.scrollIntoViewIfNeeded();
    const initialScroll = await page.evaluate(() => window.scrollY);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Course settings", exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((element) => getComputedStyle(element).animationName), "card-popover-in");
    await page.waitForFunction(() => document.querySelector('[data-card-popover]')?.getAnimations().every((animation) => animation.playState === "finished"));
    const scrollBody = dialog.locator("[data-popover-body]");
    assert.equal(await scrollBody.evaluate((element) => element.scrollTop), 0, "Settings must open at the top");
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, "Dialog must fit the viewport");
    assert.ok(bounds.width <= 320, "Settings must stay compact");
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, "Settings must be centered vertically");
    const triggerBounds = await trigger.boundingBox();
    assert.ok(Math.abs(bounds.x + bounds.width - triggerBounds.x - triggerBounds.width) < 2 || bounds.x === 12, "Settings must align near the dots or clamp to the screen");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: `test-results/course-settings-${width}x${height}.png` });
    const headerY = (await dialog.getByRole("heading", { name: "Course settings", exact: true }).boundingBox()).y;
    const doneY = (await dialog.getByRole("button", { name: "Done", exact: true }).boundingBox()).y;
    await scrollBody.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    assert.equal((await dialog.getByRole("heading", { name: "Course settings", exact: true }).boundingBox()).y, headerY);
    assert.equal((await dialog.getByRole("button", { name: "Done", exact: true }).boundingBox()).y, doneY);
    await dialog.getByRole("button", { name: "Publish", exact: true }).click();
    const formats = dialog.getByRole("menu", { name: "Publish format" });
    assert.equal(await formats.getByRole("menuitem").count(), 4);
    const formatBounds = await formats.boundingBox();
    assert.ok(formatBounds.y >= bounds.y && formatBounds.y + formatBounds.height <= bounds.y + bounds.height, `Publish formats must not be clipped: ${JSON.stringify({ width, height, formatBounds, bounds })}`);
    for (const item of await formats.getByRole("menuitem").all()) {
      await item.click({ trial: true });
    }
    await dialog.getByRole("button", { name: "Publish", exact: true }).click();
    await scrollBody.evaluate((element) => { element.scrollTop = 0; });
    await dialog.getByRole("button", { name: "Choose or upload image" }).click();
    const library = page.getByRole("dialog", { name: "Media library", exact: true });
    await library.waitFor();
    await library.getByRole("button", { name: "Close media library" }).click();
    await dialog.getByRole("textbox", { name: "Course title" }).fill("Updated course title");
    await dialog.getByRole("button", { name: "Save title", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__request.body.title), "Updated course title");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.scrollY), initialScroll, "Opening and closing settings must preserve the page scroll position");
    await trigger.click();
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    const closing = page.locator('[data-card-popover][data-state="closed"]');
    assert.equal(await closing.count(), 1, "Closing must keep the panel mounted for its fade-out");
    assert.equal(await closing.evaluate((element) => getComputedStyle(element).animationName), "card-popover-out");
    await closing.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup")), "dialog", "Escape must restore focus to the dots");

    await page.evaluate(() => window.scrollTo(0, 0));
    const folderTrigger = page.getByRole("button", { name: "Manage Team training", exact: true });
    await folderTrigger.click();
    const folderPanel = page.getByRole("dialog", { name: "Folder settings", exact: true });
    await folderPanel.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-card-popover][data-state="open"]')?.getAnimations().every((animation) => animation.playState === "finished"));
    await folderPanel.getByRole("textbox", { name: "Rename folder" }).fill("Updated folder");
    await folderPanel.getByRole("button", { name: "Save name" }).click();
    assert.equal(await page.evaluate(() => window.__request.body.name), "Updated folder");
    // Put a real course-mode badge underneath the folder popup, then hit-test it.
    const badge = page.locator("article .aspect-video > span").nth(width >= 1024 ? 3 : width >= 640 ? 2 : 1);
    await badge.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().y - window.innerHeight / 2));
    const overlapIsCovered = await folderPanel.evaluate((panel) => {
      const popup = panel.getBoundingClientRect();
      const badges = [...document.querySelectorAll("article .aspect-video > span")];
      return badges.some((badge) => {
        const box = badge.getBoundingClientRect();
        const left = Math.max(box.left, popup.left), right = Math.min(box.right, popup.right);
        const top = Math.max(box.top, popup.top), bottom = Math.min(box.bottom, popup.bottom);
        return right > left && bottom > top && panel.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
      });
    });
    assert.equal(overlapIsCovered, true, "Folder popup must paint above course-mode badges");
    await page.screenshot({ path: `test-results/folder-settings-${width}x${height}.png` });
    await page.getByRole("heading", { name: "My courses", exact: true }).click();
    await folderPanel.waitFor({ state: "detached" });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Manage Team training", exact: true }).click();
  assert.equal(await page.locator('[data-card-popover][data-state="open"]').evaluate((element) => getComputedStyle(element).animationName), "none");
  assert.deepEqual(errors, []);
  console.log("Card popover browser checks passed: course/folder actions, compact centered placement at four viewport sizes, internal scrolling, fade in/out, outside click, Escape/focus, reduced motion, publish/media, and folder popup above course-mode badges.");
} finally {
  await browser?.close();
  await vite.close();
}
