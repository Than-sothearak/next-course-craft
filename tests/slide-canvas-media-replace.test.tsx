/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideCanvasMediaReplace } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-canvas-media-replace";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const assets = [
  { id: "image", originalName: "Photo.png", contentType: "image/png", size: 100, fileUrl: "/new.png", createdAt: "2026-01-01" },
  { id: "video", originalName: "Clip.mp4", contentType: "video/mp4", size: 200, fileUrl: "/new.mp4", createdAt: "2026-01-01" },
  { id: "audio", originalName: "Voice.mp3", contentType: "audio/mpeg", size: 300, fileUrl: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", createdAt: "2026-01-01" },
  { id: "file", originalName: "Notes.pdf", contentType: "application/pdf", size: 400, fileUrl: "/api/assets/bbbbbbbbbbbbbbbbbbbbbbbb/file", createdAt: "2026-01-01" },
];
const frame = { x: 10, y: 15, width: 40, height: 30, z: 2, rotation: 15 };
function sample(type: string): ContentBlock {
  const data = type === "gallery" ? { images: [{ src: "/first.png", alt: "First" }, { src: "/second.png", alt: "Second" }] }
    : type === "labeledGraphic" ? { src: "/old.png", alt: "Diagram", markers: [{ id: "point", label: "Point", description: "", x: 20, y: 30 }] }
    : type === "attachment" ? { src: "", fileName: "Old.pdf", size: 10 }
    : type === "audio" ? { src: "", fileName: "Old.mp3" }
    : { src: "/old.png", alt: "Original", fileName: "Old.mp3" };
  return blockSchema.parse({ id: type, version: 1, type, data, slideFrame: frame, slideCrop: type === "image" || type === "video" ? { source: "/old.png", x: 0, y: 0, width: 50, height: 50 } : undefined });
}

describe("canvas media replacement", () => {
  let root: Root, container: HTMLDivElement;
  let canvasRect: DOMRect;
  let objectRect: DOMRect;
  const changed = vi.fn();
  beforeEach(() => {
    changed.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ assets })));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    canvasRect = new DOMRect(100, 120, 720, 405);
    objectRect = new DOMRect(240, 200, 280, 120);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-slide-object-frame")) return objectRect;
      if (this.getAttribute("aria-label") === "Replace media") return new DOMRect(0, 0, 144, 32);
      return this.hasAttribute("data-slide-stage") ? new DOMRect(80, 100, 760, 450) : canvasRect;
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
  });
  function Fixture({ initial }: { initial: ContentBlock | null }) {
    const [block, setBlock] = useState(initial);
    return <div data-slide-stage><div data-slide-canvas><div data-slide-object-frame data-slide-object-id={block?.id} /></div><SlideCanvasMediaReplace block={block} courseId="course" onChange={(next) => { changed(next); setBlock(next); }} /></div>;
  }
  const render = (block: ContentBlock | null) => act(async () => root.render(<Fixture key={block?.id ?? "none"} initial={block} />));
  const click = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());

  it.each([
    ["image", "Photo.png", "/new.png"], ["video", "Clip.mp4", "/new.mp4"], ["audio", "Voice.mp3", assets[2].fileUrl],
    ["attachment", "Notes.pdf", assets[3].fileUrl], ["labeledGraphic", "Photo.png", "/new.png"],
  ])("replaces %s through one canvas-sized dialog and preserves object placement", async (type, filename, src) => {
    const block = sample(type);
    await render(block);
    expect(container.querySelector("dialog")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    await click("Replace media");
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(dialog.style.left).toBe("100px"); expect(dialog.style.top).toBe("120px");
    expect(dialog.style.width).toBe("720px"); expect(dialog.style.height).toBe("405px");
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith("/api/courses/course/assets", { cache: "no-store" });
    await click(`Use ${filename}`);
    expect(container.querySelector("dialog")).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0]).toMatchObject({ id: block.id, type, slideFrame: frame, data: { src } });
    if (type === "image" || type === "video") expect(changed.mock.calls[0][0].slideCrop).toBeUndefined();
    if (type === "labeledGraphic") expect(changed.mock.calls[0][0].data.markers).toEqual(block.type === "labeledGraphic" ? block.data.markers : []);
  });

  it("replaces the chosen gallery image and preserves the others", async () => {
    await render(sample("gallery")); await click("Replace media");
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Gallery image to replace"]')!;
    await act(async () => { select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("Use Photo.png");
    expect(changed.mock.calls[0][0].data.images).toEqual([{ src: "/first.png", alt: "First" }, { src: "/new.png", alt: "Second" }]);
  });

  it("places the action below the object and follows movement and resizing", async () => {
    await render(sample("image"));
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Replace media"]')!;
    expect(button.style.left).toBe("308px");
    expect(button.style.top).toBe("332px");
    expect(button.style.visibility).toBe("visible");
    objectRect = new DOMRect(400, 240, 320, 150);
    await act(async () => { container.querySelector<HTMLElement>('[data-slide-object-frame]')!.style.left = "40%"; });
    expect(button.style.left).toBe("488px"); expect(button.style.top).toBe("402px");
    expect(fetch).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });

  it("moves above a bottom-edge object and keeps the action inside the canvas", async () => {
    objectRect = new DOMRect(760, 460, 100, 65);
    await render(sample("image"));
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Replace media"]')!;
    expect(button.style.left).toBe("668px"); expect(button.style.top).toBe("416px");
    objectRect = new DOMRect(40, 120, 100, 60);
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(button.style.left).toBe("108px"); expect(button.style.top).toBe("192px");
    objectRect = new DOMRect(-200, 120, 100, 60);
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(button.style.visibility).toBe("hidden");
  });

  it("tracks the visible canvas while zooming or scrolling, and cancels without editing", async () => {
    await render(sample("image")); await click("Replace media");
    canvasRect = new DOMRect(-100, 20, 1440, 810);
    await act(async () => window.dispatchEvent(new Event("scroll")));
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(dialog.style.left).toBe("80px"); expect(dialog.style.top).toBe("100px");
    expect(dialog.style.width).toBe("760px"); expect(dialog.style.height).toBe("450px");
    await act(async () => dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(container.querySelector("dialog")).toBeNull(); expect(changed).not.toHaveBeenCalled();
    await click("Replace media"); await click("Close dialog");
    expect(container.querySelector("dialog")).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });

  it("hides replacement for no selection, non-media, locked, and hidden objects", async () => {
    const heading = blockSchema.parse({ id: "heading", type: "heading", version: 1, data: { text: "Title", level: 2 } });
    for (const block of [null, heading, { ...sample("image"), id: "locked", slideLocked: true }, { ...sample("image"), id: "hidden", slideHiddenInEditor: true }]) {
      await render(block);
      expect(container.querySelector('[aria-label="Replace media"]')).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
});
