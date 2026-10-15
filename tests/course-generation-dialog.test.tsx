/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseGenerationDialog, getCourseGenerationProgressStages, getPromptCourseGenerationProgressStages } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-dialog";

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

  it("describes prompt preparation as complete and course writing as indeterminate", () => {
    const [preparation, generation] = getPromptCourseGenerationProgressStages();
    expect(preparation).toMatchObject({ step: 1, title: "Prepare prompt", status: "complete", completed: 1, total: 1 });
    expect(generation).toMatchObject({ step: 2, title: "Generate course", status: "active", completed: 0, total: null });
  });

  async function enterPrompt() {
    await act(async () => {
      const prompt = container.querySelector("textarea")!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(prompt, "Teach HTML and CSS with clear examples.");
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("prefills an editable starter prompt without requesting generation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const prompt = container.querySelector("textarea")!;
    expect(prompt.value).toContain("Generate interactive content following the selected course structure and settings");
    expect(prompt.value).toContain("clear paragraphs");
    expect(prompt.value).not.toMatch(/Khmer|English|five slides/);
    expect(container.querySelector('[role="group"][aria-label="Add prompt instructions"]')?.querySelectorAll("button")).toHaveLength(5);
    expect(fetchMock).not.toHaveBeenCalled();
    await enterPrompt();
    expect(prompt.value).toBe("Teach HTML and CSS with clear examples.");
  });

  it("places the source slides upload directly after the prompt and before course settings", () => {
    const prompt = container.querySelector("textarea")!;
    const sourceInput = container.querySelector<HTMLInputElement>('input[aria-label="Upload PDF or PowerPoint source"]')!;
    const promptField = prompt.parentElement!;
    const sourceField = sourceInput.closest("label")!;
    expect(promptField.nextElementSibling).toBe(sourceField);
    expect(sourceField.textContent).toContain("Source slides (optional)");
    expect(sourceField.nextElementSibling?.querySelector("legend")?.textContent).toBe("Course structure");
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it.each([
    ["Keep source details", "preserve all meaningful information"],
    ["Explain code", "HTML, CSS, and JavaScript examples in code blocks"],
    ["Guided practice", "process steps for sequences"],
    ["Summary & next lesson", "normal text blocks with bold labels"],
    ["Continue buttons", "Continue buttons at natural stopping points"],
  ])("appends %s instructions without replacing the user's prompt or submitting", async (label, expectedText) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await enterPrompt();
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label)!;
    await act(async () => button.click());
    const prompt = container.querySelector("textarea")!;
    expect(prompt.value).toMatch(/^Teach HTML and CSS with clear examples\.\n\n/);
    expect(prompt.value).toContain(expectedText);
    expect(document.activeElement).toBe(prompt);
    expect(button.disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const previous = prompt.value;
    await act(async () => button.click());
    expect(prompt.value).toBe(previous);
  });

  it("sends the edited starter and extra instructions through the existing generation request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: "Example course", sections: [], lessons: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "Explain code")!.click());
    const prompt = container.querySelector("textarea")!.value;
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1].body as FormData).get("prompt")).toBe(prompt);
  });

  it("keeps prompt instructions within the existing character limit", async () => {
    const prompt = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(prompt, "x".repeat(4_990));
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Add prompt instructions"] button');
    expect(Array.from(buttons).every((button) => button.disabled)).toBe(true);
    expect(prompt.value).toHaveLength(4_990);
    expect(prompt.maxLength).toBe(5_000);
  });

  async function restoreSavedJob() {
    window.localStorage.setItem("course-generation:course-1", "saved-job-1");
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(CourseGenerationDialog, {
      open: true, onClose: () => undefined, courseId: "course-1",
      courseTitle: "Learning the Basics", courseDescription: "", existingLessonCount: 0, onApply,
    })));
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)); });
  }

  async function clickCancel() {
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => /^Cancel (job|generation)$/.test(button.textContent ?? ""))!.click());
  }

  const draft = (title: string) => ({ title, description: "Generated course", sections: [], lessons: [], template: "custom", learningLessonCount: 0, generatedImageCount: 0 });
  const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

  it("clears an expired saved job and waits for an explicit new generation", async () => {
    await restoreSavedJob();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "Generation job was not found." }, 404))
      .mockResolvedValueOnce(jsonResponse(draft("Fresh prompt course")));
    vi.stubGlobal("fetch", fetchMock);
    await enterPrompt();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("expired or was removed");
    expect(container.querySelector("textarea")?.value).toContain("Teach HTML");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1].body as FormData).has("jobId")).toBe(false);
    expect(container.textContent).toContain("Fresh prompt course");
  });

  it.each([200, 404, 400])("cancels or clears a saved job with response %s without advancing it", async (status) => {
    await restoreSavedJob();
    const payload = status === 200 ? { status: "cancelled" } : { error: status === 404 ? "Generation job was not found." : "Invalid generation job identifier." };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload, status));
    vi.stubGlobal("fetch", fetchMock);
    await clickCancel();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("action")).toBe("cancelGeneration");
    expect(body.get("jobId")).toBe("saved-job-1");
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toMatch(/Generation cancelled|reference was cleared/);
  });

  it("retains a saved job when cancellation fails so cancellation can be retried", async () => {
    await restoreSavedJob();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Service unavailable" }, 503)));
    await clickCancel();
    expect(window.localStorage.getItem("course-generation:course-1")).toBe("saved-job-1");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Service unavailable");
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Cancel job")?.disabled).toBe(false);
  });

  it("keeps an already completed draft when cancellation races completion", async () => {
    await restoreSavedJob();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "completed", course: draft("Completed before cancellation") })));
    await clickCancel();
    expect(container.textContent).toContain("Completed before cancellation");
    expect(container.textContent).toContain("already completed");
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
  });

  it("ignores a cancelled prompt response while the next generation is running", async () => {
    const finishes: ((response: Response) => void)[] = [];
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => finishes.push(resolve)));
    vi.stubGlobal("fetch", fetchMock);
    await enterPrompt();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await clickCancel();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await act(async () => finishes[0](jsonResponse(draft("Cancelled old draft"))));
    expect(container.textContent).not.toContain("Cancelled old draft");
    expect(container.querySelector('[aria-label="Course generation progress"]')).not.toBeNull();
    await act(async () => finishes[1](jsonResponse(draft("New draft"))));
    expect(container.textContent).toContain("New draft");
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
  });

  it("stops source advancement and ignores an in-flight step after cancellation", async () => {
    await restoreSavedJob();
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const action = (init.body as FormData).get("action");
      if (action === "advanceGeneration") return new Promise<Response>((resolve) => { finish = resolve; });
      return Promise.resolve(jsonResponse({ jobId: "saved-job-1", status: action === "cancelGeneration" ? "cancelled" : "generatingLearn", sourcePageCount: 20, completedWorkUnits: 8, totalWorkUnits: 13 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await clickCancel();
    expect(fetchMock.mock.calls[3][1].signal.aborted).toBe(true);
    await act(async () => finish(jsonResponse({ status: "completed", course: draft("Cancelled source draft") })));
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(container.textContent).not.toContain("Cancelled source draft");
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
  });

  it("does not treat an unrelated course access error as an expired job", async () => {
    await restoreSavedJob();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Course was not found." }, 404)));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(window.localStorage.getItem("course-generation:course-1")).toBe("saved-job-1");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Course was not found.");
  });

  it("cancels a late-created source job without advancing or restoring it", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(jsonResponse({ status: "cancelled" }));
    vi.stubGlobal("fetch", fetchMock);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF"], "slides.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await clickCancel();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish(jsonResponse({ jobId: "late-created", status: "indexing" })));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = fetchMock.mock.calls[1][1].body as FormData;
    expect(body.get("action")).toBe("cancelGeneration");
    expect(body.get("jobId")).toBe("late-created");
    expect(window.localStorage.getItem("course-generation:course-1")).toBeNull();
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
  });

  it.each(["preLearnPost", "custom"])("shows both steps throughout a prompt-only %s request", async (template) => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    if (template === "custom") await act(async () => container.querySelector<HTMLInputElement>('input[name="course-structure"][value="custom"]')!.click());
    await enterPrompt();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const progress = container.querySelector('[aria-label="Course generation progress"]')!;
    expect(progress).not.toBeNull();
    expect(progress.querySelectorAll("li")).toHaveLength(2);
    expect(progress.textContent).toContain("Prepare prompt");
    expect(progress.textContent).toContain("Step 1 of 2");
    expect(progress.textContent).toContain("Step 2 of 2");
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Generate course");
    expect(progress.querySelector('[aria-label="Generate course progress"]')?.hasAttribute("aria-valuenow")).toBe(false);
    expect(progress.textContent).not.toContain("Prepare source");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1].body as FormData).has("file")).toBe(false);
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Add prompt instructions"] button')).every((button) => button.disabled)).toBe(true);
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBe(progress);
    await act(async () => finish(new Response(JSON.stringify({ title: "Prompt course", description: "A generated course", sections: [], lessons: [], template, learningLessonCount: 0, generatedImageCount: 0 }), { status: 200 })));
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
    expect(container.textContent).toContain("Draft ready");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears prompt steps and shows the provider error when generation fails", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; })));
    await enterPrompt();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelector('[aria-label="Course generation progress"]')).not.toBeNull();
    await act(async () => finish(new Response(JSON.stringify({ error: "The provider is busy. Try again." }), { status: 503 })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("The provider is busy");
    expect(container.querySelector('[aria-label="Course generation progress"]')).toBeNull();
  });

  it("replaces stale completed-file progress when starting a new prompt-only request", async () => {
    const course = { title: "Old file course", description: "", sections: [], lessons: [], template: "custom", learningLessonCount: 0, generatedImageCount: 0 };
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", sourcePageCount: 20, completedWorkUnits: 12, totalWorkUnits: 12, course }), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Load last completed draft"))!.click());
    expect(container.textContent).toContain("Draft ready");
    await enterPrompt();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const progress = container.querySelector('[aria-label="Course generation progress"]')!;
    expect(progress.textContent).toContain("Prepare prompt");
    expect(progress.textContent).not.toContain("Prepare source");
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Generate course");
    await act(async () => finish(new Response(JSON.stringify(course), { status: 200 })));
  });

  it("shows source steps immediately while the first file request is pending", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; })));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["%PDF"], "slides.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const progress = container.querySelector('[aria-label="Course generation progress"]')!;
    expect(progress.textContent).toContain("Prepare source");
    expect(progress.textContent).not.toContain("Prepare prompt");
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Prepare source");
    await act(async () => finish(new Response(JSON.stringify({ error: "Test request stopped" }), { status: 503 })));
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
