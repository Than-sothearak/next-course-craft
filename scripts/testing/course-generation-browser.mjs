/** Real wizard/save coordinator, using synthetic API fixtures and no credentials. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
const fixture = `import React,{useEffect,useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{useEditorDraft}from'/app/courses/[courseId]/edit/_components/_components/use-editor-draft.ts';
import{useCourseGenerationSession}from'/app/courses/[courseId]/edit/_components/_components/use-course-generation-session.ts';
import{CourseGenerationWizard}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-wizard.tsx';
import{CourseGenerationProgress}from'/app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-progress.tsx';
import{CourseOutline}from'/app/courses/[courseId]/edit/standard-mode/_components/course-outline.tsx';
import{Button}from'/components/ui/button.tsx';import'/app/globals.css';
function App({initial}){const[open,setOpen]=useState(false),valid=useRef(true);const{revision,...initialDraft}=initial;const editor=useEditorDraft({initialDraft,initialRevision:revision,courseId:'course',titleValid:true,titleValidRef:valid,onNavigate:()=>{}});const generation=useCourseGenerationSession('course',editor.runServerMutation);
return <main className="mx-auto max-w-4xl p-4"><div data-editor-overview><h1 className="mb-4 text-xl">{editor.draft.title}</h1></div><Button onClick={()=>generation.session?.status==='generating'?generation.showProgress():setOpen(true)}>Generate course</Button><div data-course-outline className="mt-4"><CourseOutline currentCourseId="course" sections={editor.draft.sections} lessons={editor.draft.lessons} activeLessonId={null} pendingLessonIds={new Set(generation.session?.status==='generating'?generation.session.outline.sections.flatMap(section=>section.lessons).filter(lesson=>!generation.session.completedLessonIds.includes(lesson.id)).map(lesson=>lesson.id):[])} onSelectLesson={()=>{}} onAddSection={()=>{}} onRenameSection={()=>{}} onMoveSection={()=>{}} onDuplicateSection={()=>{}} onDeleteSection={()=>{}} onAddLesson={()=>{}} onAddQuiz={()=>{}} onDuplicateLesson={()=>{}} onMoveLesson={()=>{}} onDeleteLesson={()=>{}} onChangeLessonIcon={()=>{}} onReorderLessons={()=>{}}/></div>{generation.progressVisible&&<CourseGenerationProgress session={generation.session} running={generation.running} error={generation.error} onClose={generation.dismissProgress} onRetry={generation.resume} onCancel={generation.cancel} onSelectLesson={()=>{}}/>}<div data-saved-lessons>{editor.draft.lessons.filter(lesson=>lesson.blocks.length).map(lesson=><article key={lesson.id}><h2>{lesson.title}</h2><p>{lesson.blocks[0].data.html}</p></article>)}</div>{open&&<CourseGenerationWizard open onClose={()=>setOpen(false)} courseId="course" courseTitle={editor.draft.title} courseDescription={editor.draft.description} existingLessonCount={editor.draft.lessons.length} runServerMutation={editor.runServerMutation} savedSession={generation.session} onStarted={generation.setSession}/>}</main>;}
function Bootstrap(){const[initial,setInitial]=useState(null);useEffect(()=>{fetch('/api/courses/course/editor').then(response=>response.json()).then(setInitial)},[]);return initial?<App initial={initial}/>:null;}createRoot(document.getElementById('root')).render(<Bootstrap/>);`;
const vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: "node_modules/.vite-course-generation", define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) }, resolve: { alias: { "@": process.cwd() } }, esbuild: { jsx: "automatic" }, optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "zod", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge", "framer-motion", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"] }, server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**", "**/test-results/**", "**/public/course-export/**"] } }, plugins: [{ name: "generation-fixture", resolveId: (id) => id === "/__generation.tsx" ? id : null, load: (id) => id === "/__generation.tsx" ? fixture : null, configureServer(server) { server.middlewares.use((request, response, next) => { if (request.url !== "/__generation") return next(); response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__generation.tsx"></script></body></html>'); }); } }] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage(); page.setDefaultTimeout(15_000);
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  let editor = { title: "New course", description: "", revision: 0, authorVisible: true, theme: { preset: "ocean", primaryColor: "#2f5f9f", accentColor: "#ff876c", fontFamily: "sans" }, navigationMode: "sequential", sections: [{ id: "original", title: "Original", order: 0 }], lessons: [] };
  const generatedCover = { template: "image", imageSrc: "/api/assets/507f1f77bcf86cd799439014/file", imageAlt: "Course cover", overlayOpacity: 35, alignment: "center", textColor: "#ffffff", imagePosition: "center" };
  await page.route("**/api/assets/507f1f77bcf86cd799439014/file", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64") }));
  let dashboardImage = null;
  let session = null, failOnce = true;
  const savedIds = [], actions = [];
  await page.route("**/api/courses/course/**", async (route) => {
    const request = route.request(), body = request.method() === "POST" || request.method() === "PUT" ? request.postDataJSON() : null;
    if (request.url().endsWith("/editor")) {
      if (body) { assert.equal(body.revision, editor.revision); editor = { ...body, revision: editor.revision + 1 }; }
      return route.fulfill({ json: editor });
    }
    if (!body) return route.fulfill({ json: session });
    actions.push(body.action);
    if (body.action === "plan") {
      session = { cover: generatedCover, id: "507f1f77bcf86cd799439013", status: "outline", input: body.input, error: null, currentLessonId: "lesson-0", completedLessonIds: [], readyToSave: false, outline: { title: "HTML course", description: "Learn HTML step by step", sections: [{ id: "learn", title: "Learn", lessons: Array.from({ length: 5 }, (_, i) => ({ id: `lesson-${i}`, title: `HTML ${i + 1}`, objective: `Explain HTML topic ${i + 1}`, kind: "learn" })) }] } };
    } else if (body.action === "approve") {
      assert.equal(body.revision, editor.revision);
      session.outline = body.outline; session.status = "generating";
      dashboardImage ??= session.cover?.imageSrc;
      editor = { ...editor, title: body.outline.title, description: body.outline.description, revision: editor.revision + 1, sections: body.outline.sections.map((section, order) => ({ id: section.id, title: section.title, order })), lessons: body.outline.sections.flatMap((section) => section.lessons.map((lesson, order) => ({ id: lesson.id, title: lesson.title, sectionId: section.id, lessonType: "content", order, quizQuestions: [], blocks: [] }))) };
      return route.fulfill({ json: { session, editor } });
    } else if (body.action === "prepare") {
      if (session.completedLessonIds.length === 2 && failOnce) {
        failOnce = false; session.error = "Temporary provider failure";
        return route.fulfill({ status: 503, json: { error: session.error } });
      }
      session.readyToSave = true; session.error = null;
    } else if (body.action === "commit") {
      assert.equal(body.revision, editor.revision);
      const id = session.currentLessonId; assert.ok(!savedIds.includes(id)); savedIds.push(id);
      editor = { ...editor, revision: editor.revision + 1, lessons: editor.lessons.map((lesson) => lesson.id === id ? { ...lesson, blocks: [{ id: `block-${id}`, version: 1, type: "richText", data: { html: `Saved teaching content for ${id}` } }] } : lesson) };
      session = { ...session, completedLessonIds: [...session.completedLessonIds, id], readyToSave: false, currentLessonId: editor.lessons.find((lesson) => !savedIds.includes(lesson.id))?.id ?? null };
      if (!session.currentLessonId) session.status = "completed";
      return route.fulfill({ json: { session, editor } });
    }
    return route.fulfill({ json: session });
  });
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  await page.goto(`${origin}/__generation`);
  await page.getByRole("button", { name: "Generate course", exact: true }).click();
  await expect(page.getByLabel("Course generation steps")).toContainText("4. Lesson drafts");
  await page.getByLabel("What should this course teach?").fill("Teach HTML from the basics with worked examples");
  await page.getByRole("button", { name: "Continue to course details" }).click();
  await page.getByRole("button", { name: "Generate outline", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve outline and generate lessons" })).toBeVisible();
  assert.deepEqual(actions, ["plan"]);
  await expect(page.getByRole("dialog").locator('[aria-label="Course card image preview"]')).toContainText("HTML course");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add section", exact: true }).click();
  await dialog.getByLabel("Section 2", { exact: true }).fill("Practice");
  await dialog.getByLabel("Lesson title", { exact: true }).last().fill("Practice task");
  await dialog.getByRole("button", { name: "Add lesson", exact: true }).last().click();
  await dialog.getByLabel("Lesson title", { exact: true }).last().fill("Practice review");
  await expect(dialog.locator("[data-outline-section-id]")).toHaveCount(2);

  mkdirSync("test-results", { recursive: true });
  for (const [width, height] of [[1440, 900], [390, 640], [320, 480]]) {
    await page.setViewportSize({ width, height });
    const dialog = page.getByRole("dialog");
    assert.ok(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `Wizard must fit ${width}px`);
    await page.screenshot({ path: `test-results/course-generation-outline-${width}.png` });
  }
  await page.getByRole("button", { name: "Approve outline and generate lessons" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "29");
  await expect(page.locator("[data-saved-lessons] article")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Retry / resume" })).toBeVisible();
  assert.equal(savedIds.length, 2);
  await expect(page.locator("[data-editor-overview] img")).toHaveCount(0);
  assert.equal(dashboardImage, generatedCover.imageSrc);
  const outlineList = page.locator("[data-course-outline]");
  await expect(outlineList.locator("[data-pending-lesson-id]")).toHaveCount(5);
  await expect(outlineList).toContainText("HTML 1");
  await expect(outlineList).not.toContainText("HTML 3");
  const panel = page.getByRole("region", { name: "Lesson draft generation" });
  for (const [width, height] of [[1440, 900], [390, 640], [320, 480]]) {
    await page.setViewportSize({ width, height });
    const bounds = await panel.boundingBox();
    assert.ok(bounds && Math.abs(bounds.x - 16) <= 1 && Math.abs(bounds.y + bounds.height - (height - 16)) <= 1, "Progress must stay anchored at the bottom left");
    assert.ok(bounds.width <= 352 && bounds.x + bounds.width <= width - 15, "Progress must remain compact and fit the viewport");
  }

  await panel.getByRole("button", { name: "Close lesson drafts" }).click();
  await expect(panel).toHaveCount(0);
  assert.ok(!actions.includes("cancel"), "Closing the panel must not cancel generation");
  await page.getByRole("button", { name: "Generate course", exact: true }).click();
  await expect(panel).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-saved-lessons] article")).toHaveCount(2);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "29");
  await expect(outlineList.locator("[data-pending-lesson-id]")).toHaveCount(5);
  await page.getByRole("button", { name: "Retry / resume" }).click();
  await expect(panel.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator("[data-saved-lessons] article")).toHaveCount(7);
  assert.equal(new Set(savedIds).size, 7);
  await expect(outlineList.locator("[data-pending-lesson-id]")).toHaveCount(0);
  await expect(outlineList).toContainText("HTML 5");
  await expect(outlineList).toContainText("Practice task");
  await expect(outlineList).toContainText("Practice review");
  await panel.getByRole("button", { name: "Close lesson drafts" }).click();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(page.locator("[data-saved-lessons] article")).toHaveCount(7);
  await expect(page.locator("[data-editor-overview] img")).toHaveCount(0);
  assert.equal(dashboardImage, generatedCover.imageSrc);
  await expect(panel).toHaveCount(0);
  await page.screenshot({ path: "test-results/course-generation-complete.png" });
  assert.deepEqual(errors, []);
  console.log("Course generation browser check passed: review gates, mobile sizing, live saved lessons, failure, reload and sequential resume.");
} finally { await browser?.close(); await vite.close(); }
