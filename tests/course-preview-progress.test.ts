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
  it("keeps Continue locked until an interactive block is completed and the lesson is read", async () => {
    const data = structuredClone(initialData);
    data.courseId = "knowledge-check-gate-course";
    const gate = data.lessons[0].blocks.find(
      (block) => block.type === "divider" && block.data.style === "continue",
    );
    if (gate?.type !== "divider") throw new Error("Expected Continue block");
    data.lessons[0].blocks = [
      {
        id: "knowledge-check",
        version: 1,
        type: "knowledgeCheck",
        width: "small",
        widthCustom: false,
        backgroundColor: "#ffffff",
        blockPadding: 20,
        data: {
          question: "Which answer is correct?",
          options: ["First", "Second"],
          correctOptionIndex: 1,
          correctFeedback: "Correct.",
          incorrectFeedback: "Try again.",
        },
      },
      gate,
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

    let continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();

    const scrollContainer = container.querySelector<HTMLElement>(
      "[class*='overscroll-contain']",
    );
    expect(scrollContainer).not.toBeNull();
    Object.defineProperties(scrollContainer, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="1"]')?.click();
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Check answer")
        ?.click();
    });
    continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(false);
    const lock = continueButton?.querySelector<SVGElement>(".lesson-lock-release");
    expect(lock).not.toBeNull();
    await act(async () => {
      lock?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).toBeNull();
  });

  it("releases and removes the Continue lock after required content is complete", async () => {
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

    let continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();

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

    continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(true);
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).not.toBeNull();

    await act(async () => {
      if (scrollContainer) scrollContainer.scrollTop = 500;
      scrollContainer?.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    continueButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Continue",
    );
    expect(continueButton?.disabled).toBe(false);
    const releasingLock = continueButton?.querySelector<SVGElement>(
      ".lesson-lock-release",
    );
    expect(releasingLock).not.toBeNull();
    expect(continueButton?.querySelector(".lesson-lock-open")).not.toBeNull();

    await act(async () => {
      releasingLock?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(continueButton?.querySelector(".lucide-lock-keyhole")).toBeNull();
    expect(continueButton?.querySelector(".lesson-lock-open")).toBeNull();
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
    expect(continueButton?.style.backgroundColor).toBe("var(--course-primary)");
    expect(container.querySelector("main")?.getAttribute("style")).toContain(
      "--course-primary: #24734f",
    );
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
