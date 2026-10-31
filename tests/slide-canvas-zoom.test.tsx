/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideObjectArea } from "@/lib/editor/slide-design";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const frame = { x: 11, y: 8, width: 78, height: 24, z: 0 };
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "first", sectionId: "section", title: "Content", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Zoom and edit", level: 1 }, slideFrame: frame }] },
    { id: "cover", sectionId: "section", title: "Cover", order: 1, blocks: [], slideCover: { template: "imageCover" } },
    { id: "quiz", sectionId: "section", title: "Quiz", lessonType: "quiz", order: 2, blocks: [] },
  ],
}) };

describe("presentation canvas zoom", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let stageWidth: number;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    stageWidth = 480;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-stage") ? stageWidth : 0; });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-stage") ? Math.max(340, stageWidth * 9 / 16) : 0; });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  const canvas = () => container.querySelector<HTMLElement>("[data-slide-canvas]")!;
  const stage = () => container.querySelector<HTMLElement>("[data-slide-stage]")!;
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const chooseZoom = (value: string) => act(async () => { const select = container.querySelector<HTMLSelectElement>('[aria-label="Canvas zoom"]')!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });

  it("fits by default, offers bounded zoom steps, and leaves the saved content unchanged", async () => {
    await render();
    expect(canvas().style.transform).toBe("scale(0.5)");
    expect(container.querySelector('[aria-label="Canvas zoom"] option:checked')?.textContent).toBe("Fit (50%)");
    await act(async () => button("Zoom in").click());
    expect(canvas().style.transform).toBe("scale(0.75)");
    expect(stage().getAttribute("data-zoom")).toBe("75");
    await chooseZoom("200");
    expect(canvas().style.transform).toBe("scale(2)");
    expect(button("Zoom in").disabled).toBe(true);
    await act(async () => button("Zoom out").click());
    expect(canvas().style.transform).toBe("scale(1.75)");
    await chooseZoom("25");
    expect(button("Zoom out").disabled).toBe(true);
    expect(canvas().style.transform).toBe("scale(0.25)");
    expect(canvas().parentElement?.style.aspectRatio).toBe("960 / 540");
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.width).toBe("78%");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to Fit, resets scrolling, and refits on window resize", async () => {
    await render();
    await chooseZoom("150");
    stage().scrollLeft = 300; stage().scrollTop = 200;
    stageWidth = 720;
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(canvas().style.transform).toBe("scale(1.5)");
    await chooseZoom("fit");
    expect(canvas().style.transform).toBe("scale(0.75)");
    expect(stage().scrollLeft).toBe(0); expect(stage().scrollTop).toBe(0);
    expect(stage().hasAttribute("data-zoom")).toBe(false);
    stageWidth = 240;
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(canvas().style.transform).toBe("scale(0.25)");
    expect(container.querySelector('[aria-label="Canvas zoom"] option:checked')?.textContent).toBe("Fit (25%)");
  });

  it("keeps the chosen zoom when switching between content, cover, and quiz slides", async () => {
    await render();
    await chooseZoom("125");
    for (const label of ["Edit slide 2: Cover", "Edit slide 3: Quiz", "Edit slide 1: Content"]) {
      await act(async () => button(label).click());
      expect(stage().closest("section")?.classList.contains("rounded-none")).toBe(true);
      expect(canvas().classList.contains("rounded-none")).toBe(true);
      expect(canvas().classList.contains("rounded-sm")).toBe(false);
      expect(container.querySelector<HTMLSelectElement>('[aria-label="Canvas zoom"]')?.value).toBe("125");
      expect(canvas().style.transform).toBe("scale(1.25)");
    }
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([50, 150])("moves objects in slide coordinates at %s%% zoom", async (zoom) => {
    await render(); await chooseZoom(String(zoom));
    await act(async () => button("Select heading object from layers").click());
    const objects = container.querySelector<HTMLElement>("[data-slide-objects]")!;
    vi.spyOn(objects, "getBoundingClientRect").mockReturnValue({ width: 960 * zoom / 100, height: slideObjectArea.height * zoom / 100 } as DOMRect);
    const handle = button("Move heading object");
    handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 0 });
      Object.defineProperty(event, "pointerId", { value: 1 }); return event;
    };
    await act(async () => { handle.dispatchEvent(pointer("pointerdown", 0)); handle.dispatchEvent(pointer("pointermove", 96 * zoom / 100)); handle.dispatchEvent(pointer("pointerup", 96 * zoom / 100)); });
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.left).toBe("21%");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body));
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ ...frame, x: 21 });
    expect(snapshot).not.toHaveProperty("zoom");
  });

  it.each([50, 150])("snaps a dragged block to the footer at %s%% zoom and saves its position", async (zoom) => {
    await render(); await chooseZoom(String(zoom));
    await act(async () => button("Select heading object from layers").click());
    const height = slideObjectArea.height * zoom / 100;
    vi.spyOn(container.querySelector<HTMLElement>("[data-slide-objects]")!, "getBoundingClientRect").mockReturnValue({ width: 960 * zoom / 100, height } as DOMRect);
    const handle = button("Move heading object"); handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, y: number) => { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: y }); Object.defineProperty(event, "pointerId", { value: 1 }); return event; };
    const distance = (100 - frame.height - frame.y) / 100 * height - 6;
    await act(async () => { handle.dispatchEvent(pointer("pointerdown", 0)); handle.dispatchEvent(pointer("pointermove", distance)); });
    expect(container.querySelector('[data-slide-footer-guide]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.top).toBe("76%");
    await act(async () => handle.dispatchEvent(pointer("pointerup", distance)));
    expect(container.querySelector('[data-slide-footer-guide]')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body));
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ ...frame, y: 76 });
  });
});
