/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditorClient } from "../app/courses/[courseId]/slides/edit/slide-editor-client";
import { SlidePlayerClient } from "../app/courses/[courseId]/slides/preview/slide-player-client";
import { createTemplateSlide } from "../lib/slides/templates";
import { composeLearningPage } from "../lib/slides/pages";
import { createLearningBlock } from "../lib/slides/blocks";
import { defaultSlideTheme } from "../lib/slides/themes";
import { slideSnapshotSchema, type SlideRecord } from "../lib/slides/schema";
import { TimedMedia } from "../components/slides/timed-media";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, kind, courseId, onSelect }: { open: boolean; kind: string; courseId: string; onSelect: (asset: { fileUrl: string; originalName: string }) => void }) => open ? <button onClick={() => onSelect({ fileUrl: "/api/assets/507f1f77bcf86cd799439013/file", originalName: "Narration" })}>Pick {kind} for {courseId}</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("block composition, timeline and learner completion", () => {
  let container: HTMLDivElement, root: Root, saved: SlideRecord[];
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    saved = [composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" })];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "PATCH") { const id = String(input).split("/").at(-1)!, index = saved.findIndex((page) => page.id === id); saved[index] = { ...slideSnapshotSchema.parse(JSON.parse(String(init.body))), id, revision: saved[index].revision + 1 }; return Response.json(saved[index]); }
      if (init?.method === "POST") { const page = { ...slideSnapshotSchema.parse({ title: "New page", order: saved.length, objects: [], revision: 0 }), id: `page-${saved.length}` }; saved.push(page); return Response.json(page); }
      return Response.json(saved);
    }));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  function button(name: string) { const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((element) => element.textContent?.trim() === name || element.getAttribute("aria-label") === name); expect(found, `Button ${name}`).toBeDefined(); return found!; }
  async function click(name: string) { await act(async () => { button(name).click(); for (let index = 0; index < 10; index++) await Promise.resolve(); }); }
  function mountEditor() { act(() => root.render(<SlideEditorClient courseId="course" courseTitle="Interactive learning" initialSlides={saved} initialTheme={{ theme: defaultSlideTheme, revision: 0 }} />)); }
  async function save() { await act(async () => { await vi.advanceTimersByTimeAsync(1_000); }); }
  async function input(label: string, value: string) {
    const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
    expect(element, label).not.toBeNull();
    await act(async () => { const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  function pointer(element: Element, type: string, coordinates: { clientX?: number; clientY?: number }) {
    const event = new MouseEvent(type, { bubbles: true, button: 0, ...coordinates });
    Object.defineProperty(event, "pointerId", { value: 1 });
    act(() => element.dispatchEvent(event));
  }
  it("keeps a fixed HD/Full HD preview while editing and persists the selected resolution", async () => {
    mountEditor();
    const stage = () => container.querySelector<HTMLElement>("[data-stage-content]")!;
    expect(stage().style.width).toBe("1280px"); expect(stage().style.height).toBe("720px");
    await click("Add object"); await click("Add text object"); await input("Block text", "Long content. ".repeat(100));
    expect(stage().style.height).toBe("720px");
    await act(async () => { const select = container.querySelector<HTMLSelectElement>('[aria-label="Preview resolution"]')!; select.value = "fullHd"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(stage().style.width).toBe("1920px"); expect(stage().style.height).toBe("1080px");
    await save(); expect(saved[0].composition?.resolution).toBe("fullHd");
  });
  it("moves and resizes a prebuilt object independently, saves placement, and supports undo", async () => {
    const text = { ...createLearningBlock("text"), name: "Free text" }, image = { ...createLearningBlock("image"), name: "Independent image" };
    saved[0].composition!.layers = [text, image]; mountEditor();
    const design = container.querySelector<HTMLElement>("[data-slide-viewport] [data-canvas-design]")!;
    vi.spyOn(design, "getBoundingClientRect").mockReturnValue({ width: 640 } as DOMRect);
    const handle = button("Edit Free text"); Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });
    pointer(handle, "pointerdown", { clientX: 100, clientY: 100 }); pointer(handle, "pointermove", { clientX: 125, clientY: 110 }); pointer(handle, "pointermove", { clientX: 150, clientY: 125 }); pointer(handle, "pointerup", {});
    await save(); expect(saved[0].composition?.layers[0].placement).toMatchObject({ x: 180, y: 170, width: 600, height: 300 });
    expect(saved[0].composition?.layers[1].placement).toMatchObject({ x: 780, y: 160 });
    await click("Undo slide edit"); await save();
    expect(saved[0].composition?.layers[0].placement).toBeUndefined();
    await click("Edit Free text"); const resize = button("Resize Free text"); Object.defineProperty(resize, "setPointerCapture", { value: vi.fn() });
    pointer(resize, "pointerdown", { clientX: 200, clientY: 200 }); pointer(resize, "pointermove", { clientX: 250, clientY: 225 }); pointer(resize, "pointerup", {});
    await save(); expect(saved[0].composition?.layers[0].placement).toMatchObject({ width: 700, height: 350 });
  });
  it("resizes the timeline by dragging, supports keyboard resizing and keeps its size when adding tracks", async () => {
    mountEditor(); await click("Timeline & layers");
    const separator = container.querySelector<HTMLElement>('[role="separator"][aria-label="Resize timeline"]')!;
    Object.defineProperty(separator, "setPointerCapture", { value: vi.fn() });
    const editor = container.querySelector<HTMLElement>("[data-learning-page-editor]")!;
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue({ height: 800 } as DOMRect);
    pointer(separator, "pointerdown", { clientY: 500 }); pointer(separator, "pointermove", { clientY: 400 }); pointer(separator, "pointerup", {});
    expect(container.querySelector<HTMLElement>("[data-timeline-panel]")!.style.height).toBe("380px");
    await act(async () => separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    expect(container.querySelector<HTMLElement>("[data-timeline-panel]")!.style.height).toBe("400px");
    await click("Add audio track"); await click("Pick audio for course");
    expect(container.querySelector<HTMLElement>("[data-timeline-panel]")!.style.height).toBe("400px");
    await click("Add video track"); await click("Pick video for course"); await save();
    expect(saved[0].composition?.layers.slice(-2)).toMatchObject([{ kind: "audio", src: expect.stringContaining("/api/assets/") }, { kind: "video", src: expect.stringContaining("/api/assets/") }]);
  });
  it("drags audio trim handles, groups the gesture for undo and locks handles with the layer", async () => {
    const audio = { ...createLearningBlock("audio"), name: "Narration", src: "https://example.com/narration.mp3", sourceDuration: 20, start: 2, end: 22, trimStart: 0, trimEnd: 20 };
    saved[0].composition!.layers = [audio]; mountEditor(); await click("Timeline & layers");
    const track = container.querySelector<HTMLElement>("[data-timeline-track]")!;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ left: 100, width: 600 } as DOMRect);
    const handle = button("Trim Narration end"); Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });
    pointer(handle, "pointerdown", { clientX: 540 }); pointer(handle, "pointermove", { clientX: 400 }); pointer(handle, "pointermove", { clientX: 340 }); pointer(handle, "pointerup", {});
    await save(); expect(saved[0].composition?.layers[0]).toMatchObject({ start: 2, end: 12, trimStart: 0, trimEnd: 10 });
    await click("Undo slide edit"); await save(); expect(saved[0].composition?.layers[0]).toMatchObject({ end: 22, trimEnd: 20 });
    const lock = Array.from(container.querySelectorAll("label")).find((label) => label.textContent === "Locked")!.querySelector<HTMLInputElement>("input")!;
    act(() => lock.click()); expect(button("Trim Narration start").disabled).toBe(true); expect(button("Trim Narration end").disabled).toBe(true);
  });
  it.each(["audio", "video"] as const)("uses %s file metadata to size and persist the media layer", async (kind) => {
    saved[0].composition!.layers = []; mountEditor(); await click("Timeline & layers");
    await click(`Add ${kind} track`); await click(`Pick ${kind} for course`);
    const media = container.querySelector<HTMLMediaElement>(kind)!;
    Object.defineProperty(media, "duration", { configurable: true, value: 12 });
    act(() => media.dispatchEvent(new Event("loadedmetadata", { bubbles: true })));
    await save(); expect(saved[0].composition?.layers[0]).toMatchObject({ kind, sourceDuration: 12, start: 0, end: 12 });
  });
  it("adds editable reading and interactive blocks to the same page with persisted timing", async () => {
    mountEditor(); await click("Add object"); await click("Add text object");
    await input("Block heading", "Learning objectives"); await input("Block text", "Read this before exploring the activity.");
    await click("Timeline & layers"); await input("Reading content start", "2"); await input("Reading content end", "12"); await save();
    expect(saved).toHaveLength(1); expect(saved[0].composition?.layers[1]).toMatchObject({ kind: "text", heading: "Learning objectives", start: 2, end: 12 });
    await click("Add object"); await click("Add accordion object"); await save();
    expect(saved[0].composition?.layers[2]).toMatchObject({ kind: "accordion", required: true });
    expect(container.querySelectorAll("button button")).toHaveLength(0);
  });
  it("creates a content page and chooses course audio through the existing media library", async () => {
    mountEditor(); await click("Add page");
    expect(container.querySelector("[data-learning-page]")).not.toBeNull(); expect(saved).toHaveLength(2);
    // Verify that adding audio to the first page preserves the second page.
    await click(`Select page 1: ${saved[0].title}`);
    await click("Add object"); await click("Add audio object"); await click("Choose audio"); await click("Pick audio for course"); await save();
    expect(saved[0].composition?.layers.at(-1)).toMatchObject({ kind: "audio", src: "/api/assets/507f1f77bcf86cd799439013/file" });
  });
  it("tracks ordinary reading, gates quiz completion, restores browser progress and separates accounts", async () => {
    const reading = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "Read first", order: 0, objects: [], revision: 0 }), id: "read" });
    reading.composition!.layers.push(createLearningBlock("text"));
    const assessment = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "Quiz", order: 1, objects: [], revision: 0 }), id: "quiz" });
    assessment.composition!.layers.push(createLearningBlock("quiz"));
    const slides = [reading, assessment];
    act(() => root.render(<SlidePlayerClient title="Learning" slides={slides} progressKey="alice:course" />));
    await click("Mark page complete"); expect(container.textContent).toContain("1 of 2 pages completed");
    await click("Next page"); expect(button("Mark page complete").disabled).toBe(true);
    const choices = container.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
    await act(async () => choices[1].click()); await click("Submit quiz");
    expect(container.textContent).toContain("Score: 0%"); expect(button("Mark page complete").disabled).toBe(true);
    await click("Retry quiz"); await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')[0].click()); await click("Submit quiz");
    expect(container.textContent).toContain("Score: 100%"); expect(button("Mark page complete").disabled).toBe(false);
    await click("Mark page complete"); expect(container.textContent).toContain("2 of 2 pages completed");
    act(() => root.unmount()); root = createRoot(container);
    act(() => root.render(<SlidePlayerClient title="Learning" slides={slides} progressKey="alice:course" />));
    expect(container.textContent).toContain("2 of 2 pages completed");
    act(() => root.render(<SlidePlayerClient title="Learning" slides={slides} progressKey="bob:course" />));
    expect(container.textContent).toContain("0 of 2 pages completed");
  });
  it("requires exploring every tab and does not complete an interaction on first reveal", async () => {
    const page = saved[0]; page.composition!.layers = [createLearningBlock("tabs")];
    act(() => root.render(<SlidePlayerClient title="Explore" slides={[page]} />));
    expect(button("Mark page complete").disabled).toBe(true);
    await click("Explore 1"); expect(button("Mark page complete").disabled).toBe(true);
    await click("Explore 2"); await click("Explore 3"); expect(button("Mark page complete").disabled).toBe(false);
  });
  it("scrubs layer visibility without changing content or order", async () => {
    saved[0].composition!.layers = [{ ...createLearningBlock("text"), start: 5, end: 10 }];
    mountEditor(); await click("Timeline & layers");
    await input("Timeline playhead", "6"); expect(container.querySelector('[data-slide-viewport] [data-learning-page] h2')?.textContent).toBe("A new idea");
    await input("Timeline playhead", "11"); expect(container.querySelector('[data-slide-viewport] [data-learning-page] h2')).toBeNull();
    await click("Edit content"); expect(container.querySelector('[data-slide-viewport] [data-learning-page] h2')?.textContent).toBe("A new idea");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("plays the page clock, reveals timed text and stops at the page duration", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    saved[0].composition = { duration: 2, layers: [{ ...createLearningBlock("text"), start: .5, end: 1.5 }] };
    act(() => root.render(<SlidePlayerClient title="Timed lesson" slides={saved} />));
    expect(container.querySelector('[data-learning-page] h2')).toBeNull();
    await click("Play page"); await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(container.querySelector('[data-learning-page] h2')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(container.querySelector('[data-learning-page] h2')).toBeNull(); expect(button("Play page")).toBeDefined();
    expect(container.textContent).toContain("2.0s / 2s");
  });
  it("runs navigation buttons inside wrapped prebuilt layout blocks", async () => {
    const second = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "Next reading page", order: 1, objects: [], revision: 0 }), id: "next" });
    second.composition!.layers.push(createLearningBlock("text"));
    act(() => root.render(<SlidePlayerClient title="Learning" slides={[saved[0], second]} />));
    const content = saved[0].composition!.layers[0];
    expect(content.kind).toBe("template");
    if (content.kind !== "template" || content.content.slots.button.type !== "button") throw new Error("Expected navigation block");
    await click(content.content.slots.button.label); expect(container.textContent).toContain("Page 2 of 2");
  });
  it("synchronizes audio trim and timeline playback, but scrubbing alone does not complete media", async () => {
    const block = { ...createLearningBlock("audio"), kind: "audio" as const, src: "https://example.com/a.mp3", transcript: "Narration", trimStart: 4, trimEnd: 12, volume: .4, loop: false };
    const complete = vi.fn(), play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(), pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    act(() => root.render(<TimedMedia block={block} time={2} playing onComplete={complete} />));
    expect(container.querySelector("audio")?.currentTime).toBe(6); expect(play).toHaveBeenCalled();
    act(() => root.render(<TimedMedia block={block} time={10} playing={false} onComplete={complete} />));
    expect(pause).toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
    act(() => container.querySelector("audio")!.dispatchEvent(new Event("ended", { bubbles: true })));
    expect(complete).toHaveBeenCalledOnce();
  });
});
