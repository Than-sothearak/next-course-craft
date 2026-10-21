/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "../app/courses/[courseId]/preview/course-preview";
import { blockSchema } from "../lib/schemas/block";
import type { LearnerProgressSnapshot } from "../lib/export/progress";

const courseId = "preview-gate-course";
const progressKey = `coursecraft-progress-v2-${courseId}`;
const priorProgress = {
  visitedLessonIds: [],
  lessonScrollProgress: {},
  revealedDividerIds: ["gate-1"],
  completedDividerIds: [],
  selectedLessonId: null,
};
const initialData: PreviewData = {
  courseId,
  title: "Preview with a Continue gate",
  description: "",
  authorVisible: false,
  theme: {
    preset: "forest",
    primaryColor: "#24734f",
    accentColor: "#f2a65a",
    fontFamily: "sans",
  },
  sections: [{ id: "section-1", title: "Section 1", order: 0 }],
  lessons: [
    {
      id: "lesson-1",
      sectionId: "section-1",
      title: "Lesson with a gate",
      lessonType: "content",
      icon: "file",
      order: 0,
      blocks: [
        {
          id: "study-cards",
          version: 1,
          type: "flipCard",
          width: "small",
          widthCustom: false,
          backgroundColor: "#ffffff",
          blockPadding: 20,
          data: {
            cardsPerRow: 3,
            cardStyle: "classic",
            cardBackgroundColor: "#ffffff",
            cardTextColor: "#0f172a",
            cards: [
              {
                id: "card-1",
                frontLabel: "Question",
                front: { type: "text", text: "What is active recall?" },
                backLabel: "Answer",
                back: { type: "text", text: "Retrieving information from memory." },
              },
              {
                id: "card-2",
                frontLabel: "Question",
                front: { type: "text", text: "What does retrieval practice do?" },
                backLabel: "Answer",
                back: { type: "text", text: "It helps strengthen recall." },
              },
            ],
          },
        },
        {
          id: "gate-1",
          version: 1,
          type: "divider",
          width: "small",
          widthCustom: false,
          backgroundColor: "#ffffff",
          blockPadding: 20,
          data: {
            style: "continue",
            label: "Continue",
            completionType: "completeAbove",
          },
        },
      ],
      quizQuestions: [],
    },
  ],
};

