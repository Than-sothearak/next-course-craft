/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditorClient } from "../app/courses/[courseId]/slides/edit/slide-editor-client";
import { composeLearningPage } from "../lib/slides/pages";
import { createLearningBlock, learningBlockSchema } from "../lib/slides/blocks";
import { defaultSlideTheme } from "../lib/slides/themes";
import { slideSnapshotSchema, type SlideRecord } from "../lib/slides/schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe("professional timeline edits", () => {
  let root: Root, container: HTMLDivElement, saved: SlideRecord, writes: number;
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); writes = 0;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    saved = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "Timeline", order: 0, revision: 0, objects: [] }), id: "page" });
    saved.composition!.layers = [learningBlockSchema.parse({ ...createLearningBlock("audio"), id: "narration", name: "Narration", src: "https://example.com/a.mp3", start: 2, end: 12, trimStart: 4, trimEnd: 14, volume: .4 }), learningBlockSchema.parse({ ...createLearningBlock("video"), id: "video", name: "Video", src: "https://example.com/v.mp4", start: 0, end: 15, trimStart: 0, trimEnd: 15, volume: .8 })];
    vi.stubGlobal("fetch", vi.fn(async (_input: string, init?: RequestInit) => { if (init?.method === "PATCH") { writes++; saved = { ...slideSnapshotSchema.parse(JSON.parse(String(init.body))), id: "page", revision: saved.revision + 1 }; } return Response.json(saved); }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(<SlideEditorClient courseId="professional" courseTitle="Timeline" initialSlides={[saved]} initialTheme={{ theme: defaultSlideTheme, revision: 0 }} />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  function button(label: string) { const element = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label); expect(element, label).toBeDefined(); return element!; }
  const click = async (label: string) => act(async () => button(label).click());
  const save = async () => act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  function pointer(element: Element, type: string, x: number, altKey = false) { const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, altKey }); Object.defineProperty(event, "pointerId", { value: 1 }); act(() => element.dispatchEvent(event)); }
  async function timeline() { await click("Timeline & layers"); const track = container.querySelector<HTMLElement>('[data-timeline-track="narration"]')!; vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ left: 100, width: 600 } as DOMRect); }
  async function input(label: string, value: string) { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); }); }
  it("previews dragging without autosave, then commits one move and supports one-step undo/redo", async () => {
    await timeline(); const clip = button("Move Narration in time"); Object.defineProperty(clip, "setPointerCapture", { value: vi.fn() });
    pointer(clip, "pointerdown", 200); pointer(clip, "pointermove", 240); pointer(clip, "pointermove", 300);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Narration start"]')?.value).toBe("7");
    await save(); expect(writes).toBe(0); expect(saved.composition!.layers[0].start).toBe(2);
    pointer(clip, "pointerup", 300); await save(); expect(writes).toBe(1);
    expect(saved.composition!.layers[0]).toMatchObject({ start: 7, end: 17, trimStart: 4, trimEnd: 14 });
    await click("Undo slide edit"); await save(); expect(saved.composition!.layers[0]).toMatchObject({ start: 2, end: 12 });
    await click("Redo slide edit"); await save(); expect(saved.composition!.layers[0]).toMatchObject({ start: 7, end: 17 });
  });
  it("cancels a drag, respects locks and leaves the source file and authored timing unchanged", async () => {
    await timeline(); const clip = button("Move Narration in time"), original = JSON.stringify(saved);
    Object.defineProperty(clip, "setPointerCapture", { value: vi.fn() }); pointer(clip, "pointerdown", 200); pointer(clip, "pointermove", 300); pointer(clip, "pointercancel", 300); await save();
    expect(writes).toBe(0); expect(JSON.stringify(saved)).toBe(original);
    await click("Edit Narration"); const lock = [...container.querySelectorAll("label")].find((item) => item.textContent === "Locked")!.querySelector<HTMLInputElement>("input")!; act(() => lock.click());
    expect(button("Move Narration in time").disabled).toBe(true); expect(button("Trim Narration end").disabled).toBe(true);
  });
  it("provides icon-only playback, zoom/fit and persisted workspace preferences without document writes", async () => {
    await timeline(); expect(button("Play timeline").textContent).toBe(""); await click("Play timeline"); expect(button("Pause timeline").textContent).toBe(""); await click("Stop timeline");
    await input("Timeline zoom", "4"); expect(container.querySelector("[data-timeline-panel]")?.getAttribute("data-timeline-zoom")).toBe("4");
    await click("Toggle timeline color theme"); await click("Timeline & layers"); await click("Timeline & layers");
    expect(container.querySelector("[data-timeline-panel]")?.getAttribute("data-timeline-zoom")).toBe("4"); expect(container.querySelector("[data-timeline-panel]")?.className).toContain("bg-slate-50");
    await click("Fit timeline"); expect(container.querySelector("[data-timeline-panel]")?.getAttribute("data-timeline-zoom")).toBe("1"); await save(); expect(writes).toBe(0);
  });
  it("mutes, solos and adjusts monitor gain for actual media elements without changing authored volume", async () => {
    await timeline(); await click("Mute audio monitor"); expect(container.querySelector("audio")?.muted).toBe(true); expect(container.querySelector("video")?.muted).toBe(true);
    await click("Unmute audio monitor"); await click("Mute Narration monitor"); expect(container.querySelector("audio")?.muted).toBe(true); expect(container.querySelector("video")?.muted).toBe(false);
    await click("Unmute Narration monitor"); await click("Solo Narration monitor"); expect(container.querySelector("audio")?.muted).toBe(false); expect(container.querySelector("video")?.muted).toBe(true);
    await input("Monitor volume", ".5"); expect(container.querySelector("audio")?.volume).toBe(.2); expect(container.querySelector("video")?.volume).toBe(.4);
    await click("Unsolo Narration monitor"); expect(container.querySelector("video")?.muted).toBe(false); await save(); expect(writes).toBe(0); expect(saved.composition!.layers[0]).toMatchObject({ volume: .4, trimStart: 4 });
  });
  it("snaps to another clip edge and supports a temporary Alt bypass", async () => {
    await timeline(); const clip = button("Move Narration in time"); Object.defineProperty(clip, "setPointerCapture", { value: vi.fn() });
    pointer(clip, "pointerdown", 200); pointer(clip, "pointermove", 259); pointer(clip, "pointerup", 259); await save(); expect(saved.composition!.layers[0]).toMatchObject({ start: 5, end: 15 });
    await click("Undo slide edit"); await save(); pointer(clip, "pointerdown", 200); pointer(clip, "pointermove", 259, true); pointer(clip, "pointerup", 259); await save(); expect(saved.composition!.layers[0]).toMatchObject({ start: 4.95, end: 14.95 });
  });
});
