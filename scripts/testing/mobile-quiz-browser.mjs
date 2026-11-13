import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const fixture = `import React from'react';import{createRoot}from'react-dom/client';
import{QuizAssessmentPreview}from'/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/quiz-assessment-preview.tsx';import'/app/globals.css';
const question={id:'q1',prompt:'Which answer is correct for this question?',imageSrc:'',imageAlt:'',selectionMode:'single',choices:[{id:'a',text:'Correct answer',imageSrc:'',imageAlt:''},{id:'b',text:'Another answer',imageSrc:'',imageAlt:''}],correctChoiceIds:['a'],correctFeedback:'Correct answer.',incorrectFeedback:'Try again.'};
createRoot(document.getElementById('root')).render(<div data-fixture-screen><QuizAssessmentPreview questions={[question]} passingScore={70} wasPassed={false} onResult={()=>{}}/></div>);`;
const vite = await createServer({
  configFile: false, root: process.cwd(), esbuild: { jsx: "automatic" },
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  resolve: { alias: { "@": process.cwd() } },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge"] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "quiz-mobile-fixture", resolveId: (id) => id === "/__quiz.tsx" ? id : null,
    load: (id) => id === "/__quiz.tsx" ? fixture : null,
    configureServer(server) { server.middlewares.use((request, response, next) => {
      if (request.url !== "/__quiz") return next();
      response.setHeader("Content-Type", "text/html");
      response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__quiz.tsx"></script></body></html>');
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
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__quiz`);
  await page.waitForSelector("[data-quiz-prompt]");
  const metrics = () => page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    return { question: style("[data-quiz-prompt]").fontSize, answer: style("[data-quiz-choice]").fontSize,
      cardPadding: style("[data-quiz-question]").paddingTop, answerPadding: style("[data-quiz-choice]").paddingLeft,
      outerPadding: style("[data-quiz-assessment]").paddingLeft,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(await metrics(), { question: "16px", answer: "12px", cardPadding: "12px", answerPadding: "8px", outerPadding: "8px", overflow: false });
  await page.getByLabel("Correct answer", { exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Review quiz" }).click();
  assert.equal(await page.locator('[data-quiz-question] [role="status"]').evaluate(element => getComputedStyle(element).fontSize), "12px");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-quiz-prompt]")).fontSize === "20px");
  const desktop = await metrics();
  assert.equal(desktop.answer, "14px");
  assert.equal(desktop.cardPadding, "28px");
  await page.locator("[data-fixture-screen]").evaluate(element => { element.style.width = "390px"; });
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-quiz-prompt]")).fontSize === "16px");
  assert.equal((await metrics()).answer, "12px");
  assert.deepEqual(errors, []);
  console.log("Mobile quiz browser checks passed: 16px questions, 12px answers/feedback, reduced padding, answer grading, desktop restoration and framed preview sizing.");
} finally {
  await browser?.close();
  await vite.close();
}
