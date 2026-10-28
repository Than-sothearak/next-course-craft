// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("slide presentation full screen", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scales the 16:9 canvas to the available presentation viewport", () => {
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.hasAttribute("data-slide-stage") ? 1920 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.hasAttribute("data-slide-stage") ? 1080 : 0; } });
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<SlideStage><p>Slide</p></SlideStage>));
      expect(container.querySelector<HTMLElement>("[data-slide-stage] > div")?.style.width).toBe("960px");
      act(() => root.render(<SlideStage fillWidth><p>Slide</p></SlideStage>));
      expect(container.querySelector<HTMLElement>("[data-slide-stage] > div")?.style.width).toBe("1920px");
      expect(container.querySelector<HTMLElement>("[data-slide-stage]")?.getAttribute("data-fill-width")).toBe("true");
      expect(container.querySelector<HTMLElement>("[data-slide-stage]")?.hasAttribute("data-fill-viewport")).toBe(false);
      act(() => root.render(<SlideStage fillViewport><p>Slide</p></SlideStage>));
      expect(container.querySelector<HTMLElement>("[data-slide-stage] > div")?.style.width).toBe("1920px");
      expect(container.querySelector<HTMLElement>("[data-slide-canvas]")?.style.transform).toBe("scale(2)");
      expect(container.querySelector<HTMLElement>("[data-slide-stage] > div")?.style.aspectRatio).toBe("960 / 540");
    } finally {
      act(() => root.unmount()); container.remove();
      if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", widthDescriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", heightDescriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it("hides preview chrome in full screen and restores it on exit", async () => {
    const data: PreviewData = {
      courseId: "slides", title: "Presentation", description: "", authorVisible: false, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Opening", order: 0, lessonType: "content", quizQuestions: [], blocks: [] }],
    };
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: function (this: HTMLElement) { Object.defineProperty(document, "fullscreenElement", { configurable: true, value: this }); document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); } });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: () => { Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null }); document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); } });
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<CoursePreview initialData={data} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
      expect(container.querySelector<HTMLElement>('[data-slide-canvas]')?.contains(container.querySelector('[aria-label="Present full screen"]'))).toBe(true);
      expect(container.querySelector('[data-presentation-view] > header [aria-label="Present full screen"]')).toBeNull();
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Present full screen"]')!.click());
      expect(container.querySelector('[data-presentation-view]')?.getAttribute("data-fullscreen")).toBe("true");
      expect(container.querySelector('[data-slide-stage]')?.getAttribute("data-fill-viewport")).toBe("true");
      expect(container.querySelector('[data-presentation-view] > header')).toBeNull();
      expect(container.querySelector<HTMLElement>('[data-slide-canvas]')?.contains(container.querySelector('[aria-label="Exit full screen"]'))).toBe(true);
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Exit full screen"]')!.click());
      expect(container.querySelector('[data-slide-stage]')?.hasAttribute("data-fill-viewport")).toBe(false);
      expect(container.querySelector('[data-presentation-view] > header')).not.toBeNull();
    } finally {
      act(() => root.unmount()); container.remove();
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
      delete (document as unknown as Record<string, unknown>).exitFullscreen;
      delete (document as unknown as Record<string, unknown>).fullscreenElement;
    }
  });
});
