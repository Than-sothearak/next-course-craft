// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";
import { blockSchema } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const course: PreviewData = {
  courseId: "slides-reading", title: "Presentation", description: "", authorVisible: false,
  courseLayout: "slides", navigationMode: "sequential",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "first", sectionId: "section", title: "Introduction", lessonType: "content", order: 0, quizQuestions: [], blocks: [{ id: "text", version: 1, type: "richText", width: "medium", widthCustom: false, blockPadding: 40, backgroundColor: "#ffffff", data: { html: "<p>Read this slide.</p>" } }] },
    { id: "second", sectionId: "section", title: "Next slide", lessonType: "content", order: 1, quizQuestions: [], blocks: [] },
  ],
};

describe("slide reading progress", () => {
  it("uses the cover Start button to follow slide navigation locks", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    const data: PreviewData = { ...course, navigationMode: "restricted", lessons: [
      { ...course.lessons[0], blocks: [], slideCover: { template: "imageCover", imageSrc: "", imageAlt: "", subtitle: "Welcome", lessonOf: "Lesson of design", startLabel: "Start", overlayOpacity: 50 } },
      course.lessons[1],
    ] };
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<CoursePreview initialData={data} initialLessonId="first" authorName="Author" standalone progressAdapter={{ load: () => null, save: () => {} }} />); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const start = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Start")!;
    expect(start).toBeDefined();
    const canvas = container.querySelector<HTMLElement>('[data-slide-canvas=""]')!;
    Object.defineProperties(canvas, { scrollHeight: { configurable: true, value: 540 }, clientHeight: { configurable: true, value: 540 }, scrollTop: { configurable: true, value: 0 } });
    await act(async () => { canvas.dispatchEvent(new Event("scroll")); await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(start.disabled).toBe(false);
    await act(async () => start.click());
    expect(container.querySelector('#preview-content-second')?.getAttribute("aria-hidden")).toBe("false");
    act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();
  });
  it("tracks the slide canvas scroll before unlocking Next", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let saved: LearnerProgressSnapshot | null = null;
    const adapter = { load: () => null, save: (_id: string, snapshot: LearnerProgressSnapshot) => { saved = snapshot; } };
    await act(async () => {
      root.render(<CoursePreview initialData={course} initialLessonId="first" authorName="Author" standalone progressAdapter={adapter} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    const canvas = container.querySelector<HTMLElement>('[data-slide-canvas=""]')!;
    expect(canvas.contains(container.querySelector('[aria-label="Open slide menu"]'))).toBe(true);
    expect(canvas.contains(container.querySelector('[aria-label="Slide navigation"]'))).toBe(true);
    expect(container.querySelector('[data-slide-footer]')?.contains(container.querySelector('[aria-label="Slide navigation"]'))).toBe(true);
    expect(container.querySelector('[data-presentation-view]')?.classList.contains("bg-white")).toBe(true);
    Object.defineProperties(canvas, {
      scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    await act(async () => { canvas.dispatchEvent(new Event("scroll", { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(saved!.visitedLessonIds).not.toContain("first");
    const next = [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Next")!;
    expect(next.disabled).toBe(true);
    expect(container.querySelector('[aria-label="Slide thumbnails"]')).toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Open slide menu"]')!.click());
    expect(canvas.contains(container.querySelector('#slide-course-menu'))).toBe(true);
    expect(container.querySelector('[data-presentation-view]')?.contains(container.querySelector('#slide-course-menu'))).toBe(true);
    expect(container.querySelector('[aria-label="Course completion"]')?.getAttribute("aria-valuenow")).toBe("0");
    expect(container.querySelector<HTMLButtonElement>('[aria-label^="Next slide. Locked"]')?.disabled).toBe(true);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close slide menu"]')!.click());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })));
    expect(container.querySelector('#preview-content-first')?.getAttribute("aria-hidden")).toBe("false");
    act(() => { canvas.scrollTop = 500; canvas.dispatchEvent(new Event("scroll", { bubbles: true })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(saved!.visitedLessonIds).toContain("first");
    expect(next.disabled).toBe(false);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Open slide menu"]')!.click());
    expect(container.querySelector('[aria-label="Course completion"]')?.getAttribute("aria-valuenow")).toBe("50");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next slide"]')!.click());
    expect(container.querySelector('[aria-label="Open slide menu"]')).not.toBeNull();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.querySelector('#preview-content-second')?.getAttribute("aria-hidden")).toBe("false");
    act(() => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Previous")!.click());
    expect(container.querySelector('#preview-content-first')?.getAttribute("aria-hidden")).toBe("false");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })));
    expect(container.querySelector('#preview-content-second')?.getAttribute("aria-hidden")).toBe("false");
    act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();
  });

  it("keeps a restricted slide locked until its audio object finishes", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    const data: PreviewData = { ...course, navigationMode: "restricted", lessons: [
      { ...course.lessons[0], blocks: [blockSchema.parse({ id: "audio", version: 1, type: "audio", data: { src: "/api/assets/507f1f77bcf86cd799439011/file", fileName: "Lesson.mp3", mimeType: "audio/mpeg" }, slideFrame: { x: 12, y: 8, width: 76, height: 80, z: 0 } })] },
      course.lessons[1],
    ] };
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let saved: LearnerProgressSnapshot | null = null;
    await act(async () => { root.render(<CoursePreview initialData={data} initialLessonId="first" authorName="Author" standalone progressAdapter={{ load: () => null, save: (_id, snapshot) => { saved = snapshot; } }} />); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const canvas = container.querySelector<HTMLElement>('[data-slide-canvas=""]')!;
    Object.defineProperties(canvas, { scrollHeight: { configurable: true, value: 540 }, clientHeight: { configurable: true, value: 540 }, scrollTop: { configurable: true, value: 0 } });
    await act(async () => { canvas.dispatchEvent(new Event("scroll")); await new Promise((resolve) => setTimeout(resolve, 20)); });
    const next = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Next")!;
    expect(next.disabled).toBe(true);
    expect(saved!.interactedContentIds).not.toContain("audio:listened");
    await act(async () => { container.querySelector("audio")!.dispatchEvent(new Event("ended")); await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(saved!.interactedContentIds).toContain("audio:listened");
    expect(next.disabled).toBe(false);
    act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();
  });
});
