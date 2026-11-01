/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { InteractionPopupContent } from "@/app/courses/[courseId]/_components/slide-presentation/interaction-popup-content";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { galleryBlockSchema, interactionButtonBlockSchema } from "@/lib/schemas/block";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const gallery = (count = 3) => galleryBlockSchema.parse({ id: "gallery", version: 1, type: "gallery", slideFrame: { x: 10, y: 20, width: 75, height: 40, z: 0 }, data: { images: Array.from({ length: count }, (_, index) => ({ src: `/photo-${index}.png`, alt: `Photo ${index + 1}` })) } });
const presentation = () => ({ courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Gallery", order: 0, blocks: [gallery()] }] }) });

describe("presentation image groups", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event("close")); } });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const imageGroup = () => container.querySelector<HTMLElement>("[data-slide-gallery]")!;
  const imageButtons = () => [...imageGroup().querySelectorAll<HTMLButtonElement>("[data-slide-gallery-item] > button")];

  it.each([1, 2, 3, 4, 6, 8])("fits %i images into explicitly sized grid tracks without fixed image aspect ratios", async (count) => {
    for (const device of ["desktop", "mobile"] as const) {
      await act(async () => root.render(<PreviewBlock block={gallery(count)} slideLayout device={device} orientation="portrait" />));
      expect(imageGroup().parentElement).toBe(container);
      expect(imageGroup().style.gridTemplateRows).toBe(`repeat(${Math.ceil(count / Math.min(count, 3))}, minmax(0, 1fr))`);
      expect(imageButtons()).toHaveLength(count);
      for (const button of imageButtons()) {
        const image = button.querySelector("img")!;
        expect(button.classList.contains("h-full")).toBe(true);
        expect(image.classList.contains("h-full")).toBe(true); expect(image.classList.contains("object-cover")).toBe(true);
        expect(image.getAttribute("height")).toBeNull(); expect(image.className).not.toContain("aspect-");
      }
    }
  });

  it("keeps ordinary lesson gallery proportions and fullscreen viewing", async () => {
    await act(async () => root.render(<PreviewBlock block={gallery()} device="desktop" orientation="landscape" />));
    expect(imageGroup()).toBeNull(); expect(container.querySelector("img")?.className).toContain("aspect-[4/3]");
    await act(async () => root.render(<PreviewBlock block={gallery()} slideLayout device="desktop" orientation="landscape" />));
    await act(async () => imageButtons()[0].click()); expect(container.querySelector("dialog[open]")?.getAttribute("aria-label")).toBe("Image preview: Photo 1");
    await act(async () => container.querySelector<HTMLButtonElement>('dialog[open] [aria-label="Close image preview"]')!.click()); expect(container.querySelector("dialog[open]")).toBeNull();
  });

  it("resizes the gallery object, supports undo and saving, and shares fitting in thumbnails and learners", async () => {
    await act(async () => root.render(<EditorClient initialData={presentation()} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select gallery object from layers"]')!.click());
    for (const [label, value] of [["Width (px)", "480"], ["Height (px)", "300"]]) {
      const field = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
    }
    const frame = () => container.querySelector<HTMLElement>('[data-slide-object-id="gallery"]')!;
    expect(frame().style.width).toBe("50%"); expect(Number.parseFloat(frame().style.height)).toBeCloseTo(300 / 540 * 100);
    expect(frame().querySelector("[data-slide-gallery]")).not.toBeNull();
    expect(container.querySelector('[data-slide-thumbnail-object-id="gallery"] [data-slide-gallery]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click()); expect(frame().style.height).toBe("40%");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!.click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!;
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body));
    expect(snapshot.lessons[0].blocks[0].slideFrame?.height).toBeCloseTo(300 / 540 * 100);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      expect(imageGroup()).not.toBeNull(); expect(imageButtons()).toHaveLength(3); expect(frame().style.width).toBe("50%");
    }
  });

  it("uses the same fitted image group inside a popup mini slide", async () => {
    const popup = interactionButtonBlockSchema.parse({ id: "button", type: "interactionButton", version: 1, data: { popup: { blocks: [gallery(6)] } } }).data.popup;
    await act(async () => root.render(<InteractionPopupContent popup={popup} blocks={popup.blocks} authoring={false} device="mobile" orientation="portrait" lessons={[]} visitedLessonIds={new Set()} passedQuizIds={new Set()} getLessonNavigationLockMessage={() => null} onOpenLesson={() => {}} />));
    expect(imageGroup()).not.toBeNull(); expect(imageButtons()).toHaveLength(6);
    expect(imageGroup().closest('[data-slide-object-id="gallery"]')).not.toBeNull();
  });
});
