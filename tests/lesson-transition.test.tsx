/** @vitest-environment jsdom */
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLessonTransition } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/use-lesson-transition";
import type { PreviewDevice, PreviewOrientation } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Probe({ device = "desktop", orientation = "portrait", active = true, locked = false }: { device?: PreviewDevice; orientation?: PreviewOrientation; active?: boolean; locked?: boolean }) {
  const [selectedLessonId, selectLesson] = useState("one");
  const lessonBodyScrollRefs = useRef(new Map<string, HTMLDivElement>());
  const { readerRef, navigateSection } = useLessonTransition({ selectedLessonId, active, device, orientation, lessonBodyScrollRefs, selectLesson, getLessonNavigationLockMessage: () => locked ? "Locked" : null });
  return <div ref={readerRef} className="relative overflow-clip">
    {["one", "two", "three"].map((id, index, lessons) => <article key={id} data-lesson={id} aria-hidden={id !== selectedLessonId} inert={id !== selectedLessonId} className={id === selectedLessonId ? "flex h-full" : "hidden"}>
      <div ref={(node) => { if (node) lessonBodyScrollRefs.current.set(id, node); else lessonBodyScrollRefs.current.delete(id); }}>
        <button onClick={() => navigateSection(lessons[index - 1], "previous")}>Previous</button>
        <button onClick={() => navigateSection(lessons[index + 1], "next")}>Next</button>
      </div>
    </article>)}
  </div>;
}

describe("lesson section transitions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let width: number;
  let reducedMotion: boolean;
  let observers: ResizeObserverCallback[];
  let animations: { target: HTMLElement; frames: Keyframe[]; cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[];
  const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  beforeEach(() => {
    vi.useFakeTimers();
    width = 600;
    reducedMotion = false;
    observers = [];
    animations = [];
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); constructor(callback: ResizeObserverCallback) { observers.push(callback); } });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width, height: 500 } as DOMRect));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function(this: HTMLElement, frames: Keyframe[]) {
      const animation = { target: this, frames, cancel: vi.fn(), onfinish: null as (() => void) | null };
      animations.push(animation);
      return animation;
    } });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  });
  const lesson = (id: string) => container.querySelector<HTMLElement>(`[data-lesson="${id}"]`)!;
  const click = (id: string, next: boolean) => act(() => (lesson(id).querySelectorAll("button")[next ? 1 : 0] as HTMLButtonElement).click());

  it("slides Next and Previous in opposite directions without stacking lesson heights", () => {
    act(() => root.render(<Probe />));
    expect(animations).toHaveLength(0);
    const body = lesson("one").firstElementChild!;
    body.scrollTop = 140;
    click("one", true);
    expect(animations[0].frames[0].transform).toBe("translateY(100%)");
    expect(animations[1].frames[1].transform).toBe("translateY(-100%)");
    expect(lesson("one").style.position).toBe("absolute");
    expect(lesson("one").hasAttribute("inert")).toBe(true);
    expect(lesson("two").getAttribute("aria-hidden")).toBe("false");
    act(() => animations[0].onfinish!());
    expect(lesson("one").style.display).toBe("");
    expect(lesson("one").className).toBe("hidden");
    click("two", false);
    expect(animations[2].frames[0].transform).toBe("translateY(-100%)");
    expect(animations[3].frames[1].transform).toBe("translateY(100%)");
    expect(lesson("one").firstElementChild).toBe(body);
    expect(body.scrollTop).toBe(140);
    act(() => vi.advanceTimersByTime(520));
    expect(lesson("two").style.position).toBe("");
  });

  it("cancels a previous transition before another section click", () => {
    act(() => root.render(<Probe />));
    click("one", true);
    click("two", true);
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations[1].cancel).toHaveBeenCalledOnce();
    expect(lesson("one").style.display).toBe("");
    expect(lesson("three").getAttribute("aria-hidden")).toBe("false");
    act(() => vi.advanceTimersByTime(520));
    expect(container.querySelectorAll('article[style="display: flex; position: absolute; inset: 0;"]')).toHaveLength(0);
  });

  it("stops when the reader changes size and ignores the observer's initial notification", () => {
    act(() => root.render(<Probe />));
    click("one", true);
    act(() => observers[0]([], {} as ResizeObserver));
    expect(animations[0].cancel).not.toHaveBeenCalled();
    width = 300;
    act(() => observers[0]([], {} as ResizeObserver));
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(lesson("one").style.display).toBe("");
    expect(lesson("two").className).toBe("flex h-full");
  });

  it.each([{ device: "mobile" as const }, { orientation: "landscape" as const }, { active: false }])("cleans up when view settings change: %j", (props) => {
    act(() => root.render(<Probe />));
    click("one", true);
    act(() => root.render(<Probe {...props} />));
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(lesson("one").style.display).toBe("");
  });

  it("respects reduced motion and navigation locks", () => {
    reducedMotion = true;
    act(() => root.render(<Probe />));
    click("one", true);
    expect(animations).toHaveLength(0);
    expect(lesson("two").getAttribute("aria-hidden")).toBe("false");
    act(() => root.render(<Probe locked />));
    click("two", true);
    expect(lesson("three").className).toBe("hidden");
  });

  it("switches immediately when the animation API is unavailable", () => {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    act(() => root.render(<Probe />));
    click("one", true);
    expect(lesson("two").getAttribute("aria-hidden")).toBe("false");
    expect(lesson("one").style.display).toBe("");
  });
});
