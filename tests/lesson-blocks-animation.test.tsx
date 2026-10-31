/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import { LessonBlocksPreview } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/lesson-blocks-preview";
import { PreviewBlock } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const blocks = [
  blockSchema.parse({ id: "first", version: 1, type: "divider", data: { style: "line" } }),
  blockSchema.parse({ id: "second", version: 1, type: "divider", data: { style: "line" } }),
];

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  observed: Element[];
};

let observers: ObserverRecord[];
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      private readonly record: ObserverRecord;

      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, observed: [] };
        observers.push(this.record);
      }

      observe(element: Element) {
        this.record.observed.push(element);
      }

      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("lesson block viewport animation", () => {
  it("keeps staggered list entrance on presentation blocks", async () => {
    const block = blockSchema.parse({ id: "list", version: 1, type: "richText", data: { html: "<ul><li><p>First</p></li><li><p>Second</p></li></ul>" } });
    await act(async () => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "landscape", slideLayout: true, animateListItems: true })));
    const text = container.querySelector<HTMLElement>(".lesson-rich-text")!;
    expect(text.classList.contains("lesson-list-enter")).toBe(true);
    expect(text.className).toContain("[&_.tiptap_p]:my-2");
    expect([...text.querySelectorAll<HTMLElement>("li")].map((item) => item.style.getPropertyValue("--lesson-list-item-delay"))).toEqual(["0ms", "280ms"]);
  });

  it("starts each block animation when that block enters the lesson viewport", () => {
    const noop = vi.fn();
    act(() => {
      root.render(
        createElement(LessonBlocksPreview, {
          blocks,
          device: "desktop",
          orientation: "portrait",
          animate: true,
          revealedDividerIds: new Set<string>(),
          completedDividerIds: new Set<string>(),
          unlockingDividerIds: new Set<string>(),
          interactedContentIds: new Set<string>(),
          onReveal: noop,
          onUnlockAnimationEnd: noop,
          onInteractiveProgress: noop,
          lessons: [],
          visitedLessonIds: new Set<string>(),
          passedQuizIds: new Set<string>(),
          getLessonNavigationLockMessage: () => null,
          onOpenLesson: noop,
        }),
      );
    });

    const first = container.querySelector<HTMLElement>('[data-lesson-block-id="first"]')!;
    const second = container.querySelector<HTMLElement>('[data-lesson-block-id="second"]')!;
    expect(observers.length).toBeGreaterThan(0);
    expect(observers.some((observer) => observer.observed.includes(first))).toBe(true);
    expect(observers.some((observer) => observer.observed.includes(second))).toBe(true);
    expect(first.dataset.lessonBlockInView).toBe("false");
    expect(second.dataset.lessonBlockInView).toBe("false");

    act(() => {
      observers[0].callback(
        [{ isIntersecting: true, target: first } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(first.dataset.lessonBlockInView).toBe("true");
    expect(second.dataset.lessonBlockInView).toBe("false");
  });
});
