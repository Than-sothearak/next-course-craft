/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { blockSchema, interactionButtonBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { replaySlideObjectAnimations } from "@/lib/editor/slide-animation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const button = interactionButtonBlockSchema.parse({ id: "button", version: 1, type: "interactionButton", data: { label: "Explore details", popup: { title: "Discover", blocks: [
  { id: "text", type: "richText", version: 1, data: { html: "<p>Explanation in a mini slide</p>" } },
  { id: "audio", type: "audio", version: 1, data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", fileName: "Voice", mimeType: "audio/mpeg" }, slidePlayback: { autoPlay: true } },
  { id: "video", type: "video", version: 1, data: { src: "/api/assets/bbbbbbbbbbbbbbbbbbbbbbbb/file", mimeType: "video/mp4" }, slidePlayback: { autoPlay: true } },
] } } });

describe("learner interaction button", () => {
  let root: Root; let container: HTMLDivElement; let play: ReturnType<typeof vi.spyOn>; let pause: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const open = () => act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Explore details"]')!.click());
  const render = (block: typeof button = button, active = true, onProgress = vi.fn(), lessonBlocks: ContentBlock[] = []) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><PreviewBlock block={block} device="desktop" orientation="landscape" slideLayout lessonBlocks={lessonBlocks} onInteractiveProgress={onProgress} /></SlidePlaybackContext.Provider>));

  it("mounts a smooth popup on activation, records opening and pauses/unmounts media on Escape", async () => {
    const onProgress = vi.fn(); await render(button, true, onProgress);
    expect(document.querySelector("audio, video")).toBeNull(); expect(play).not.toHaveBeenCalled();
    await open(); await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(document.querySelector("dialog[open]")?.classList.contains("interaction-popup-zoom")).toBe(true);
    expect(document.querySelector('[data-interaction-popup-canvas]')?.textContent).toContain("Explanation in a mini slide");
    expect(document.querySelectorAll("audio,video")).toHaveLength(2); expect(play).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls).toEqual([["button:opened"]]);
    const media = [...document.querySelectorAll("audio,video")];
    await act(async () => document.querySelector("dialog[open]")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(document.querySelector("dialog[open]")).toBeNull(); expect(document.querySelector("audio,video")).toBeNull();
    for (const element of media) expect(pause.mock.contexts).toContain(element);
  });

  it("closes the popup when its presentation slide becomes inactive", async () => {
    await render(); await open(); await render(button, false); await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(document.querySelector("dialog[open]")).toBeNull(); expect(document.querySelector("audio,video")).toBeNull();
  });

  it("portals the modal outside the scaled slide while retaining its course container", async () => {
    await act(async () => root.render(<main data-presentation-view><div data-scaled-canvas style={{ transform: "scale(.5)", opacity: .8 }}><PreviewBlock block={button} device="desktop" orientation="landscape" authoring /></div></main>));
    await open();
    expect(document.querySelector("dialog[open]")?.parentElement).toBe(document.querySelector("main"));
    expect(document.querySelector("[data-scaled-canvas] dialog")).toBeNull();
  });

  it("renders a selected existing activity and records its interaction using the original ID", async () => {
    const target = blockSchema.parse({ id: "accordion", version: 1, type: "accordion", data: { items: [{ id: "first", title: "Read more", body: "A linked explanation" }, { id: "second", title: "Second detail", body: "Second explanation" }] } });
    const linked = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, action: "block", targetBlockId: target.id } });
    const progress = vi.fn(); await render(linked, true, progress, [linked, target]); await open();
    expect(document.querySelector("dialog[open]")?.textContent).toContain("A linked explanation");
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find((item) => item.textContent?.includes("Second detail"))!.click());
    expect(progress).toHaveBeenCalledWith("button:opened"); expect(progress).toHaveBeenCalledWith("accordion:section:second");
  });

  it("disables unavailable targets and renders custom image triggers without radar", async () => {
    const changed = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, trigger: "image", imageSrc: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", imageAlt: "View diagram", radarEnabled: false, color: "#ff8800", action: "block", targetBlockId: "missing" } });
    await render(changed);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Explore details"]')!;
    expect(trigger.disabled).toBe(true); expect(trigger.classList.contains("labeled-graphic-radar")).toBe(false);
    expect(trigger.querySelector("img")?.alt).toBe("View diagram"); expect(trigger.style.backgroundColor).toBe("rgb(255, 136, 0)");
  });

  it("renders icon gradients with distinct SVG definitions", async () => {
    const gradient = "linear-gradient(135deg, #2563eb 0%, #f97316 100%)";
    await render(interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, iconColor: gradient } }));
    expect(document.querySelector('[aria-label="Explore details"] svg')?.getAttribute("stroke")).toMatch(/^url\(#interaction-icon-/);
    expect(document.querySelectorAll("linearGradient stop")).toHaveLength(2);
  });

  it("answers a popup activity and unlocks Continue without adding lesson progress tasks", async () => {
    const configured = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [
      { id: "question", version: 1, type: "knowledgeCheck", data: { question: "Ready?", options: ["Yes", "No"], correctOptionIndex: 0 } },
      { id: "continue", version: 1, type: "divider", data: { style: "continue", label: "Show result", completionType: "completeAbove" } },
      { id: "result", version: 1, type: "chart", data: { chartType: "bar", title: "Results", fields: [{ id: "one", label: "Score", value: 10 }] } },
    ] } } });
    const progress = vi.fn(); await render(configured, true, progress); await open();
    expect(document.querySelector('[data-interaction-popup-canvas]')?.textContent).not.toContain("Results");
    expect(document.querySelector<HTMLButtonElement>('[aria-label^="Show result"]')?.disabled).toBe(true);
    await act(async () => document.querySelector<HTMLInputElement>('input[type="radio"][value="0"]')!.click());
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find((item) => item.textContent === "Check answer")!.click());
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Show result"]')?.disabled).toBe(false);
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Show result"]')!.click());
    expect(document.querySelector('[data-interaction-popup-canvas]')?.textContent).toContain("Results");
    expect(progress.mock.calls).toEqual([["button:opened"]]);
  });

  it("opens a popup-local linked block in a nested dialog and closes only that dialog on Escape", async () => {
    const configured = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [
      { id: "details", version: 1, type: "richText", data: { html: "<p>Nested explanation</p>" } },
      { id: "nested", version: 1, type: "interactionButton", data: { label: "Open nested details", action: "block", targetBlockId: "details" } },
    ] } } });
    await render(configured); await open();
    const parent = document.querySelector<HTMLDialogElement>("dialog[open]")!;
    await act(async () => parent.querySelector<HTMLButtonElement>('[aria-label="Open nested details"]')!.click());
    const nested = parent.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(nested.textContent).toContain("Nested explanation");
    await act(async () => nested.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(parent.open).toBe(true); expect(parent.querySelector("dialog[open]")).toBeNull();
  });

  it("uses authored entrance animation settings for popup objects", async () => {
    const configured = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [
      { id: "text", version: 1, type: "richText", slideAnimation: { effect: "slide-left", duration: 600, delay: 80 }, data: { html: "<p>Animated popup text</p>" } },
    ] } } });
    await render(configured); await open();
    expect(document.querySelector('[data-interaction-popup-canvas] [data-slide-object-animation="slide-left"]')?.textContent).toContain("Animated popup text");
  });

  it("staggers popup list items with the shared 1000 ms Slide up default", async () => {
    const configured = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [
      { id: "list", version: 1, type: "richText", data: { html: "<ol><li><p>First</p></li><li><p>Second</p></li><li><p>Third</p></li></ol>" } },
    ] } } });
    await render(configured); await open();
    const canvas = document.querySelector<HTMLElement>("[data-interaction-popup-canvas]")!;
    const items = [...canvas.querySelectorAll("li")].map((item) => {
      const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel: vi.fn() }));
      Object.defineProperty(item, "animate", { configurable: true, value: animate }); return animate;
    });
    expect(items).toHaveLength(3);
    act(() => replaySlideObjectAnimations(canvas));
    items.forEach((animate, index) => expect(animate.mock.calls[0]).toEqual([[{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: index * 120, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]));
  });

  it.each(["#8b5cf6", "linear-gradient(135deg, #2563eb 0%, #f97316 100%)"])("applies radar size and weight with %s rings", async (radarColor) => {
    await render(interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, radarColor, radarSize: 7, radarWeight: 4 } }));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Explore details"]')!;
    expect(trigger.classList.contains("labeled-graphic-radar")).toBe(true);
    expect(trigger.classList.contains("labeled-graphic-radar-gradient")).toBe(radarColor.startsWith("linear-gradient"));
    expect(trigger.style.getPropertyValue("--radar-size")).toBe("7px");
    expect(trigger.style.getPropertyValue("--radar-weight")).toBe("4px");
    await open();
    expect(document.querySelector("dialog[open]")).not.toBeNull();
  });

  it("keeps the original radar appearance for older buttons", async () => {
    await render();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Explore details"]')!;
    expect(trigger.style.getPropertyValue("--radar-size")).toBe("3px");
    expect(trigger.style.getPropertyValue("--radar-weight")).toBe("2px");
  });

  it.each([
    ["top-left", "start", "start"], ["top-center", "start", "center"], ["top-right", "start", "end"],
    ["middle-left", "center", "start"], ["middle-center", "center", "center"], ["middle-right", "center", "end"],
    ["bottom-left", "end", "start"], ["bottom-center", "end", "center"], ["bottom-right", "end", "end"],
  ])("places a fixed pixel button at %s inside its object", async (position, alignItems, justifyItems) => {
    await render(interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, buttonSize: 96.25, position } }));
    const frame = document.querySelector<HTMLElement>("[data-interaction-button-container]")!;
    const trigger = frame.querySelector("button")!;
    expect(frame.style.alignItems).toBe(alignItems); expect(frame.style.justifyItems).toBe(justifyItems);
    expect(trigger.style.width).toBe("min(96.25px, 100cqw, 100cqh)"); expect(trigger.style.height).toBe(trigger.style.width);
    expect(trigger.querySelector("svg")?.getAttribute("width")).toBe("40");
  });

  it("centers buttons saved before fixed sizing and alignment were added", async () => {
    const old = structuredClone(button);
    delete (old.data as Partial<typeof old.data>).buttonSize;
    delete (old.data as Partial<typeof old.data>).position;
    await render(old);
    expect(document.querySelector("[data-interaction-button-container]")?.getAttribute("data-button-position")).toBe("middle-center");
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Explore details"]')?.style.width).toBe("min(80px, 100cqw, 100cqh)");
  });

  it("keeps the settings preview compact outside a presentation object", async () => {
    await act(async () => root.render(<PreviewBlock block={button} device="desktop" orientation="landscape" authoring />));
    expect(document.querySelector<HTMLElement>("[data-interaction-button-container]")?.style.height).toBe("80px");
  });
});
