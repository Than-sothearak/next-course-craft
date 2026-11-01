/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeelToReveal } from "@/components/physics-interaction/peel-to-reveal";
import { peelSettingsSchema } from "@/lib/schemas/peel-to-reveal";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let reduced = false;
vi.mock("framer-motion", () => ({ useReducedMotion: () => reduced }));
describe("shared Peel to Reveal runtime", () => {
  let root: Root, container: HTMLDivElement, progress: ReturnType<typeof vi.fn>;
  let frames: Map<number, FrameRequestCallback>, id: number, time: number;
  beforeEach(() => {
    reduced = false; frames = new Map(); id = 0; time = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }); vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 340, height: 180, right: 440, bottom: 230, x: 100, y: 50, toJSON() {} });
    progress = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).setPointerCapture; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const settings = peelSettingsSchema.parse({ title: "Discovery" });
  const render = (extra: Partial<React.ComponentProps<typeof PeelToReveal>> = {}, active = true) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><PeelToReveal blockId="paper" settings={settings} onProgress={progress} {...extra}><p>A <strong>formatted</strong> discovery.</p></PeelToReveal></SlidePlaybackContext.Provider>));
  const handle = () => container.querySelector<HTMLButtonElement>("[data-peel-handle]")!;
  const paper = () => container.querySelector<HTMLElement>("[data-peel-to-reveal]")!;
  const pointer = (type: string, x: number, y: number) => act(async () => { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, "pointerId", { value: 1 }); handle().dispatchEvent(event); });
  async function advance(count = 240) { for (let i = 0; i < count; i++) await act(async () => { time += 1000 / 60; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((cb) => cb(time)); }); }
  const click = () => act(async () => container.querySelector<HTMLButtonElement>("[data-peel-activation]")!.click());
  it("peels on click over time and completes only after the reveal settles", async () => {
    await render(); expect(container.querySelector("[data-peel-content]")?.getAttribute("inert")).toBe(""); expect(container.querySelector("strong")?.textContent).toBe("formatted");
    await click(); await advance(8); expect(paper().dataset.phase).toBe("revealing"); expect(progress).not.toHaveBeenCalled(); expect(Number(paper().dataset.peelProgress)).toBeGreaterThan(0);
    expect(container.querySelector("[data-peel-flap]")?.getAttribute("d")).toContain("Q"); await advance(); expect(progress).toHaveBeenCalledExactlyOnceWith("paper:revealed"); expect(paper().dataset.interactionStatus).toBe("completed"); expect(container.querySelector("[data-peel-content]")?.hasAttribute("inert")).toBe(false);
  });
  it("springs back after an early release and completes a fast drag at 50% presentation scale", async () => {
    await render({ presentation: true }); await pointer("pointerdown", 430, 60); await pointer("pointermove", 400, 75); await advance(10); expect(Number(paper().dataset.peelProgress)).toBeGreaterThan(0); await pointer("pointerup", 400, 75); await advance(); expect(paper().dataset.phase).toBe("idle"); expect(progress).not.toHaveBeenCalled();
    await pointer("pointerdown", 430, 60); await pointer("pointermove", 130, 220); await pointer("pointerup", 130, 220); await advance(); expect(progress).toHaveBeenCalledExactlyOnceWith("paper:revealed");
  });
  it("taps the corner using the same automatic animation", async () => { await render(); await pointer("pointerdown", 430, 60); await pointer("pointerup", 430, 60); expect(paper().dataset.phase).toBe("revealing"); expect(progress).not.toHaveBeenCalled(); await advance(); expect(progress).toHaveBeenCalledOnce(); });
  it("cancels captured pointers and Escape without recording completion", async () => { await render(); await pointer("pointerdown", 430, 60); await pointer("pointermove", 130, 220); await pointer("pointercancel", 130, 220); await advance(); expect(paper().dataset.phase).toBe("idle"); expect(progress).not.toHaveBeenCalled(); await pointer("pointerdown", 430, 60); await pointer("pointermove", 130, 220); await act(async () => handle().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); await advance(); expect(progress).not.toHaveBeenCalled(); });
  it("cancels an automatic peel with Escape and moves keyboard focus to successfully revealed content", async () => {
    await render(); await click(); await advance(8); await act(async () => paper().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(paper().dataset.phase).toBe("idle"); await advance(); expect(progress).not.toHaveBeenCalled();
    await act(async () => { handle().focus(); handle().click(); }); await advance(); expect(document.activeElement).toBe(container.querySelector("[data-peel-content]")); expect(progress).toHaveBeenCalledOnce();
  });
  it("restores saved completion and allows replay without duplicate completion events", async () => {
    await render({ interactedContentIds: new Set(["paper:revealed"]) }); expect(paper().dataset.phase).toBe("revealed"); expect(progress).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Replay peel"]')!.click()); await click(); await advance(); expect(progress).not.toHaveBeenCalled();
    await render({ interactedContentIds: new Set(["paper:revealed"]) }); expect(paper().dataset.phase).toBe("revealed");
  });
  it("supports keyboard activation even in drag-only mode, with reduced motion", async () => { reduced = true; await render({ settings: { ...settings, trigger: "drag" } }); expect(container.querySelector("[data-peel-activation]")).toBeNull(); await act(async () => handle().click()); expect(paper().dataset.phase).toBe("revealed"); expect(progress).toHaveBeenCalledOnce(); expect(frames.size).toBe(0); });
  it("does not interpret a drag-only tap as completion", async () => { await render({ settings: { ...settings, trigger: "drag" } }); await pointer("pointerdown", 430, 60); await pointer("pointerup", 430, 60); await advance(); expect(progress).not.toHaveBeenCalled(); expect(paper().dataset.phase).toBe("idle"); });
  it("previews without learner progress and keeps thumbnails inert", async () => { await render({ authoring: true }); await click(); await advance(); expect(paper().dataset.phase).toBe("revealed"); expect(progress).not.toHaveBeenCalled(); await render({ decorative: true }); expect(frames.size).toBe(0); });
  it("cancels animations on slide exit, visibility change and unmount", async () => {
    await render({ presentation: true }); await click(); await advance(8); await render({ presentation: true }, false); expect(frames.size).toBe(0); expect(paper().dataset.phase).toBe("idle"); await advance(); expect(progress).not.toHaveBeenCalled();
    await render(); await click(); await advance(8); await act(async () => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); }); expect(frames.size).toBe(0); expect(progress).not.toHaveBeenCalled(); Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await click(); await act(async () => root.render(null)); expect(frames.size).toBe(0);
  });
  it("honors reset and repeated-interaction settings", async () => { await render({ settings: { ...settings, allowRepeat: false } }); await click(); await advance(); expect(container.querySelector('[aria-label="Replay peel"]')).toBeNull(); });
});
