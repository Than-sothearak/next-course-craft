/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "../app/courses/[courseId]/preview/course-preview";

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
});
