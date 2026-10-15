/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseGenerationDialog, getCourseGenerationProgressStages } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("course generation structure previews", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onApply: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onApply = vi.fn();
    await act(async () => {
      root.render(createElement(CourseGenerationDialog, {
        open: true,
        onClose: () => undefined,
        courseId: "course-1",
        courseTitle: "Learning the Basics",
        courseDescription: "A sample course description.",
        existingLessonCount: 0,
        onApply,
      }));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows source preparation and course generation as separate parent steps", () => {
    const [sourcePreparation, courseGeneration] = getCourseGenerationProgressStages({
      status: "extracting",
      sourcePageCount: 35,
      completedWorkUnits: 4,
      totalWorkUnits: 8,
    });

    expect(sourcePreparation).toMatchObject({
      step: 1,
      title: "Prepare source",
      status: "active",
      completed: 4,
      total: 8,
    });
    expect(courseGeneration).toMatchObject({
      step: 2,
      title: "Generate course",
      status: "upcoming",
      completed: 0,
      total: null,
    });

    const [, planningCourse] = getCourseGenerationProgressStages({
      status: "planning",
      sourcePageCount: 35,
      completedWorkUnits: 8,
      totalWorkUnits: 8,
    });
    expect(planningCourse).toMatchObject({
      status: "active",
      completed: 0,
      total: null,
      detail: "Choosing lesson groups and titles",
    });

    const [finishedSource, activeCourse] = getCourseGenerationProgressStages({
      status: "generatingPreActivities",
      sourcePageCount: 35,
      completedWorkUnits: 9,
      totalWorkUnits: 17,
    });
    expect(finishedSource).toMatchObject({ status: "complete", completed: 8, total: 8 });
    expect(activeCourse).toMatchObject({ status: "active", completed: 1, total: 9 });
  });

  function hoverStructure(labelText: string) {
    const label = Array.from(container.querySelectorAll("label")).find((candidate) =>
      candidate.textContent?.includes(labelText),
    );
    if (!label) throw new Error(`Could not find structure option: ${labelText}`);
    act(() => {
      label.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
  }

  it("shows saved smaller parts without changing the parent lesson total", () => {
    const [, generation] = getCourseGenerationProgressStages({
      status: "generatingLearn", sourcePageCount: 20,
      completedWorkUnits: 8, totalWorkUnits: 13,
      learnProgress: { completedParts: 1, totalParts: 2 },
    });
    expect(generation.total).toBe(8);
    expect(generation.detail).toContain("smaller parts (1/2 saved)");
  });

  it("shows the learner course preview for Pre / Learn / Post activities on hover", () => {
    hoverStructure("Pre / Learn / Post activities");

    expect(container.querySelector('[aria-label="Pre / Learn / Post learner preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Pre activities");
    expect(container.textContent).toContain("Learning lesson 2");
    expect(container.textContent).toContain("Post-test");
    expect(container.textContent).toContain("Course description");
  });

  it("shows an example learner preview for the custom structure on hover", () => {
    hoverStructure("Custom course structure");

    expect(container.querySelector('[aria-label="Custom structure learner preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Getting started");
    expect(container.textContent).toContain("Knowledge check");
    expect(container.textContent).toContain("Welcome");
  });

  it("defaults to English and offers only English and Khmer as target languages", () => {
    const languageSelect = Array.from(container.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("Target language"),
    )?.querySelector("select");

    expect(languageSelect).not.toBeNull();
    expect(Array.from(languageSelect!.options).map((option) => option.value)).toEqual(["English", "Khmer"]);
    expect(languageSelect!.value).toBe("English");
  });

  it("generates and applies prompt-only Custom content after hiding an invalid Pre/Post setting", async () => {
    const draft = {
      title: "Custom prompt course", description: "A course generated from a prompt.", sections: [], lessons: [],
      template: "custom", learningLessonCount: 0, generatedImageCount: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(draft), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const postTestCount = Array.from(container.querySelectorAll("label")).find((label) => label.textContent?.includes("Post-test questions"))?.querySelector("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(postTestCount, "0");
      postTestCount?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLInputElement>('input[name="course-structure"][value="custom"]')?.click());
    const prompt = container.querySelector("textarea");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(prompt, "Teach HTML and CSS with clear code examples.");
      prompt?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("template")).toBe("custom");
    expect(form.get("prompt")).toBe("Teach HTML and CSS with clear code examples.");
    expect(form.has("file")).toBe(false);
    expect(form.has("postTestCount")).toBe(false);
    expect(form.has("slidesPerContent")).toBe(false);
    expect(container.textContent).toContain("Draft ready");
    const apply = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Use generated course and save"));
    await act(async () => apply?.click());
    expect(onApply).toHaveBeenCalledWith(draft, "replace");
  });

  it("does not contact the generation API just because the popup opens with a saved job", async () => {
    window.localStorage.setItem("course-generation:course-1", "saved-job-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(CourseGenerationDialog, {
        open: true,
        onClose: () => undefined,
        courseId: "course-1",
        courseTitle: "Learning the Basics",
        courseDescription: "A sample course description.",
        existingLessonCount: 0,
        onApply: () => undefined,
      }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows and applies the completed PDF course while its source file remains selected", async () => {
    const job = (status: string, extra: Record<string, unknown> = {}) => ({
      jobId: "job-1",
      status,
      fileName: "khmer-lesson.pdf",
      sourcePageCount: status === "indexing" || status === "extracting" ? null : 12,
      sourceLanguage: "English",
      summary: status === "awaitingPrompt" || status === "planning" || status === "completed"
        ? "The slides introduce HTML structure, explain common tags, and include short examples."
        : "",
      completedWorkUnits: 0,
      totalWorkUnits: 4,
      errorMessage: null,
      ...extra,
    });
    const draft = {
      title: "PDF course",
      description: "Generated from the uploaded PDF.",
      sections: [{ id: "learn", title: "Learn", order: 0 }],
      lessons: [{ id: "lesson-1", sectionId: "learn", title: "HTML elements", icon: "book", lessonType: "content", order: 0, quizQuestions: [], blocks: [] }],
      template: "custom",
      learningLessonCount: 0,
      generatedImageCount: 0,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(job("indexing")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("indexing")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("extracting")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("extracting")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("awaitingPrompt")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("planning")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("planning")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(job("completed", { course: draft })), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput?.accept).toContain(".pdf");
    const pdf = new File(["%PDF-1.7"], "khmer-lesson.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [pdf] });
    await act(async () => {
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const smartGrouping = container.querySelector<HTMLInputElement>('input[name="learn-grouping-mode"][value="smart"]');
    expect(smartGrouping?.checked).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Source file ready");
    expect(container.textContent).toContain("to build the course directly from this file");

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledTimes(8);
    const [startUrl, startRequest] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(startUrl).toBe("/api/courses/course-1/generate");
    const request = startRequest;
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("action")).toBe("generate");
    expect((request.body as FormData).has("jobId")).toBe(false);
    expect((request.body as FormData).get("file")).toBeInstanceOf(File);
    expect((request.body as FormData).get("learnGroupingMode")).toBe("smart");
    expect((request.body as FormData).get("slidesPerContent")).toBe("5");
    expect(container.textContent).toContain("Draft ready");
    expect(container.textContent).toContain("PDF course");
    expect(container.textContent).toContain("HTML elements");
    expect(container.querySelector('[aria-label="Source file ready"]')).toBeNull();
    const applyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Use generated course and save"),
    );
    expect(applyButton).toBeDefined();
    expect(applyButton?.disabled).toBe(false);
    await act(async () => applyButton?.click());
    expect(onApply).toHaveBeenCalledWith(draft, "replace");
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
  });

  it("recovers a completed source draft after its browser job reference is lost", async () => {
    const draft = {
      title: "Recovered PDF course",
      description: "The previously completed draft.",
      sections: [],
      lessons: [],
      template: "custom",
      learningLessonCount: 0,
      generatedImageCount: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      jobId: "completed-job-1",
      status: "completed",
      fileName: "slides.pdf",
      sourcePageCount: 20,
      sourceLanguage: "English",
      summary: "Source summary.",
      completedWorkUnits: 12,
      totalWorkUnits: 12,
      errorMessage: null,
      course: draft,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
    const restoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Load last completed draft"),
    );
    await act(async () => {
      restoreButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/courses/course-1/generate");
    expect(container.textContent).toContain("Recovered PDF course");
    expect(container.textContent).toContain("Draft ready");
    const applyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Use generated course and save"),
    );
    await act(async () => applyButton?.click());
    expect(onApply).toHaveBeenCalledWith(draft, "replace");
  });

  it("lets users choose fixed grouping and configure its slide count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      fileName: "slides.pdf",
      sourcePageCount: 2,
      summary: "The slides introduce a topic and explain its main steps.",
    }), { status: 200 })));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const pdf = new File(["%PDF-1.7"], "slides.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [pdf] });
    await act(async () => {
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const fixedGrouping = container.querySelector<HTMLInputElement>('input[name="learn-grouping-mode"][value="fixed"]');
    expect(fixedGrouping).not.toBeNull();
    await act(async () => {
      fixedGrouping?.click();
    });
    expect(container.textContent).toContain("Slides per Learn content item");
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("5");
  });
});
