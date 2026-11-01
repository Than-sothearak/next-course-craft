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
const frame = { x: 25, y: 25, width: 30, height: 30, z: 2 };
const presentation = (rotation?: number) => ({ courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" },
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "slide", sectionId: "section", title: "Slide 1", order: 0, blocks: [
    { id: "heading", version: 1, type: "heading", slideFrame: { ...frame, ...(rotation !== undefined ? { rotation } : {}) }, slideTextLayout: { fitToText: false }, data: { text: "Transform this", level: 2 } },
    { id: "gallery", version: 1, type: "gallery", slideFrame: { ...frame, z: 0 }, data: { images: [{ src: "/example.png", alt: "Example" }] } },
    { id: "audio", version: 1, type: "audio", slideFrame: { ...frame, z: 1 }, slidePlayback: { fitHeight: false }, data: { src: "" } },
  ] }],
}) });
function pointer(type: string, x: number, y: number, shiftKey = false, pointerId = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, shiftKey });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

describe("presentation transform controls", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const object = (id = "heading") => container.querySelector<HTMLElement>(`[data-slide-object-id="${id}"]`)!;
  const select = (type = "heading") => act(async () => button(`Select ${type} object from layers`).click());
  const render = (rotation?: number) => act(async () => root.render(<EditorClient initialData={presentation(rotation)} authorName="Author" />));
  function bounds(zoom: number) {
    vi.spyOn(container.querySelector<HTMLElement>("[data-slide-objects]")!, "getBoundingClientRect").mockReturnValue({ left: 60, top: 40, width: 960 * zoom, height: 540 * zoom } as DOMRect);
  }
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }

  it("provides eight resize points, a move handle and rotation for text, galleries and compact audio", async () => {
    await render();
    for (const type of ["heading", "gallery", "audio"]) {
      await select(type);
      expect(object(type).querySelectorAll("[data-slide-resize-handle]")).toHaveLength(8);
      expect(button(`Move ${type} object`)).not.toBeNull();
      expect(button(`Rotate ${type} object`)).not.toBeNull();
      expect(container.querySelectorAll("[data-slide-resize-handle]")).toHaveLength(8);
    }
  });

  it.each([.5, 1.5])("resizes from the top left at scale %s and records one undo step for the whole drag", async (zoom) => {
    await render(); await select(); bounds(zoom);
    const handle = object().querySelector<HTMLButtonElement>('[data-slide-resize-handle="top-left"]')!;
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 100 - 24 * zoom, 100 - 12 * zoom)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 100 - 48 * zoom, 100 - 27 * zoom)));
    expect(object().style.left).toBe("20%"); expect(object().style.top).toBe("20%");
    expect(object().style.width).toBe("35%"); expect(object().style.height).toBe("35%");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => handle.dispatchEvent(pointer("pointerup", 100 - 48 * zoom, 100 - 27 * zoom)));
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ ...frame, x: 20, y: 20, width: 35, height: 35 });
    expect(snapshot.lessons[0].blocks[0].slideTextLayout?.fitToText).toBe(false);
    await act(async () => button("Undo").click());
    expect(object().style.width).toBe("30%"); expect(object().style.left).toBe("25%");
    await act(async () => button("Redo").click());
    expect(object().style.width).toBe("35%");
  });

  it.each([.5, 1.5])("rotates around the center at scale %s and preserves it through save, reload, thumbnails and standalone preview", async (zoom) => {
    await render(); await select(); bounds(zoom);
    const handle = button("Rotate heading object");
    const cx = 60 + 384 * zoom, cy = 40 + 216 * zoom;
    await act(async () => handle.dispatchEvent(pointer("pointerdown", cx, cy - 80 * zoom)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", cx + 80 * zoom, cy, true)));
    expect(object().style.rotate).toBe("90deg");
    await act(async () => handle.dispatchEvent(pointer("pointerup", cx + 80 * zoom, cy, true)));
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ ...frame, rotation: 90 });
    expect(container.querySelector<HTMLElement>('[data-slide-thumbnail-object-id="heading"]')?.style.rotate).toBe("90deg");
    await act(async () => button("Undo").click()); expect(object().style.rotate).toBe("");
    await act(async () => button("Redo").click()); expect(object().style.rotate).toBe("90deg");
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(object().style.rotate).toBe("90deg");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      expect(object().style.rotate).toBe("90deg");
      expect(container.querySelector("[data-slide-resize-handle]")).toBeNull();
    }
  });

  it.each(["pointercancel", "lostpointercapture", "Escape"])("discards a rotated resize on %s and ignores unrelated pointers", async (cancelEvent) => {
    await render(90); await select(); bounds(1);
    const handle = object().querySelector<HTMLButtonElement>('[data-slide-resize-handle="right"]')!;
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 100, 148, false, 2)));
    expect(object().style.width).toBe("30%");
    await act(async () => handle.dispatchEvent(pointer("pointermove", 100, 148)));
    expect(object().style.width).toBe("35%"); expect(object().style.height).toBe("30%");
    await act(async () => handle.dispatchEvent(cancelEvent === "Escape" ? new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }) : pointer(cancelEvent, 100, 148)));
    expect(object().style.width).toBe("30%"); expect(object().style.left).toBe("25%"); expect(object().style.rotate).toBe("90deg");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts numeric rotation and keyboard rotation, movement and edge resizing", async () => {
    await render(); await select();
    const field = container.querySelector<HTMLInputElement>('[aria-label="Object rotation (degrees)"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "33");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(object().style.rotate).toBe("33deg");
    await act(async () => button("Rotate heading object").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight", shiftKey: true })));
    expect(object().style.rotate).toBe("48deg");
    await act(async () => button("Move heading object").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight", shiftKey: true })));
    expect(Number.parseFloat(object().style.left)).toBeCloseTo(25 + 10 / 960 * 100);
    await act(async () => object().querySelector('[data-slide-resize-handle="right"]')!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight", shiftKey: true })));
    expect(Number.parseFloat(object().style.width)).toBeGreaterThan(30);
    expect((await saved()).lessons[0].blocks[0].slideFrame?.rotation).toBe(48);
  });
});
