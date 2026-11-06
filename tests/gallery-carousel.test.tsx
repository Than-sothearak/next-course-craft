/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryCarousel } from "@/components/gallery-carousel";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { GalleryBlockSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/gallery-block-settings";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { appendSlideObjects, readSlideObjectsClipboard, serializeSlideObjects } from "@/lib/editor/slide-clipboard";
import { remapCourseAssetUrls } from "@/lib/media/asset-references";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Gallery = Extract<ContentBlock, { type: "gallery" }>;
const initial = (): Gallery => ({ id: "gallery", version: 1, width: "medium", widthCustom: false, backgroundColor: "#ffffff", blockPadding: 40, type: "gallery", data: { layout: "carousel", imageFit: "contain", images: [{ src: "/api/assets/507f1f77bcf86cd799439011/file", alt: "Landscape" }, { src: "/two.png", alt: "Portrait", fit: "cover" }, { src: "/three.png", alt: "Square" }] } });

describe("scrolling gallery", () => {
  let root: Root, container: HTMLDivElement;
  const dialogMethods = ["showModal", "close"] as const;
  const originalDialogMethods = dialogMethods.map((name) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name));
  beforeEach(() => {
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) { return Array.from(this.parentElement?.children ?? []).indexOf(this) * 412; });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn(function (this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = options.left ?? 0; }) });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo;
    dialogMethods.forEach((name, index) => { const original = originalDialogMethods[index]; if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original); else Reflect.deleteProperty(HTMLDialogElement.prototype, name); });
  });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

  it("adds a carousel template while legacy galleries remain grids", () => {
    const template = blockTemplates.find((item) => item.id === "gallery-carousel")!;
    for (const create of [createBlocksFromTemplate, createSlideBlocksFromTemplate]) {
      expect(blockSchema.parse(create(template, "new")[0])).toMatchObject({ type: "gallery", width: "medium", data: { layout: "carousel", imageFit: "cover", images: [{}, {}, {}] } });
    }
    expect(blockSchema.parse({ ...initial(), data: { images: [{ src: "/legacy.png", alt: "Legacy" }] } })).not.toHaveProperty("data.layout");
    expect(blockSchema.safeParse({ ...initial(), data: { ...initial().data, imageFit: "stretch" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...initial(), data: { ...initial().data, images: [{ src: "/x.png", alt: "", fit: "stretch" }] } }).success).toBe(false);
  });

  it.each(["contain", "cover", "fill"] as const)("uses %s fit while preserving an individual image override", async (imageFit) => {
    const data = { ...initial().data, imageFit };
    expect(blockSchema.safeParse({ ...initial(), data }).success).toBe(true);
    await act(async () => root.render(<GalleryCarousel data={data} />));
    expect(container.querySelectorAll("img")[0].classList.contains(`object-${imageFit}`)).toBe(true);
    expect(container.querySelectorAll("img")[1].classList.contains("object-cover")).toBe(true);
  });

  it("defaults unconfigured carousel images to Cover", async () => {
    await act(async () => root.render(<GalleryCarousel data={{ ...initial().data, imageFit: undefined }} />));
    expect(container.querySelector("img")?.classList.contains("object-cover")).toBe(true);
  });

  it("navigates, snaps by click and keyboard, respects reduced motion and clamps after removing an image", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await act(async () => root.render(<GalleryCarousel data={initial().data} />));
    expect(button("Previous gallery image").disabled).toBe(true);
    act(() => button("Next gallery image").click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("2 / 3");
    expect(container.querySelector<HTMLElement>("[data-gallery-track]")!.scrollTo).toHaveBeenLastCalledWith({ left: 412, behavior: "instant" });
    act(() => button("View gallery image 3: Square").click());
    expect(button("Next gallery image").disabled).toBe(true);
    act(() => document.querySelector<HTMLButtonElement>('dialog[open] [aria-label="Close dialog"]')!.click());
    act(() => container.querySelector("[data-gallery-track]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(container.querySelector('[role="status"]')?.textContent).toBe("1 / 3");
    act(() => container.querySelector("[data-gallery-track]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    await act(async () => { root.render(<GalleryCarousel data={{ ...initial().data, images: initial().data.images.slice(0, 2) }} />); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("2 / 2");
    expect(button("Next gallery image").disabled).toBe(true);
  });

  it("opens the clicked image outside a scaled canvas, closes independently, and keeps its place", async () => {
    await act(async () => root.render(<GalleryCarousel data={initial().data} presentation />));
    act(() => button("Next gallery image").click());
    const trigger = button("View gallery image 2: Portrait");
    act(() => trigger.click());
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/two.png");
    expect(dialog.querySelector("img")?.classList.contains("object-contain")).toBe(true);
    act(() => document.querySelector<HTMLButtonElement>('dialog[open] [aria-label="Close dialog"]')!.click());
    await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("2 / 3");
  });

  it("preserves layout and individual fit through settings edits, adding/removing, and inheritance", async () => {
    let saved = initial();
    function Settings() {
      const [block, setBlock] = useState(initial()); saved = block;
      return <GalleryBlockSettings block={block} onChange={(next) => { if (next.type === "gallery") setBlock(next); }} setSelectedGalleryImageIndex={vi.fn()} setMediaLibraryTarget={vi.fn()} />;
    }
    await act(async () => root.render(<Settings />));
    const changeSelect = (label: string, value: string) => act(() => { const select = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    changeSelect("Gallery image fit", "cover");
    changeSelect("Gallery image 1 fit", "contain");
    const input = container.querySelector<HTMLInputElement>('[aria-label="Gallery image 1 URL"]')!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "/replacement.png"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(saved.data).toMatchObject({ layout: "carousel", imageFit: "cover", images: [{ src: "/replacement.png", fit: "contain" }, { fit: "cover" }, {}] });
    act(() => [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Add image"))!.click());
    expect(saved.data.images).toHaveLength(4);
    act(() => button("Remove gallery image 4").click());
    changeSelect("Gallery image 1 fit", "default");
    expect(saved.data).toMatchObject({ layout: "carousel", imageFit: "cover", images: [{ fit: undefined }, { fit: "cover" }, {}] });
  });

  it("keeps carousel settings through clipboard, fresh duplication, asset remapping and export", () => {
    const source = blockSchema.parse(initial());
    const copied = readSlideObjectsClipboard(serializeSlideObjects("course", [source], [source.id], { width: 960, height: 540 }), "course")!;
    const pasted = appendSlideObjects(copied, [source], () => "fresh").blocks[1];
    expect(pasted).toMatchObject({ id: "fresh", data: source.data });
    const validated = parseScorm12Snapshot({ title: "Gallery", description: "", revision: 0, sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks: [pasted] }] });
    const snapshot = remapCourseAssetUrls(validated, new Map([["507f1f77bcf86cd799439011", "assets/photo.png"]]));
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { layout: "carousel", imageFit: "contain", images: [{ src: "assets/photo.png" }, { fit: "cover" }, {}] } });
  });
});
