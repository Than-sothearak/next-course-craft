/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { resolveSlideFrame, slideObjectArea } from "@/lib/editor/slide-design";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const source = "/api/assets/507f1f77bcf86cd799439011/file";
function course(type = "image") { return { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Media", order: 0, blocks: [{ id: "media", version: 1, type, data: { src: source, alt: "Example", mimeType: type === "video" ? "video/mp4" : undefined }, slideMedia: { source, width: 1920, height: 1080 }, slideFrame: { x: 5, y: 5, width: 30, height: 40, z: 0 } }] }] }) }; }
function pointer(type: string, x: number, y: number) { return Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }), { pointerId: 1 }); }
describe("presentation crop authoring", () => {
  let root: Root; let container: HTMLDivElement; let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    for (const method of ["setPointerCapture", "releasePointerCapture"]) Object.defineProperty(HTMLElement.prototype, method, { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => true });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetch);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); for (const method of ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"]) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[method]; for (const method of ["showModal", "close"]) delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[method]; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label)!;
  const click = (label: string) => act(async () => button(label).click());
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetch.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }
  async function render(type = "image") { await act(async () => root.render(<EditorClient initialData={course(type)} authorName="" />)); await click(`Select ${type} object from layers`); }
  async function square() { await act(async () => { const input = container.querySelector<HTMLSelectElement>('[aria-label="Crop aspect ratio"]')!; input.value = "1"; input.dispatchEvent(new Event("change", { bubbles: true })); }); }

  it.each(["image", "video"])("applies a crop, saves and reloads it, supports undo, and restores the original proportions (%s)", async (type) => {
    await render(type); await click(`Crop ${type}`); await square();
    expect(container.querySelector<HTMLInputElement>('[aria-label="Crop width (px)"]')!.value).toBe("1080");
    await click("Apply crop"); const snapshot = await saved(); const block = snapshot.lessons[0].blocks[0];
    expect(block.slideCrop).toMatchObject({ source, x: 21.875, y: 0, width: 56.25, height: 100 });
    const frame = resolveSlideFrame(block, 0, 1); expect(frame.width * slideObjectArea.width / (frame.height * slideObjectArea.height)).toBeCloseTo(1);
    expect(container.querySelector('[data-slide-canvas] [data-slide-media-crop]')).not.toBeNull();
    await click("Undo"); expect(container.querySelector('[data-slide-canvas] [data-slide-media-crop]')).toBeNull();
    await act(async () => root.render(<EditorClient key="reload" initialData={{ courseId: "slides", ...snapshot }} authorName="" />)); await click(`Select ${type} object from layers`);
    expect(button("Edit crop")).toBeDefined(); await click("Reset crop"); const reset = (await saved()).lessons[0].blocks[0];
    expect(reset.slideCrop).toBeUndefined(); expect(reset.slideMedia).toEqual(block.slideMedia); expect(reset.type === "image" || reset.type === "video" ? reset.data.src : "").toBe(source);
  });

  it("keeps dragging local until Apply and discards a cancelled crop", async () => {
    await render(); await click("Crop image"); await square();
    const stage = container.querySelector<HTMLElement>('[data-crop-stage]')!, selection = container.querySelector<HTMLElement>('[data-crop-selection]')!;
    stage.getBoundingClientRect = () => new DOMRect(0, 0, 600, 337.5);
    await act(async () => { selection.dispatchEvent(pointer("pointerdown", 200, 100)); stage.dispatchEvent(pointer("pointermove", 230, 100)); stage.dispatchEvent(pointer("pointerup", 230, 100)); });
    expect(container.querySelector<HTMLInputElement>('[aria-label="Crop left (px)"]')!.value).toBe("516");
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetch).not.toHaveBeenCalled();
    await click("Cancel"); expect(container.querySelector("dialog[open]")).toBeNull(); expect(container.querySelector('[data-slide-canvas] [data-slide-media-crop]')).toBeNull();
    await click("Crop image"); expect(container.querySelector<HTMLInputElement>('[aria-label="Crop width (px)"]')!.value).toBe("1920");
  });
});
