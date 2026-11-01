/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideObjectShadows } from "@/lib/editor/slide-object-appearance";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const frame = { x: 25, y: 30, width: 20, height: 20, z: 2 };
const data = () => ({ courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" },
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "first", sectionId: "section", title: "First", order: 0, blocks: [{ id: "heading", type: "heading", version: 1, data: { text: "Align and decorate", level: 2 }, slideFrame: frame, slideTextLayout: { fitToText: false }, slideBackground: { color: "#fff7ed", opacity: 40 } }] },
    { id: "second", sectionId: "section", title: "Second", order: 1, blocks: [] },
  ],
}) });
function pointer(type: string, x: number, y: number, altKey = false) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, altKey });
  Object.defineProperty(event, "pointerId", { value: 1 }); return event;
}

describe("presentation alignment and border tools", () => {
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
  const object = () => container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')!;
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const clickText = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!.click());
  async function render() { await act(async () => root.render(<EditorClient initialData={data()} authorName="Author" />)); await act(async () => button("Select heading object from layers").click()); }
  const input = (label: string, value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field(label), value); field(label).dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT"); expect(call).toBeDefined(); return editorSnapshotSchema.parse(JSON.parse(call![1].body)); }

  it.each([.5, 1.5])("snaps to the left edge and header at %sx scale, clears guides and saves one undoable edit", async (zoom) => {
    await render();
    vi.spyOn(container.querySelector<HTMLElement>("[data-slide-objects]")!, "getBoundingClientRect").mockReturnValue({ width: 960 * zoom, height: 540 * zoom } as DOMRect);
    const handle = button("Move heading object"), x = 100 - 240 * zoom + 5, y = 100 - 54 * zoom + 5;
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", x, y)));
    expect(object().style.left).toBe("0%"); expect(object().style.top).toBe("20%");
    expect(container.querySelector('[data-slide-snap-guide="left"]')).not.toBeNull(); expect(container.querySelector('[data-slide-snap-guide="header"]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => handle.dispatchEvent(pointer("pointerup", x, y)));
    expect(container.querySelector("[data-slide-snap-guide]")).toBeNull();
    expect((await saved()).lessons[0].blocks[0].slideFrame).toEqual({ ...frame, x: 0, y: 20 });
    await act(async () => button("Undo").click()); expect(object().style.left).toBe("25%"); expect(object().style.top).toBe("30%");
    await act(async () => button("Redo").click()); expect(object().style.left).toBe("0%");
  });

  it("bypasses snapping with Alt and retains the snap toggle when changing slides without saving that preference", async () => {
    await render();
    const toolbar = field("Snap to guides").closest("[data-slide-editor-toolbar]");
    expect(toolbar).not.toBeNull(); expect(toolbar?.querySelector('[aria-label="Canvas zoom"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="Snap to guides"]')).toHaveLength(1);
    vi.spyOn(container.querySelector<HTMLElement>("[data-slide-objects]")!, "getBoundingClientRect").mockReturnValue({ width: 960, height: 540 } as DOMRect);
    const handle = button("Move heading object");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", -135, 51, true)));
    expect(Number.parseFloat(object().style.left)).toBeCloseTo(5 / 960 * 100); expect(container.querySelector("[data-slide-snap-guide]")).toBeNull();
    await act(async () => handle.dispatchEvent(pointer("pointercancel", -135, 51, true)));
    expect(object().style.left).toBe("25%");
    await act(async () => field("Snap to guides").click());
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", -135, 51)));
    expect(Number.parseFloat(object().style.left)).toBeCloseTo(5 / 960 * 100); expect(container.querySelector("[data-slide-snap-guide]")).toBeNull();
    await act(async () => handle.dispatchEvent(pointer("pointercancel", -135, 51)));
    await act(async () => button("Edit slide 2: Second").click()); expect(field("Snap to guides").checked).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aligns every edge and center plus the header and footer through the inspector, with undo and saving", async () => {
    await render();
    for (const [alignment, key, expected] of [["left", "left", 0], ["center", "left", 40], ["right", "left", 80], ["top", "top", 0], ["middle", "top", 40], ["bottom", "top", 80]] as const) {
      await act(async () => button(`Align object ${alignment}`).click()); expect(Number.parseFloat(object().style[key])).toBeCloseTo(expected);
    }
    await clickText("Align to header"); expect(object().style.top).toBe("20%");
    await clickText("Align to footer"); expect(Number.parseFloat(object().style.top)).toBeCloseTo((540 - 48) / 540 * 100 - 20);
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0].slideFrame).toMatchObject({ x: 80, width: 20, height: 20, z: 2 });
    await act(async () => button("Undo").click()); expect(object().style.top).toBe("20%");
    await act(async () => button("Redo").click()); expect(Number.parseFloat(object().style.top)).toBeCloseTo((540 - 48) / 540 * 100 - 20);
  });

  it("edits borders, corners, border opacity and shadows and retains them in thumbnails, reload and standalone rendering", async () => {
    await render(); expect(field("Object border width").value).toBe("0"); expect(field("Object border radius").value).toBe("0");
    expect(object().style.borderWidth).toBe("0px"); expect(object().style.borderRadius).toBe("0px");
    await input("Object border width", "4.5"); await input("Object border radius", "12.25");
    await input("Object border color", "#2563eb"); await select("Object border style", "dashed");
    await input("Object border opacity percentage", "60"); await select("Object shadow", "medium");
    const assertPaint = (element: HTMLElement) => {
      expect(element.style.borderWidth).toBe("4.5px"); expect(element.style.borderStyle).toBe("dashed");
      expect(element.style.borderColor).toBe("rgba(37, 99, 235, 0.6)"); expect(element.style.borderRadius).toBe("12.25px");
      expect(element.style.boxShadow).toBe(slideObjectShadows.medium); expect(element.style.opacity).toBe("");
    };
    assertPaint(object());
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideBorder: { width: 4.5, color: "#2563eb", style: "dashed", opacity: 60 }, slideShadow: "medium", slideBorderRadius: 12.25, slideFrame: frame });
    assertPaint(container.querySelector<HTMLElement>('[data-slide-thumbnail-object-id="heading"]')!);
    await act(async () => button("Undo").click()); expect(object().style.boxShadow).toBe("none");
    await act(async () => button("Redo").click()); assertPaint(object());
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />)); assertPaint(object());
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="first" standalone={standalone} persistLocalProgress={false} />)); assertPaint(object());
    }
  });

  it("resets border and shadow in a single undoable edit while preserving the fill and geometry", async () => {
    await render(); await input("Object border width", "3"); await input("Object border radius", "20"); await select("Object shadow", "large");
    const background = object().style.backgroundColor;
    await clickText("Reset border and shadow");
    expect(object().style.borderWidth).toBe("0px"); expect(object().style.borderRadius).toBe("0px"); expect(object().style.boxShadow).toBe("none"); expect(object().style.backgroundColor).toBe(background);
    await act(async () => button("Undo").click()); expect(object().style.borderWidth).toBe("3px"); expect(object().style.borderRadius).toBe("20px"); expect(object().style.boxShadow).toBe(slideObjectShadows.large);
  });
});
