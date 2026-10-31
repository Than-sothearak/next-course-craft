/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const frame = { x: 11, y: 8, width: 78, height: 80, z: 2 };
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "slide", sectionId: "section", title: "Map", order: 0, blocks: [{
    id: "graphic", version: 1, type: "labeledGraphic", slideFrame: frame,
    data: { src: "", alt: "Learning map", mapTemplate: "learningRoad", markers: [
      { id: "start", label: "Start", description: "First stop", x: 25, y: 35, color: "#ef4444" },
      { id: "finish", label: "Finish", description: "Last stop", x: 75, y: 65, color: "#2563eb" },
    ] },
  }] }],
}) };

describe("presentation graphic editing", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  const object = () => container.querySelector<HTMLElement>('[data-slide-object-id="graphic"]')!;
  const point = (label: string) => object().querySelector<HTMLButtonElement>(`[aria-label="${label}: show explanation"]`)!;
  async function change(label: string, value: string) {
    const input = object().querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
    await act(async () => {
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: 1 }); return event;
  }

  it("edits a point directly, preserves other points, and retains the result in preview and SCORM", async () => {
    await render();
    await act(async () => point("Start").click());
    await change("Point title", "Trail start");
    await change("Point explanation", "Begin at the road.");
    await change("Point color", "#16a34a");
    const radar = object().querySelector<HTMLInputElement>('[aria-label="Point radar animation"]')!;
    expect(radar.checked).toBe(true);
    await act(async () => radar.click());
    expect(point("Trail start").classList.contains("labeled-graphic-radar")).toBe(false);
    expect(point("Finish").classList.contains("labeled-graphic-radar")).toBe(true);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideFrame: frame, data: { mapTemplate: "learningRoad", markers: [
      { id: "start", label: "Trail start", description: "Begin at the road.", color: "#16a34a", radarEnabled: false, x: 25, y: 35 },
      { id: "finish", label: "Finish", description: "Last stop", color: "#2563eb", x: 75, y: 65 },
    ] } });
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks[0]).toMatchObject(snapshot.lessons[0].blocks[0]);
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await act(async () => point("Trail start").click());
    expect(object().querySelector<HTMLInputElement>('[aria-label="Point color"]')?.value).toBe("#16a34a");
    expect(object().querySelector<HTMLInputElement>('[aria-label="Point radar animation"]')?.checked).toBe(false);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      expect(object().querySelector('svg[aria-label="Learning Road illustrated lesson map"]')).not.toBeNull();
      expect(point("Trail start").style.backgroundColor).toBe("rgb(22, 163, 74)");
      expect(point("Finish").style.backgroundColor).toBe("rgb(37, 99, 235)");
      expect(point("Trail start").classList.contains("labeled-graphic-radar")).toBe(false);
      expect(point("Finish").classList.contains("labeled-graphic-radar")).toBe(true);
      await act(async () => point("Trail start").click());
      expect(object().querySelector(".labeled-graphic-popover")?.textContent).toContain("Begin at the road.");
      expect(object().querySelector('[aria-label="Point title"]')).toBeNull();
    }
  });

  it.each([0.5, 1.5])("moves a point at %sx canvas scale with one undo step and preserves the image frame", async (zoom) => {
    await render();
    const canvas = object().querySelector<HTMLElement>('[data-testid="labeled-graphic-canvas"]')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 100, top: 200, width: 600 * zoom, height: 300 * zoom } as DOMRect);
    const marker = point("Start"); marker.setPointerCapture = vi.fn(); marker.releasePointerCapture = vi.fn();
    await act(async () => marker.dispatchEvent(pointer("pointerdown", 100 + 150 * zoom, 200 + 105 * zoom)));
    await act(async () => marker.dispatchEvent(pointer("pointermove", 100 + 379.26 * zoom, 200 + 236.73 * zoom)));
    expect(marker.style.left).toBe("63.21%"); expect(marker.style.top).toBe("78.91%");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => marker.dispatchEvent(pointer("pointerup", 100 + 379.26 * zoom, 200 + 236.73 * zoom)));
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideFrame: frame, data: { markers: [{ id: "start", x: 63.21, y: 78.91 }, { id: "finish", x: 75, y: 65 }] } });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
    expect(point("Start").style.left).toBe("25%"); expect(point("Start").style.top).toBe("35%");
  });

  it("discards a cancelled drag", async () => {
    await render();
    const canvas = object().querySelector<HTMLElement>('[data-testid="labeled-graphic-canvas"]')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 600, height: 300 } as DOMRect);
    const marker = point("Start"); marker.setPointerCapture = vi.fn(); marker.releasePointerCapture = vi.fn();
    await act(async () => { marker.dispatchEvent(pointer("pointerdown", 150, 105)); marker.dispatchEvent(pointer("pointermove", 300, 150)); });
    await act(async () => marker.dispatchEvent(pointer("pointercancel", 300, 150)));
    expect(marker.style.left).toBe("25%");
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resizes the interactive image object independently in both dimensions and retains its points", async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select labeledGraphic object from layers"]')!.click());
    vi.spyOn(container.querySelector<HTMLElement>("[data-slide-objects]")!, "getBoundingClientRect").mockReturnValue({ width: 960, height: 368 } as DOMRect);
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="Resize labeledGraphic object"]')!;
    handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = vi.fn(() => false);
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 0, 0)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 96, 36.8)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 96, 36.8)));
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideFrame: { ...frame, width: 88, height: 90 }, data: initialData.lessons[0].blocks[0].data });
    expect(object().style.width).toBe("88%"); expect(object().style.height).toBe("90%");
  });

  it("offers image selection without free maps and changes each point color independently", async () => {
    await render(); await act(async () => { point("Start").focus(); point("Start").click(); });
    expect(container.textContent).not.toContain("Free map backgrounds");
    expect(container.querySelector('[aria-label^="Use "][aria-label$=" map"]')).toBeNull();
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === "Choose graphic from media library")).toBe(true);
    const image = container.querySelector<HTMLInputElement>('[aria-label="Graphic image URL"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(image, "/diagram.png");
      image.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const color = container.querySelector<HTMLInputElement>('[aria-label="Graphic marker 2 color"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(color, "#eab308");
      color.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Graphic marker 2 radar animation"]')!.click());
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { src: "/diagram.png", markers: [{ color: "#ef4444" }, { color: "#eab308", radarEnabled: false }] } });
    expect(snapshot.lessons[0].blocks[0].data).not.toHaveProperty("mapTemplate");
    expect(object().querySelector('svg[aria-label$="illustrated lesson map"]')).toBeNull();
    expect(object().querySelector("img")?.getAttribute("src")).toBe("/diagram.png");
  });

  it.each(["fill", "contain", "cover", "none", "scale-down"] as const)("saves and reloads %s fitting and square corners without changing points", async (objectFit) => {
    await render(); await act(async () => { point("Start").focus(); point("Start").click(); });
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Interactive image fit"]')!;
    await act(async () => { select.value = objectFit; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const radius = container.querySelector<HTMLInputElement>('[aria-label="Object border radius"]')!;
    expect(radius.value).toBe("12");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(radius, "0");
      radius.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideBorderRadius: 0, slideFrame: frame, data: { ...initialData.lessons[0].blocks[0].data, objectFit } });
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks[0]).toMatchObject(snapshot.lessons[0].blocks[0]);
    expect(object().style.borderRadius).toBe("0px");
    await act(async () => root.render(<EditorClient key={`reload-${objectFit}`} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await act(async () => { point("Start").focus(); point("Start").click(); });
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Interactive image fit"]')?.value).toBe(objectFit);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Object border radius"]')?.value).toBe("0");
  });
});
