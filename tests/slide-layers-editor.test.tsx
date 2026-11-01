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
const data = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: "free", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Layers", order: 0, blocks: [
  { id: "back", version: 1, type: "heading", data: { text: "Back object", level: 2 }, slideFrame: { x: 10, y: 10, width: 50, height: 20, z: 0 } },
  { id: "middle", version: 1, type: "richText", data: { html: "<p>Middle object</p>" }, slideFrame: { x: 20, y: 20, width: 50, height: 20, z: 8 } },
  { id: "front", version: 1, type: "statement", data: { style: "key", title: "Front object", body: "A detail" }, slideFrame: { x: 30, y: 30, width: 50, height: 20, z: 500 } },
] }] }) };

describe("presentation layer reordering", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.stubGlobal("PointerEvent", class extends MouseEvent { pointerId = 1; isPrimary = true; });
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>("[data-slide-layer]");
      if (row) { const index = [...row.parentElement!.children].indexOf(row); return new DOMRect(0, 100 + index * 48, this === row ? 300 : 28, 42); }
      return new DOMRect(0, 0, 0, 0);
    });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView; delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const order = () => [...container.querySelectorAll<HTMLElement>("[data-slide-layer]")].map((row) => row.dataset.slideLayer);
  const handle = (id: string) => container.querySelector<HTMLButtonElement>(`[data-slide-layer="${id}"] [aria-label^="Reorder"]`)!;
  const clickLabel = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const key = (code: string, target: EventTarget = document) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: code === "Space" ? " " : code, code, bubbles: true, cancelable: true })); await vi.advanceTimersByTimeAsync(50); });
  const render = () => act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));

  it("reorders on keyboard drop, keeps the selected object, and saves one undoable change for preview and standalone learners", async () => {
    await render();
    expect(container.querySelector('[aria-label="Toggle Objects & layers settings"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(order()).toEqual(["front", "middle", "back"]);
    await clickLabel("Select richText object from layers");
    await act(async () => handle("front").focus()); await key("Space", handle("front")); await key("ArrowDown"); await key("ArrowDown");
    expect(order()).toEqual(["front", "middle", "back"]); expect(fetchMock).not.toHaveBeenCalled();
    await key("Space"); expect(order()).toEqual(["middle", "back", "front"]);
    expect(container.querySelector('[data-slide-object-settings="middle"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slide-thumbnail-object-id="front"]')?.style.zIndex).toBe("1");
    await clickLabel("Undo"); expect(order()).toEqual(["front", "middle", "back"]);
    await clickLabel("Redo"); expect(order()).toEqual(["middle", "back", "front"]);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body));
    expect(snapshot.lessons[0].blocks.map((block) => block.id)).toEqual(["back", "middle", "front"]);
    expect(snapshot.lessons[0].blocks.map((block) => block.slideFrame!.z)).toEqual([1, 2, 0]);
    snapshot.lessons[0].blocks.forEach((block, index) => expect(block.slideFrame).toEqual({ ...data.lessons[0].blocks[index].slideFrame, z: block.slideFrame!.z }));
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(order()).toEqual(["middle", "back", "front"]);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      for (const [id, z] of [["back", "2"], ["middle", "3"], ["front", "1"]]) expect(container.querySelector<HTMLElement>(`[data-slide-object-id="${id}"]`)?.style.zIndex).toBe(z);
    }
  });

  it("supports pointer dragging and keeps row selection independent of the handle", async () => {
    await render();
    const pointer = (type: string, y: number, target: EventTarget = document) => act(async () => { target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 14, clientY: y })); await vi.advanceTimersByTimeAsync(50); });
    await pointer("pointerdown", 121, handle("front"));
    await pointer("pointermove", 217); await pointer("pointermove", 217); await pointer("pointerup", 217);
    expect(order()).toEqual(["middle", "back", "front"]);
    await clickLabel("Select heading object from layers");
    expect(container.querySelector('[data-slide-object-settings="back"]')).not.toBeNull();
  });

  it("cancels without changing layers or saving and uses the same order for Front and Back", async () => {
    await render(); await act(async () => handle("front").focus());
    await key("Space", handle("front")); await key("ArrowDown"); await key("Escape");
    expect(order()).toEqual(["front", "middle", "back"]);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await clickLabel("Select heading object from layers");
    const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('[data-slide-object-settings="back"] button')].find((item) => item.textContent === text)!;
    expect(button("Back").disabled).toBe(true);
    await act(async () => button("Front").click()); expect(order()).toEqual(["front", "back", "middle"]);
    await act(async () => button("Front").click()); expect(order()).toEqual(["back", "front", "middle"]);
    expect(button("Front").disabled).toBe(true);
    await act(async () => button("Back").click()); expect(order()).toEqual(["front", "back", "middle"]);
    await clickLabel("Undo"); expect(order()).toEqual(["back", "front", "middle"]);
  });
});