function twoLessonCourse(navigationMode: NonNullable<PreviewData["navigationMode"]>) {
  const data = structuredClone(initialData);
  data.courseId = `navigation-${navigationMode}-course`;
  data.navigationMode = navigationMode;
  data.lessons.push({
    id: "lesson-2",
    sectionId: "section-1",
    title: "Second lesson",
    lessonType: "content",
    icon: "file",
    order: 1,
    blocks: [{
      id: "second-content",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Second lesson content.</p>" },
    }],
    quizQuestions: [],
  });
  return data;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  localStorage.clear();
  localStorage.setItem(progressKey, JSON.stringify(priorProgress));
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: (id: number) => window.clearTimeout(id),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("admin course preview progress", () => {
  it.each([
    ["free", false], ["free", true], ["sequential", false], ["sequential", true], ["restricted", false], ["restricted", true],
  ] as const)("applies %s lesson completion rules in the preview (standalone=%s)", async (navigationMode, standalone) => {
    const data = structuredClone(initialData);
    data.courseId = `reading-completion-${navigationMode}-${standalone}`;
    data.navigationMode = navigationMode;
    const lesson = data.lessons[0];
    lesson.blocks = [lesson.blocks[0], ...[
      { type: "accordion", data: { items: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
      { type: "processSteps", data: { steps: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
      { type: "labeledGraphic", data: { src: "/diagram.png", alt: "Diagram", markers: [{ id: "point", label: "Point", description: "Explanation", x: 50, y: 50 }] } },
      { type: "knowledgeCheck", data: { question: "Question?", options: ["A", "B"] } },
      { type: "survey", data: { question: "How confident?", minLabel: "Low", maxLabel: "High" } },
      { type: "video", data: { src: "/lesson.mp4", mimeType: "video/mp4" } },
    ].map((block, index) => blockSchema.parse({ ...block, id: `activity-${index}`, version: 1 }))];
    const save = vi.fn();
    const progressAdapter = { load: () => null, save };
    await act(async () => {
      root.render(createElement(CoursePreview, { initialData: data, authorName: "Author", standalone, initialLessonId: lesson.id, progressAdapter }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    const body = container.querySelector<HTMLElement>(`#preview-content-${lesson.id} > div`)!;
    Object.defineProperties(body, {
      scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 500 }, scrollTop: { configurable: true, writable: true, value: 0 },
    });
    act(() => body.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).visitedLessonIds).not.toContain(lesson.id);
    act(() => { body.scrollTop = 500; body.dispatchEvent(new Event("scroll", { bubbles: true })); });
    const snapshot = save.mock.lastCall![1] as LearnerProgressSnapshot;
    const completesAfterReading = navigationMode !== "restricted";
    expect(snapshot.visitedLessonIds.includes(lesson.id)).toBe(completesAfterReading);
    if (navigationMode === "restricted") {
      expect(snapshot.lessonScrollProgress[lesson.id]).toBe(60);
      expect(container.querySelector('[aria-label="Lesson 60% complete"]')).not.toBeNull();
    } else {
      expect(snapshot.lessonScrollProgress[lesson.id]).toBe(100);
    }
    expect(save.mock.lastCall![2]).toBe(completesAfterReading);
    expect(snapshot.interactedContentIds).not.toContain("study-cards:card-1");
    expect(snapshot.interactedContentIds).not.toContain("activity-3:answer");
    expect(container.querySelector('[data-lesson-block-id="study-cards"] button')?.getAttribute("aria-pressed")).toBe("false");
  });

  it("counts restricted activities in the lesson circle and unlocks the sidebar after both requirements are met", async () => {
    const data = twoLessonCourse("restricted");
    const save = vi.fn();
    data.lessons[0].blocks = data.lessons[0].blocks.filter(
      (block) => block.type !== "divider" || block.data.style !== "continue",
    );
    await act(async () => {
      root.render(createElement(CoursePreview, {
        initialData: data,
        authorName: "Course author",
        initialLessonId: data.lessons[0].id,
        persistLocalProgress: false,
        progressAdapter: { load: () => null, save },
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });

    const scrollContainer = container.querySelector<HTMLElement>(
      `#preview-content-${data.lessons[0].id} > div`,
    );
    const getSecondLesson = () => container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Second lesson"]',
    );
    const getFirstLesson = () => container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Lesson with a gate"]',
    );
    expect(scrollContainer).not.toBeNull();
    expect(getSecondLesson()?.disabled).toBe(true);
    if (!scrollContainer) return;
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 500 },
    });
    act(() => scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true })));

    const getLessonCircle = () => getFirstLesson()?.querySelector<SVGElement>(
      '[role="img"][aria-label^="Lesson "]',
    );
    expect(getLessonCircle()?.getAttribute("aria-label")).toBe("Lesson 50% complete");

    const firstCard = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Flip card 1 to reveal the back"]',
    );
    expect(firstCard).not.toBeNull();
    await act(async () => {
      firstCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show the front of card 1"]',
    )?.getAttribute("aria-pressed")).toBe("true");
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).interactedContentIds).toContain("study-cards:card-1");
    expect(getLessonCircle()?.getAttribute("aria-label")).toBe("Lesson 75% complete");
    expect(getSecondLesson()?.disabled).toBe(true);

    act(() => {
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Flip card 2 to reveal the back"]',
      )?.click();
    });
    // The interaction commits first; the reading/completion effect then runs
    // on the next animation frame. Waiting inside the click's act callback can
    // finish before React schedules that effect.
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
    expect(getFirstLesson()?.querySelector('[aria-label="Lesson complete"]')).not.toBeNull();
    expect(getSecondLesson()?.disabled).toBe(false);
  });

  it.each([false, true])("enforces required Continue interactions in free mode and completes optional content afterward (standalone=%s)", async (standalone) => {
    const data = structuredClone(initialData);
    data.courseId = `free-reading-gate-${standalone}`;
    data.navigationMode = "free";
    const lesson = data.lessons[0];
    lesson.blocks.push(blockSchema.parse({ id: "after-gate", version: 1, type: "richText", data: { html: "<p>Read this final section.</p>" } }));
    lesson.blocks.push(blockSchema.parse({ id: "optional-after-gate", version: 1, type: "flipCard", data: { cards: [{ id: "optional", frontLabel: "Question", front: { type: "text", text: "Optional question" }, backLabel: "Answer", back: { type: "text", text: "Optional answer" } }] } }));
    const save = vi.fn();
    await act(async () => {
      root.render(createElement(CoursePreview, { initialData: data, authorName: "Author", standalone, initialLessonId: lesson.id, progressAdapter: { load: () => null, save } }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    const body = container.querySelector<HTMLElement>(`#preview-content-${lesson.id} > div`)!;
    let scrollHeight = 1000;
    Object.defineProperties(body, {
      scrollHeight: { configurable: true, get: () => scrollHeight }, clientHeight: { configurable: true, value: 500 }, scrollTop: { configurable: true, writable: true, value: 0 },
    });
    const continueButton = container.querySelector<HTMLButtonElement>('[data-lesson-block-id="gate-1"] button')!;
    expect(continueButton.disabled).toBe(true);
    expect(continueButton.parentElement?.textContent).toContain("Complete the interactive activities above");
    act(() => { body.scrollTop = 500; body.dispatchEvent(new Event("scroll", { bubbles: true })); });
    expect(continueButton.disabled).toBe(true);
    act(() => container.querySelector<HTMLButtonElement>('[data-lesson-block-id="study-cards"] button[aria-label="Flip card 1 to reveal the back"]')!.click());
    expect(continueButton.disabled).toBe(true);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-lesson-block-id="study-cards"] button[aria-label="Flip card 2 to reveal the back"]')!.click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(continueButton.disabled).toBe(false);
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).visitedLessonIds).not.toContain(lesson.id);
    scrollHeight = 1500;
    await act(async () => { continueButton.click(); await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    expect(container.querySelector('[data-lesson-block-id="after-gate"]')).not.toBeNull();
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).visitedLessonIds).not.toContain(lesson.id);
    act(() => { body.scrollTop = 1000; body.dispatchEvent(new Event("scroll", { bubbles: true })); });
    const snapshot = save.mock.lastCall![1] as LearnerProgressSnapshot;
    expect(snapshot.visitedLessonIds).toContain(lesson.id);
    expect(snapshot.lessonScrollProgress[lesson.id]).toBe(100);
    expect(snapshot.interactedContentIds).toContain("study-cards:card-1");
    expect(snapshot.interactedContentIds).not.toContain("optional-after-gate:optional");
    expect(save.mock.lastCall![2]).toBe(true);
  });

  it.each(["none", "completeAbove"] as const)("hides Next section until all Continue buttons are used in free mode (%s)", async (completionType) => {
    const data = twoLessonCourse("free");
    data.courseId = `free-continue-next-${completionType}`;
    const lesson = data.lessons[0];
    const firstGate = lesson.blocks[1];
    if (firstGate.type !== "divider") throw new Error("Expected Continue gate");
    firstGate.data.completionType = completionType;
    lesson.blocks.push(blockSchema.parse({ id: "second-gate", version: 1, type: "divider", data: { style: "continue", completionType: "none" } }));
    await act(async () => root.render(createElement(CoursePreview, { initialData: data, authorName: "Author", initialLessonId: lesson.id, persistLocalProgress: false })));
    const body = container.querySelector<HTMLElement>(`#preview-content-${lesson.id} > div`)!;
    Object.defineProperties(body, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 500 }, scrollTop: { configurable: true, writable: true, value: 0 } });
    const nextSection = () => container.querySelector('nav[aria-label="Next section from content 1"] button');
    const firstButton = container.querySelector<HTMLButtonElement>('[data-lesson-block-id="gate-1"] button')!;
    expect(nextSection()).toBeNull();
    if (completionType === "completeAbove") {
      expect(firstButton.disabled).toBe(true);
      act(() => { body.scrollTop = 500; body.dispatchEvent(new Event("scroll", { bubbles: true })); });
      expect(firstButton.disabled).toBe(true);
      await act(async () => {
        for (const button of container.querySelectorAll<HTMLButtonElement>('[data-lesson-block-id="study-cards"] button')) button.click();
        await new Promise((resolve) => window.setTimeout(resolve, 10));
      });
    }
    expect(firstButton.disabled).toBe(false);
    expect(nextSection()).toBeNull();
    act(() => firstButton.click());
    expect(nextSection()).toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('[data-lesson-block-id="second-gate"] button')!.click());
    expect(nextSection()).not.toBeNull();
  });

  it("still requires a passing assessment for a graded quiz in free navigation", async () => {
    const data = structuredClone(initialData);
    data.courseId = "free-graded-quiz";
    data.navigationMode = "free";
    const lesson = data.lessons[0];
    lesson.lessonType = "quiz";
    lesson.blocks = [];
    lesson.quizQuestions = [{ id: "q", prompt: "Question?", imageSrc: "", imageAlt: "", selectionMode: "single", choices: [{ id: "a", text: "Correct", imageSrc: "", imageAlt: "" }, { id: "b", text: "Incorrect", imageSrc: "", imageAlt: "" }], correctChoiceIds: ["a"], correctFeedback: "Correct", incorrectFeedback: "Try again" }];
    const save = vi.fn();
    await act(async () => {
      root.render(createElement(CoursePreview, { initialData: data, authorName: "Author", initialLessonId: lesson.id, progressAdapter: { load: () => null, save } }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    const body = container.querySelector<HTMLElement>(`#preview-content-${lesson.id} > div`)!;
    Object.defineProperties(body, { scrollHeight: { configurable: true, value: 500 }, clientHeight: { configurable: true, value: 500 } });
    act(() => body.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).visitedLessonIds).not.toContain(lesson.id);
    act(() => container.querySelector<HTMLInputElement>('input[value="a"]')!.click());
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Check answer")!.click());
    expect((save.mock.lastCall![1] as LearnerProgressSnapshot).visitedLessonIds).toContain(lesson.id);
    expect(save.mock.lastCall![2]).toBe(true);
  });

  it("searches and collapses the section navigation with section progress", async () => {
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const sectionToggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section Section 1"]',
    );
    const lessonSearch = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search lessons and quizzes"]',
    );
    const sectionLessons = container.querySelector<HTMLUListElement>(
      "#lesson-nav-section-section-1",
    );
    expect(sectionToggle?.textContent).toContain("0/1 complete");
    expect(sectionToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(lessonSearch).not.toBeNull();
    expect(sectionLessons?.hidden).toBe(false);

    const setSearchValue = async (value: string) => {
      await act(async () => {
        if (!lessonSearch) return;
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set?.call(lessonSearch, value);
        lessonSearch.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
    };

    await setSearchValue("not a lesson");
    expect(container.textContent).toContain("No lessons or quizzes match that search.");
    await setSearchValue("");
    const restoredSectionLessons = container.querySelector<HTMLUListElement>(
      "#lesson-nav-section-section-1",
    );
    expect(restoredSectionLessons?.querySelector("button")).not.toBeNull();
    const restoredSectionToggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle section Section 1"]',
    );

    await act(async () => {
      restoredSectionToggle?.click();
    });
    expect(restoredSectionToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(restoredSectionLessons?.hidden).toBe(true);
  });

  it("allows students to open any lesson with free navigation", async () => {
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: twoLessonCourse("free"),
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const secondLesson = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Second lesson"]',
    );
    expect(secondLesson?.disabled).toBe(false);
    await act(async () => {
      secondLesson?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(secondLesson?.getAttribute("aria-current")).toBe("page");
  });

  it("centers the selected lesson in the sidebar scroll area", async () => {
    const data = twoLessonCourse("free");
    const lessonTemplate = data.lessons[1];
    for (let index = 2; index < 7; index += 1) {
      data.lessons.push({
        ...lessonTemplate,
        id: `lesson-${index + 1}`,
        title: `Lesson ${index + 1}`,
        order: index,
      });
    }
    await act(async () => {
      root.render(createElement(CoursePreview, {
        initialData: data,
        authorName: "Course author",
        initialLessonId: data.lessons[0].id,
        persistLocalProgress: false,
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const menuViewport = container.querySelector<HTMLElement>(
      "aside > div.min-h-0.flex-1.overflow-y-auto.py-2",
    );
    const targetLesson = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Lesson 7"]',
    );
    expect(menuViewport).not.toBeNull();
    expect(targetLesson).not.toBeNull();
    if (!menuViewport || !targetLesson) return;

    const scrollTo = vi.fn();
    Object.defineProperty(menuViewport, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(menuViewport, "scrollTop", { configurable: true, writable: true, value: 20 });
    Object.defineProperty(menuViewport, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(targetLesson, "offsetHeight", { configurable: true, value: 40 });
    vi.spyOn(menuViewport, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 100, top: 100, bottom: 300, left: 0, right: 300,
      width: 300, height: 200, toJSON: () => ({}),
    });
    vi.spyOn(targetLesson, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 250, top: 250, bottom: 290, left: 0, right: 300,
      width: 300, height: 40, toJSON: () => ({}),
    });

    await act(async () => {
      targetLesson.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(targetLesson.getAttribute("aria-current")).toBe("page");
    expect(scrollTo).toHaveBeenCalledWith({ top: 90, behavior: "smooth" });
  });

  it("unlocks the next sidebar lesson after reading in sequential mode without requiring optional activities", async () => {
    const data = twoLessonCourse("sequential");
    data.lessons[0].blocks = data.lessons[0].blocks.filter(
      (block) => block.type !== "divider" || block.data.style !== "continue",
    );
    await act(async () => {
      root.render(createElement(CoursePreview, {
        initialData: data,
        authorName: "Course author",
        persistLocalProgress: false,
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const secondLesson = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Second lesson"]',
    );
    const scrollContainer = container.querySelector<HTMLElement>(
      `#preview-content-${data.lessons[0].id} > div`,
    );
    expect(secondLesson?.disabled).toBe(true);
    expect(scrollContainer).not.toBeNull();
    if (!scrollContainer) return;
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 500 },
    });

    await act(async () => {
      scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(
      container.querySelector('[data-lesson-block-id="study-cards"] button')?.getAttribute("aria-pressed"),
    ).toBe("false");
    expect(secondLesson?.disabled).toBe(false);
  });

  it.each(["sequential", "restricted"] as const)(
    "locks the next lesson in %s navigation until its completion condition is met",
    async (navigationMode) => {
      await act(async () => {
        root.render(
          createElement(CoursePreview, {
            initialData: twoLessonCourse(navigationMode),
            authorName: "Course author",
            persistLocalProgress: false,
          }),
        );
        await new Promise((resolve) => window.setTimeout(resolve, 10));
      });

      const startButton = [...container.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Start learning",
      );
      await act(async () => {
        startButton?.click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });

      const secondLesson = container.querySelector<HTMLButtonElement>(
        'aside button[aria-label^="Second lesson"]',
      );
      expect(secondLesson?.disabled).toBe(true);
      expect(secondLesson?.getAttribute("title")).toMatch(/complete/i);
    },
  );

  it.each(["sequential", "restricted"] as const)(
    "gates the Next section button by %s navigation when there is no Continue block",
    async (navigationMode) => {
      const data = twoLessonCourse(navigationMode);
      data.lessons[0].blocks = data.lessons[0].blocks.filter(
        (block) => block.type !== "divider" || block.data.style !== "continue",
      );
      await act(async () => {
        root.render(
          createElement(CoursePreview, {
            initialData: data,
            authorName: "Course author",
            persistLocalProgress: false,
          }),
        );
        await new Promise((resolve) => window.setTimeout(resolve, 10));
      });

      const startButton = [...container.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Start learning",
      );
      await act(async () => {
        startButton?.click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });

      const scrollContainer = container.querySelector<HTMLElement>(
        "[class*='overscroll-contain']",
      );
      expect(scrollContainer).not.toBeNull();
      Object.defineProperties(scrollContainer, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 500 },
        scrollTop: { configurable: true, writable: true, value: 0 },
      });

      const getNextSectionButton = () =>
        container.querySelector<HTMLButtonElement>(
          'nav[aria-label="Next section from content 1"] button',
        );
      const getNavigationNote = () =>
        container.querySelector<HTMLElement>(
          'nav[aria-label="Next section from content 1"] [role="note"]',
        );
      expect(getNextSectionButton()).toBeNull();
      expect(
        container.querySelector('button[aria-label="Continue"]'),
      ).toBeNull();
      expect(getNavigationNote()?.textContent).toBe(
        navigationMode === "sequential"
          ? "Students must complete the current lesson before opening the next one."
          : "Students must complete required activities before unlocking the next lesson.",
      );

      for (const cardIndex of [1, 2]) {
        const flipCard = container.querySelector<HTMLButtonElement>(
          `button[aria-label="Flip card ${cardIndex} to reveal the back"]`,
        );
        await act(async () => {
          flipCard?.click();
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
      }

      if (navigationMode === "restricted") {
        expect(getNextSectionButton()).not.toBeNull();
        expect(getNavigationNote()).toBeNull();
        return;
      }

      expect(getNextSectionButton()).toBeNull();
      expect(getNavigationNote()?.textContent).toBe(
        "Students must complete the current lesson before opening the next one.",
      );
      await act(async () => {
        if (scrollContainer) scrollContainer.scrollTop = 500;
        scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      expect(getNextSectionButton()).not.toBeNull();
      expect(getNavigationNote()).toBeNull();
    },
  );

  it("shows the Restricted navigation note after the final block when a middle Continue gate is cleared", async () => {
    const data = twoLessonCourse("restricted");
    const lesson = data.lessons[0];
    const continueBlock = lesson.blocks.find(
      (block) => block.type === "divider" && block.data.style === "continue",
    );
    if (continueBlock?.type !== "divider") throw new Error("Expected Continue block");
    lesson.blocks = [
      {
        id: "before-continue",
        version: 1,
        type: "flipCard",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: {
          cardsPerRow: 3,
          cardStyle: "classic",
          cardBackgroundColor: "#ffffff",
          cardTextColor: "#0f172a",
          cards: [{
            id: "first-block-card",
            frontLabel: "Question",
            front: { type: "text", text: "Recall the first concept." },
            backLabel: "Answer",
            back: { type: "text", text: "A concise explanation." },
          }],
        },
      },
      continueBlock,
      {
        id: "after-continue-activity",
        version: 1,
        type: "flipCard",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: {
          cardsPerRow: 3,
          cardStyle: "classic",
          cardBackgroundColor: "#ffffff",
          cardTextColor: "#0f172a",
          cards: [{
            id: "last-block-card",
            frontLabel: "Question",
            front: { type: "text", text: "Recall this concept." },
            backLabel: "Answer",
            back: { type: "text", text: "A concise explanation." },
          }],
        },
      },
    ];
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    const firstBlockCard = container.querySelector<HTMLButtonElement>(
      '[data-lesson-block-id="before-continue"] button[aria-label="Flip card 1 to reveal the back"]',
    );
    await act(async () => {
      firstBlockCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(continueButton?.disabled).toBe(true);

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(continueButton?.disabled).toBe(false);
    await act(async () => {
      continueButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const nextSectionNav = container.querySelector(
      'nav[aria-label="Next section from content 1"]',
    );
    expect(nextSectionNav?.querySelector("button")).toBeNull();
    expect(nextSectionNav?.querySelector('[role="note"]')?.textContent).toBe(
      "Students must complete required activities before unlocking the next lesson.",
    );

    const finalBlockCard = container.querySelector<HTMLButtonElement>(
      '[data-lesson-block-id="after-continue-activity"] button[aria-label="Flip card 1 to reveal the back"]',
    );
    await act(async () => {
      finalBlockCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(nextSectionNav?.querySelector("button")).not.toBeNull();
    expect(nextSectionNav?.querySelector('[role="note"]')).toBeNull();
  });

  it("keeps Continue locked until activities are completed and content above is read", async () => {
    const data = structuredClone(initialData);
    data.courseId = "continue-activity-gate-course";
    data.lessons[0].blocks.push({
      id: "after-continue",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Content after Continue.</p>" },
    });
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();
    expect(container.textContent).not.toContain(
      "Complete each interactive activity above the Continue button before moving on.",
    );
    expect(continueButton?.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
      "Complete the interactive activities above to unlock Continue.",
    );

    const firstFlipCard = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Flip card 1 to reveal the back"]',
    );
    await act(async () => {
      firstFlipCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
      "Complete the interactive activities above to unlock Continue.",
    );

    const secondFlipCard = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Flip card 2 to reveal the back"]',
    );
    await act(async () => {
      secondFlipCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
      "Read to the end of the content above to unlock Continue.",
    );

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(continueButton?.disabled).toBe(false);
    expect(continueButton?.parentElement?.querySelector('[role="status"]')).toBeNull();
    expect(continueButton?.querySelector(".lesson-lock-release")).not.toBeNull();

    await act(async () => {
      continueButton?.querySelector(".lesson-lock-release")?.dispatchEvent(
        new Event("animationend", { bubbles: true }),
      );
      continueButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Content after Continue.");
  });

  it("does not expose content after an old revealed gate until its required activities are completed", async () => {
    const data = structuredClone(initialData);
    data.courseId = "legacy-revealed-continue-course";
    data.lessons[0].blocks.push({
      id: "after-continue",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Content after Continue.</p>" },
    });
    localStorage.setItem(
      `coursecraft-progress-v2-${data.courseId}`,
      JSON.stringify({
        ...priorProgress,
        revealedDividerIds: ["gate-1"],
        completedDividerIds: [],
        selectedLessonId: null,
      }),
    );
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(container.textContent).not.toContain("Content after Continue.");

    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    for (const cardIndex of [1, 2]) {
      const flipCard = container.querySelector<HTMLButtonElement>(
        `button[aria-label="Flip card ${cardIndex} to reveal the back"]`,
      );
      await act(async () => {
        flipCard?.click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
    }
    expect(continueButton?.disabled).toBe(true);
    expect(container.textContent).not.toContain("Content after Continue.");

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(container.textContent).toContain("Content after Continue.");
  });

  it("keeps restricted lesson progression gated until the Continue lock is cleared", async () => {
    const data = twoLessonCourse("restricted");
    data.courseId = "restricted-continue-course";
    data.lessons[0].blocks.push({
      id: "after-continue",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Additional lesson content.</p>" },
    });
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    const secondLesson = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Second lesson"]',
    );
    expect(secondLesson?.disabled).toBe(true);

    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    for (const cardIndex of [1, 2]) {
      const flipCard = container.querySelector<HTMLButtonElement>(
        `button[aria-label="Flip card ${cardIndex} to reveal the back"]`,
      );
      expect(flipCard).not.toBeNull();
      await act(async () => {
        flipCard?.click();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
    }

    expect(continueButton?.disabled).toBe(true);

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(continueButton?.disabled).toBe(false);
    expect(secondLesson?.disabled).toBe(true);
    await act(async () => {
      continueButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Additional lesson content.");
    expect(secondLesson?.disabled).toBe(false);
    expect(
      container.querySelector('nav[aria-label="Next section from content 1"] button'),
    ).not.toBeNull();
  });

  it("shows Continue gates fresh without overwriting saved learner progress", async () => {
    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    expect(startButton).toBeDefined();

    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton).toBeDefined();
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();
    expect(
      container.querySelector('nav[aria-label="Next section from content 1"] button'),
    ).toBeNull();
    expect(container.textContent).not.toContain(
      "Complete each interactive activity above the Continue button before moving on.",
    );
    expect(continueButton?.style.backgroundColor).toBe("var(--course-primary)");
    expect(container.querySelector("main")?.getAttribute("style")).toContain(
      "--course-primary: #24734f",
    );
    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    const flipCard = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Flip card 1 to reveal the back"]',
    );
    expect(flipCard).not.toBeNull();
    await act(async () => {
      flipCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(continueButton?.disabled).toBe(true);
    const secondFlipCard = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Flip card 2 to reveal the back"]',
    );
    expect(secondFlipCard).not.toBeNull();
    await act(async () => {
      secondFlipCard?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(continueButton?.disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem(progressKey) ?? "null")).toEqual(
      priorProgress,
    );
  });

  it("lets learners use a Continue button immediately when completion is set to None", async () => {
    const data = structuredClone(initialData);
    data.courseId = "continue-none-course";
    const lesson = data.lessons[0];
    const continueBlock = lesson.blocks.find(
      (block) => block.type === "divider" && block.data.style === "continue",
    );
    if (continueBlock?.type !== "divider") throw new Error("Expected Continue block");
    continueBlock.data.completionType = "none";
    lesson.blocks.push({
      id: "after-continue",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Content after Continue</p>" },
    });

    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
          persistLocalProgress: false,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const startButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Start learning",
    );
    await act(async () => {
      startButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(false);
    expect(container.textContent).not.toContain("Content after Continue");

    await act(async () => {
      continueButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Content after Continue");
  });

  it("keeps a previously unlocked lesson available with its partial progress after navigating backward", async () => {
    const data = twoLessonCourse("restricted");
    data.courseId = "restricted-back-navigation-progress-course";
    data.lessons[0].title = "First lesson";
    const studyCards = data.lessons[0].blocks.find(
      (block) => block.type === "flipCard",
    );
    if (studyCards?.type !== "flipCard") throw new Error("Expected study cards");
    data.lessons[0].blocks = [studyCards];

    const thirdLesson = structuredClone(data.lessons[1]);
    thirdLesson.id = "lesson-3";
    thirdLesson.title = "Third lesson";
    thirdLesson.order = 2;
    data.lessons.push(thirdLesson);

    const loadedProgress: LearnerProgressSnapshot = {
      visitedLessonIds: ["lesson-1", "lesson-2"],
      lessonScrollProgress: { "lesson-1": 100, "lesson-2": 100 },
      revealedDividerIds: [],
      completedDividerIds: [],
      interactedContentIds: ["study-cards:card-1", "study-cards:card-2"],
      selectedLessonId: "lesson-3",
    };
    const save = vi.fn();

    await act(async () => {
      root.render(
        createElement(CoursePreview, {
          initialData: data,
          authorName: "Course author",
          initialLessonId: "lesson-3",
          progressAdapter: { load: () => loadedProgress, save },
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    const thirdLessonBody = container.querySelector<HTMLElement>(
      "#preview-content-lesson-3 > div",
    );
    expect(thirdLessonBody).not.toBeNull();
    Object.defineProperties(thirdLessonBody, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 250 },
    });
    await act(async () => {
      thirdLessonBody?.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.querySelector('[aria-label="Lesson 50% complete"]')).not.toBeNull();

    const firstLessonButton = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label="First lesson"]',
    );
    await act(async () => {
      firstLessonButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    const thirdLessonButton = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Third lesson"]',
    );
    expect(thirdLessonButton?.disabled).toBe(false);
    expect(container.querySelector('[aria-label="Lesson 50% complete"]')).not.toBeNull();

    const secondLessonButton = container.querySelector<HTMLButtonElement>(
      'aside button[aria-label^="Second lesson"]',
    );
    await act(async () => {
      secondLessonButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(thirdLessonButton?.disabled).toBe(false);

    await act(async () => {
      if (thirdLessonBody) thirdLessonBody.scrollTop = 0;
      thirdLessonButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(container.querySelector('[aria-label="Lesson 50% complete"]')).not.toBeNull();
    expect(
      (save.mock.lastCall?.[1] as LearnerProgressSnapshot | undefined)
        ?.lessonScrollProgress["lesson-3"],
    ).toBe(50);
  });
});
