/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const data: PreviewData = {
  courseId: "slides", title: "Presentation", description: "", authorVisible: false, courseLayout: "slides", navigationMode: "free",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "first", sectionId: "section", title: "First slide", order: 0, lessonType: "content", quizQuestions: [], blocks: [] },
    { id: "second", sectionId: "section", title: "Second slide", order: 1, lessonType: "content", quizQuestions: [], blocks: [] },
  ],
};

describe("presentation preview zoom", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fits the screen, applies exact zoom levels, and keeps zoom across slides and fullscreen", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.hasAttribute("data-slide-stage") ? 1200 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.hasAttribute("data-slide-stage") ? 720 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: function (this: HTMLElement) { Object.defineProperty(document, "fullscreenElement", { configurable: true, value: this }); document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); } });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: () => { Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null }); document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); } });
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const canvas = () => container.querySelector<HTMLElement>('[data-slide-canvas][data-slide-active="true"]')!;
    const stage = () => canvas().closest<HTMLElement>("[data-slide-stage]")!;
    const zoom = () => container.querySelector<HTMLSelectElement>('[aria-label="Presentation zoom"]')!;
    const choose = (value: string) => act(async () => { zoom().value = value; zoom().dispatchEvent(new Event("change", { bubbles: true })); });
    try {
      await act(async () => root.render(<CoursePreview initialData={data} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
      expect(zoom().value).toBe("fit");
      expect(stage().getAttribute("data-fill-viewport")).toBe("true");
      expect(canvas().style.transform).toBe("scale(1.25)");
      for (const [level, scale] of [["100", "1"], ["120", "1.2"], ["150", "1.5"], ["300", "3"]]) {
        await choose(level);
        expect(stage().getAttribute("data-zoom")).toBe(level);
        expect(canvas().style.transform).toBe(`scale(${scale})`);
        expect(stage().classList.contains("overflow-auto")).toBe(true);
      }
      stage().scrollLeft = 200;
      stage().scrollTop = 120;
      await choose("fit");
      expect(stage().scrollLeft).toBe(0);
      expect(stage().scrollTop).toBe(0);
      expect(canvas().style.transform).toBe("scale(1.25)");
      await choose("150");
      await act(async () => container.querySelector<HTMLButtonElement>('[data-slide-active="true"] [data-navigation-button="next"]')!.click());
      expect(canvas().getAttribute("aria-label")).toBe("Slide: Second slide");
      expect(zoom().value).toBe("150");
      expect(canvas().style.transform).toBe("scale(1.5)");
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Present full screen"]')!.click());
      expect(container.querySelector('[data-presentation-view]')?.getAttribute("data-fullscreen")).toBe("true");
      expect(zoom().value).toBe("150");
      expect(container.querySelectorAll('[aria-label="Exit full screen"]')).toHaveLength(1);
      await choose("200");
      expect(canvas().style.transform).toBe("scale(2)");
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Exit full screen"]')!.click());
      expect(container.querySelector('[data-presentation-view]')?.hasAttribute("data-fullscreen")).toBe(false);
      expect(zoom().value).toBe("200");
    } finally {
      act(() => root.unmount()); container.remove();
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
      if (scrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollTo);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
      delete (document as unknown as Record<string, unknown>).exitFullscreen;
      delete (document as unknown as Record<string, unknown>).fullscreenElement;
    }
  });
});
