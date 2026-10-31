/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: "free", sections: [{ id: "a", title: "Introduction", order: 0 }, { id: "b", title: "Practice", order: 1 }], lessons: [
  { id: "cover", sectionId: "a", title: "Cover", order: 0, slideCover: { template: "imageCover" }, blocks: [] },
  { id: "content", sectionId: "a", title: "Content", order: 1, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Keep this", level: 2 } }] },
  { id: "quiz", sectionId: "b", title: "Quiz", order: 0, lessonType: "quiz", blocks: [] },
  { id: "end", sectionId: "b", title: "End", order: 1, blocks: [] },
] }) };
describe("slide thumbnail reordering", () => {
  let container: HTMLDivElement; let root: Root; let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const item = this.closest<HTMLElement>('[data-sortable-slide]');
      if (item) { const index = [...item.parentElement!.children].indexOf(item); return this === item ? new DOMRect(0, index * 170, 240, 160) : new DOMRect(8, index * 170 + 124, 28, 28); }
      return new DOMRect(0, 0, 0, 0);
    });
    fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetch);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView; delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const order = () => [...container.querySelectorAll<HTMLElement>('[data-sortable-slide]')].map((element) => element.dataset.sortableSlide);
  const handle = (id: string) => container.querySelector<HTMLButtonElement>(`[data-sortable-slide="${id}"] [aria-label^="Reorder slide"]`)!;
  const key = (code: string, target: EventTarget = document) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: code === "Space" ? " " : code, code, bubbles: true, cancelable: true })); await vi.advanceTimersByTimeAsync(50); });
  const render = () => act(async () => root.render(<EditorClient initialData={data} focusedLessonId="content" authorName="" />));

  it("reorders with the keyboard across sections, preserves selection, supports undo and saves for learner navigation", async () => {
    await render(); await act(async () => handle("end").focus()); await key("Space", handle("end")); await key("ArrowUp"); await key("ArrowUp");
    expect(order()).toEqual(["cover", "content", "quiz", "end"]); expect(fetch).not.toHaveBeenCalled();
    await key("Space"); expect(order()).toEqual(["cover", "end", "content", "quiz"]);
    expect(container.querySelector('[aria-current="step"]')?.getAttribute("aria-label")).toBe("Edit slide 3: Content");
    expect(container.querySelector('[data-slide-object-id="heading"]')?.textContent).toContain("Keep this");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click()); expect(order()).toEqual(["cover", "content", "quiz", "end"]);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!.click()); expect(order()).toEqual(["cover", "end", "content", "quiz"]);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetch.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body));
    expect(snapshot.lessons.find((lesson) => lesson.id === "end")).toMatchObject({ sectionId: "a", order: 1 });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} focusedLessonId="content" authorName="" />)); expect(order()).toEqual(["cover", "end", "content", "quiz"]);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="" initialLessonId="content" standalone={standalone} persistLocalProgress={false} />));
      const controls = container.querySelector('[aria-label="Slide navigation"]')!;
      await act(async () => controls.querySelector<HTMLButtonElement>('[aria-label="Previous"]')!.click());
      expect(container.querySelector('#preview-content-end')?.getAttribute("aria-hidden")).toBe("false");
    }
  });

  it("cancels without changing order or saving and keeps thumbnail actions independent", async () => {
    await render(); await act(async () => handle("end").focus()); await key("Space", handle("end")); await key("ArrowUp"); await key("Escape");
    expect(order()).toEqual(["cover", "content", "quiz", "end"]);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetch).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit slide 4: End"]')!.click()); expect(container.querySelector('[aria-current="step"]')?.getAttribute("aria-label")).toBe("Edit slide 4: End");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete slide 3: Quiz"]')!.click()); expect(order()).toEqual(["cover", "content", "end"]);
  });
});
