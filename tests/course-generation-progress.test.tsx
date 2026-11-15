/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CourseGenerationProgress } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-progress";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
const session: GenerationSessionSnapshot = {
  id: "session", status: "generating", error: null, readyToSave: false, completedLessonIds: [], currentLessonId: "lesson-0",
  input: { prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 5, template: "custom", learnGroupingMode: "smart", slidesPerContent: 5, targetLanguage: "English", contentDepth: "detailed", interactivity: "high", postTestCount: 5, includeImages: false, generateCoverImage: false, courseTitle: "", courseDescription: "" },
  outline: { title: "HTML", description: "Learn HTML", sections: [{ id: "learn", title: "Learn", lessons: Array.from({ length: 5 }, (_, index) => ({ id: `lesson-${index}`, title: `HTML ${index + 1}`, objective: "Learn HTML", kind: "learn" })) }] },
};
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const click = async (text: string) => act(async () => { const button = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text)); expect(button).toBeTruthy(); button!.click(); });

describe("saved lesson progress", () => {
  it("estimates the active lesson inside the single shimmering course bar", async () => {
    vi.useFakeTimers();
    const tenLessons = { ...session, outline: { ...session.outline, sections: [{ ...session.outline.sections[0], lessons: Array.from({ length: 10 }, (_, index) => ({ ...session.outline.sections[0].lessons[0], id: `lesson-${index}` })) }] } };
    const props = { session: tenLessons, running: true, error: "", onRetry: () => {}, onCancel: () => {}, onSelectLesson: () => {} };
    await act(async () => root.render(<CourseGenerationProgress {...props} />));
    const progressBar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(progressBar.getAttribute("aria-label")).toBe("Estimated course generation progress");
    expect(progressBar.getAttribute("aria-valuenow")).toBe("0");
    expect(progressBar.className).toContain("lesson-generation-progress-shimmer");

    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("2");
    expect(progressBar.getAttribute("aria-valuetext")).toContain("current lesson estimate: 20%");
    await act(async () => { vi.advanceTimersByTime(45_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("5");
    expect(progressBar.getAttribute("aria-valuetext")).toContain("current lesson estimate: 53%");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("0 of 10 lessons generated and saved · 0%");
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("6");
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("6");

    const nextLesson = { ...tenLessons, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1" };
    await act(async () => root.render(<CourseGenerationProgress {...props} session={nextLesson} />));
    expect(progressBar.getAttribute("aria-valuenow")).toBe("10");
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("15");
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("16");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("1 of 10 lessons generated and saved · 10%");
  });

  it("shows waiting for existing work without treating lock contention as a failed lesson", async () => {
    await act(async () => root.render(<CourseGenerationProgress session={{ ...session, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1", lease: { locked: true, retryAfterMs: 2_000 } }} running error="" onRetry={() => {}} onCancel={() => {}} onSelectLesson={() => {}} />));
    expect(container.textContent).toContain("Waiting for ongoing generation of lesson 2: HTML 2");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("20");
    expect(container.textContent).not.toContain("Retry / resume");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it.each(["completed", "cancelled"] as const)("keeps the current %s run visible with a Close button", async (status) => {
    const onClose = vi.fn();
    const props = { session: { ...session, status: "generating" as const }, running: true, error: "", onRetry: () => {}, onCancel: () => {}, onSelectLesson: () => {}, onClose };
    await act(async () => root.render(<CourseGenerationProgress {...props} />));
    expect(container.querySelector('[aria-label="Close lesson drafts"]')).toBeNull();
    await act(async () => root.render(<CourseGenerationProgress {...props} session={{ ...session, status }} error="Earlier error" />));
    expect(container.querySelector('[aria-label="Lesson draft generation"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Earlier error");
    expect(container.querySelector("h2")?.textContent).toBe(status === "completed" ? "Lesson generation completed" : "Lesson generation cancelled");
    expect(container.querySelector("h2")?.previousElementSibling?.getAttribute("role")).toBe("img");
    expect(container.querySelector(`[role="img"][aria-label="${status === "completed" ? "Generation completed" : "Generation cancelled"}"]`)).not.toBeNull();
    if (status === "completed") {
      expect(container.querySelector('[aria-label="Generation completed"]')?.className).toContain("text-emerald-600");
      expect(container.textContent).not.toContain("All lesson drafts are saved");
      expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    } else {
      expect(container.querySelector('[aria-label="Generation cancelled"]')?.className).toContain("text-rose-600");
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
      expect(container.querySelector("details")).toBeNull();
      expect(container.querySelector("[data-generation-current-lesson]")).toBeNull();
      expect(container.textContent).toBe("Lesson generation cancelled");
    }
    expect(container.textContent).not.toContain("Cancel remaining");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close lesson drafts"]')!.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("labels an in-progress quiz as quiz generation", async () => {
    const quizSession = {
      ...session,
      currentLessonId: "quiz-0",
      outline: {
        ...session.outline,
        sections: [{ ...session.outline.sections[0], lessons: [{ ...session.outline.sections[0].lessons[0], id: "quiz-0", title: "HTML quiz", kind: "preTest" as const }] }],
      },
    };
    await act(async () => root.render(<CourseGenerationProgress session={quizSession} running error="" onRetry={() => {}} onCancel={() => {}} onSelectLesson={() => {}} />));
    expect(container.querySelector("h2")?.textContent).toBe("Generating quiz...");
    expect(container.querySelector("[data-generation-current-lesson]")?.textContent).toContain("Generating quiz 1: HTML quiz");
  });

  it("shows only saved lessons as complete, with retry and cancellation controls", async () => {
    const retry = vi.fn(), cancel = vi.fn();
    await act(async () => root.render(<CourseGenerationProgress session={{ ...session, status: "generating", completedLessonIds: ["lesson-0", "lesson-1"], currentLessonId: "lesson-2" }} running={false} error="Provider unavailable" onRetry={retry} onCancel={cancel} onSelectLesson={() => {}} />));
    expect(container.textContent).toContain("2 of 5 lessons generated and saved · 40%");
    expect(container.querySelector("h2")?.textContent).toBe("Generating lesson...");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("40");
    expect(container.textContent).toContain("Failed");
    expect(container.querySelectorAll('[role="img"][aria-label="Saved"]')).toHaveLength(2);
    expect(container.querySelector('[role="img"][aria-label="AI generation"]')).not.toBeNull();
    await click("Retry / resume"); await click("Cancel remaining");
    expect(retry).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce();
  });
});

