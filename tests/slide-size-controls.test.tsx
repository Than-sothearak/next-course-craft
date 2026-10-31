/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "first", sectionId: "section", title: "Content", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Heading", level: 1 }, slideFrame: { x: 10, y: 10, width: 50, height: 50, z: 0 } }] },
    { id: "cover", sectionId: "section", title: "Cover", order: 1, blocks: [], slideCover: { template: "imageCover" } },
    { id: "quiz", sectionId: "section", title: "Quiz", lessonType: "quiz", order: 2, blocks: [] },
  ],
}) };

describe("presentation slide size controls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-stage") ? 1000 : this.hasAttribute("data-slide-thumbnail-viewport") ? 240 : 0; });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-stage") ? 800 : 0; });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const canvas = () => container.querySelector<HTMLElement>("[data-slide-canvas]")!;
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  const dimensions = (width: number, height: number) => { expect(canvas().style.width).toBe(`${width}px`); expect(canvas().style.height).toBe(`${height}px`); expect(canvas().parentElement?.style.aspectRatio).toBe(`${width} / ${height}`); };

  it("applies presets course-wide, updates pixel geometry and thumbnails, and supports undo/redo and saving", async () => {
    await render();
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((element) => element.textContent === "Master slide")!.click());
    expect(container.querySelector('[aria-label="Presentation slide size"]')?.closest('[role="tabpanel"]')?.hasAttribute("hidden")).toBe(false);
    await select("Slide size preset", "standard"); dimensions(960, 720);
    await select("Slide orientation", "portrait"); dimensions(720, 960);
    for (const thumbnail of container.querySelectorAll<HTMLElement>("[data-slide-thumbnail-canvas]")) { expect(thumbnail.style.width).toBe("720px"); expect(thumbnail.style.height).toBe("960px"); expect(thumbnail.style.transform).toBe(`scale(${240 / 720})`); }
    await act(async () => button("Select heading object from layers").click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Width (px)"]')?.value).toBe("360");
    expect(Number(container.querySelector<HTMLInputElement>('[aria-label="Height (px)"]')?.value)).toBeCloseTo(50 / 100 * 368 / 540 * 960, 2);
    await input("Width (px)", "180");
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.width).toBe("25%");
    await act(async () => button("Undo").click());
    await act(async () => button("Undo").click()); dimensions(960, 720);
    await act(async () => button("Redo").click()); dimensions(720, 960);
    for (const label of ["Edit slide 2: Cover", "Edit slide 3: Quiz", "Edit slide 1: Content"]) { await act(async () => button(label).click()); dimensions(720, 960); }
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body));
    expect(snapshot.slideMaster?.size).toEqual({ width: 720, height: 960 });
    expect(snapshot.lessons[0].blocks[0].slideFrame?.width).toBe(50);
    expect(snapshot).not.toHaveProperty("zoom");
    await act(async () => root.render(<EditorClient key="reloaded" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />)); dimensions(720, 960);
  });

  it("buffers custom dimensions until applied and rejects invalid dimensions", async () => {
    await render();
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((element) => element.textContent === "Master slide")!.click());
    await select("Slide size preset", "custom");
    await input("Slide width (px)", "1280"); await input("Slide height (px)", "800"); dimensions(960, 540);
    const apply = () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === "Apply custom size")!;
    await act(async () => apply().click()); dimensions(1280, 800);
    await input("Slide width (px)", "100"); expect(apply().disabled).toBe(true);
    await input("Slide width (px)", "1280.5"); expect(apply().disabled).toBe(true);
    await input("Slide width (px)", "3841"); expect(apply().disabled).toBe(true);
    await select("Slide size preset", "square"); dimensions(720, 720);
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Slide orientation"]')?.disabled).toBe(true);
    await select("Slide size preset", "widescreen"); dimensions(960, 540);
  });

  it("fits portrait slides in the viewport and uses authored dimensions for manual zoom", async () => {
    const size = { width: 720, height: 960 };
    await act(async () => root.render(<SlideStage size={size} fillViewport>Portrait</SlideStage>)); dimensions(720, 960);
    expect(canvas().parentElement?.style.width).toBe("600px");
    expect(canvas().style.transform).toBe(`scale(${600 / 720})`);
    await act(async () => root.render(<SlideStage size={size} zoom={150}>Portrait</SlideStage>));
    expect(canvas().parentElement?.style.width).toBe("1080px");
    expect(canvas().style.transform).toBe("scale(1.5)");
    await act(async () => root.render(<SlideStage size={{ width: 1280, height: 800 }} fillViewport>Custom</SlideStage>)); dimensions(1280, 800);
    expect(canvas().parentElement?.style.width).toBe("1000px");
  });
});
