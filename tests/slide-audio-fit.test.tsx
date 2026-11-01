/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideObject } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-editable-object";
import { SlidePlaybackControls } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-playback-controls";
import { SlideAudioSizeControls } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-audio-size-controls";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { audioBlockSchema, blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { defaultSlideFrame, defaultSlideMaster } from "@/lib/editor/slide-design";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const template = blockTemplates.find((item) => item.id === "media-audio")!;
const initial = () => audioBlockSchema.parse({ ...createSlideBlocksFromTemplate(template, "audio")[0], data: { src: "", fileName: "Narration.mp3" }, slideFrame: { x: 10, y: 20, width: 42, height: 70, z: 2 } });

describe("presentation audio object fitting", () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (!this.hasAttribute("data-slide-audio-content")) return 0;
      return (this.querySelector("audio")?.controls ? Number.parseFloat(this.querySelector("audio")!.style.height) : Number.parseFloat(this.querySelector<HTMLButtonElement>("button")!.style.height)) + (this.querySelector("[data-slide-audio-title]") ? 34 : 0);
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("starts with a hidden title and no slide padding while retaining ordinary lesson defaults", () => {
    expect(initial()).toMatchObject({ blockPadding: 0, slidePlayback: { audioSize: "small", showFileName: false, showControls: true } });
    expect(defaultSlideFrame(0, "audio").width).toBe(24);
    expect(createBlocksFromTemplate(template, "standard")[0]).not.toHaveProperty("slidePlayback");
  });

  it.each([["Small", 24], ["Medium", 32], ["Large", 48]] as const)("applies %s without overflowing the right edge or changing playback and content", async (label, width) => {
    const block = { ...initial(), slideFrame: { x: 90, y: 20, width: 10, height: 10, z: 2 } }, change = vi.fn();
    await act(async () => root.render(<SlideAudioSizeControls block={block} index={0} total={1} area={{ width: 960, height: 540 }} onChange={change} />));
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label} audio size"]`)!.click());
    expect(change).toHaveBeenCalledExactlyOnceWith({ ...block, slidePlayback: { ...block.slidePlayback, audioSize: label.toLowerCase() }, slideFrame: { x: 100 - width, y: 20, width, height: 10, z: 2 } });
    expect(audioBlockSchema.safeParse(change.mock.lastCall![0]).success).toBe(true);
  });

  it("fits Small on a tall canvas and validates compact saved audio without changing other block limits", async () => {
    const block = audioBlockSchema.parse({ ...initial(), slidePlayback: { audioSize: "small" } }), change = vi.fn();
    await act(async () => root.render(<div data-slide-objects><SlideObject block={block} index={0} total={1} area={{ width: 960, height: 3840 }} selected onSelect={() => {}} onChange={() => {}} onFrame={change} onEditorFocus={() => {}} onFooterSnap={() => {}} /></div>));
    expect(change.mock.lastCall![0].height).toBeCloseTo(32 / 3840 * 100);
    const compact = { ...block, slideFrame: change.mock.lastCall![0] };
    expect(blockSchema.safeParse(compact).success).toBe(true);
    expect(blockSchema.safeParse({ ...compact, type: "heading", data: { text: "Heading", level: 1 } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...compact, slideFrame: { ...compact.slideFrame, height: .1 } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...compact, slidePlayback: { audioSize: "tiny" } }).success).toBe(false);
  });

  it("moves an audio object up when the taller player would extend below the canvas", async () => {
    const block = audioBlockSchema.parse({ ...initial(), slideFrame: { x: 10, y: 95, width: 48, height: 5, z: 0 }, slidePlayback: { audioSize: "large" } }), change = vi.fn();
    await act(async () => root.render(<div data-slide-objects><SlideObject block={block} index={0} total={1} area={{ width: 960, height: 540 }} selected onSelect={() => {}} onChange={() => {}} onFrame={change} onEditorFocus={() => {}} onFooterSnap={() => {}} /></div>));
    const fitted = change.mock.lastCall![0];
    expect(fitted.height).toBeCloseTo(68 / 540 * 100); expect(fitted.y + fitted.height).toBeCloseTo(100);
    expect(audioBlockSchema.safeParse({ ...block, slideFrame: fitted }).success).toBe(true);
  });

  it("fits a previously oversized object, preserves width and position, and follows the title and controls", async () => {
    const changes = vi.fn();
    function Harness() {
      const [block, setBlock] = useState<ContentBlock>(() => audioBlockSchema.parse({ ...initial(), slidePlayback: { ...initial().slidePlayback, audioSize: "medium" } }));
      return <><SlidePlaybackControls block={block} onChange={setBlock} /><div data-slide-objects><SlideObject block={block} index={0} total={1} master={defaultSlideMaster} area={{ width: 960, height: 540 }} selected onSelect={() => {}} onChange={setBlock} onFrame={(slideFrame) => { changes(slideFrame); setBlock((value) => ({ ...value, slideFrame })); }} onEditorFocus={() => {}} onFooterSnap={() => {}} /></div></>;
    }
    await act(async () => root.render(<Harness />));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ x: 10, y: 20, width: 42, height: 10, z: 2 }));
    expect(container.querySelector<HTMLInputElement>('[aria-label="Show audio file name"]')!.checked).toBe(false);
    expect(container.querySelector("[data-slide-audio-title]")).toBeNull();
    expect(container.querySelector('[data-slide-object-frame]')!.getAttribute("style")).toContain("height: 10%");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Show audio file name"]')!.click());
    expect(changes.mock.lastCall![0].height).toBeCloseTo(88 / 540 * 100);
    expect(container.querySelector("[data-slide-audio-title]")!.textContent).toContain("Narration.mp3");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Show media player controls"]')!.click());
    expect(changes.mock.lastCall![0].height).toBeCloseTo(70 / 540 * 100);
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Show audio file name"]')!.click());
    expect(changes.mock.lastCall![0].height).toBeCloseTo(36 / 540 * 100);
    expect(container.querySelector('[aria-label="Play audio"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Move audio object"]')!.className).toContain("-top-6");
    const count = changes.mock.calls.length;
    await act(async () => container.querySelector("audio")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    expect(changes).toHaveBeenCalledTimes(count);
  });
});
