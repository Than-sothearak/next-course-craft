/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BalloonArcher } from "@/components/balloon-archer";
import { balloonArcherDataSchema } from "@/lib/schemas/balloon-archer";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data = balloonArcherDataSchema.parse({ balloons: [{ id: "one", word: "Gravity", content: "A force that attracts objects.", x: 50, y: 25 }, { id: "two", word: "Energy", content: "The ability to do work.", x: 25, y: 40 }] });
describe("Balloon Archer runtime", () => {
  let root: Root; let container: HTMLDivElement; let progress: ReturnType<typeof vi.fn>; let position: ReturnType<typeof vi.fn>;
  let frames: Map<number, FrameRequestCallback>; let frameId: number; let time: number;
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    frames = new Map(); frameId = 0; time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    Object.defineProperty(SVGElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} });
    progress = vi.fn(); position = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (SVGElement.prototype as unknown as Record<string, unknown>).setPointerCapture; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = (extra: Partial<React.ComponentProps<typeof BalloonArcher>> = {}, active = true) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><BalloonArcher blockId="game" data={data} onProgress={progress} onPositionChange={position} {...extra} /></SlidePlaybackContext.Provider>));
  const button = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
  const pointer = (element: Element, type: string, x: number, y: number) => act(async () => { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, "pointerId", { value: 1 }); element.dispatchEvent(event); });
  async function advance(count = 120) { for (let index = 0; index < count; index++) await act(async () => { time += 1000/60; const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(time)); }); }
  async function shoot() { const arrow = button("Grab arrow, pull down and release to shoot"); for (let index = 0; index < 9; index++) await act(async () => arrow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))); await act(async () => arrow.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))); await advance(); }

  it("requires a physical release and real collision before revealing text or recording progress", async () => {
    await render(); expect(container.textContent).not.toContain(data.balloons[0].content);
    await pointer(button("Grab arrow, pull down and release to shoot"), "pointerdown", 400, 490);
    await pointer(container.querySelector("svg[data-archer-scene]")!, "pointermove", 400, 580);
    expect(container.querySelector("[data-archer-string]")?.getAttribute("d")).toContain("580"); expect(progress).not.toHaveBeenCalled();
    await pointer(container.querySelector("svg[data-archer-scene]")!, "pointerup", 400, 580); await advance();
    expect(container.textContent).toContain(data.balloons[0].content); expect(progress).toHaveBeenCalledExactlyOnceWith("game:balloon:one");
    expect(container.querySelector('[data-archer-balloon="one"]')?.getAttribute("data-popped")).toBe("true");
  });
  it("renders the white/black default palette with visible strings, arrow, and progress labels", async () => {
    await render({ decorative: true });
    expect(container.querySelector<HTMLElement>("[data-archer-arena]")?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(container.querySelector('[data-archer-balloon="one"] ellipse')?.getAttribute("fill")).toBe("#000000");
    expect(container.querySelector('[data-archer-arrow] line')?.getAttribute("stroke")).toBe("#000000");
    expect([...container.querySelectorAll('[data-archer-bow] path')].every((path) => path.getAttribute("stroke") === "#000000")).toBe(true);
    expect(container.querySelector<HTMLElement>('[aria-label="Balloon progress"]')?.style.color).toBe("rgb(0, 0, 0)");
    expect(container.querySelector<HTMLElement>('[data-archer-balloon="one"] foreignObject div')?.style.color).toBe("rgb(255, 255, 255)");
    const custom = balloonArcherDataSchema.parse({ ...data, backgroundColor: "#101d38", bowColor: "#38bdf8", balloonColor: "#fb7185" });
    await render({ data: custom, decorative: true });
    expect(container.querySelector<HTMLElement>('[aria-label="Balloon progress"]')?.style.color).toBe("rgb(255, 255, 255)");
    expect(container.querySelector('[data-archer-arrow] line')?.getAttribute("stroke")).toBe("#38bdf8");
    expect(container.querySelector('[data-archer-balloon="one"] ellipse')?.getAttribute("fill")).toBe("#fb7185");
  });
  it("supports manual keyboard shooting, reviews, resume, and replay without clearing progress", async () => {
    await render(); await shoot();
    await act(async () => button("Close balloon reveal").dispatchEvent(new MouseEvent("click", { bubbles: true }))); expect(container.textContent).not.toContain(data.balloons[0].content);
    await act(async () => button("Review balloon: Gravity").dispatchEvent(new MouseEvent("click", { bubbles: true }))); expect(container.textContent).toContain(data.balloons[0].content); expect(progress).toHaveBeenCalledOnce();
    await render({ interactedContentIds: new Set(["game:balloon:one"]) }); await act(async () => button("Replay Balloon Archer").dispatchEvent(new MouseEvent("click", { bubbles: true }))); expect(button("Balloon: Gravity")).not.toBeNull();
    await shoot(); expect(progress).toHaveBeenCalledOnce();
  });
  it("supports directional keyboard control and fires only after Enter", async () => {
    await render(); const arrow = button("Grab arrow, pull down and release to shoot");
    for (let index = 0; index < 9; index++) await act(async () => arrow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
    expect(progress).not.toHaveBeenCalled();
    await act(async () => arrow.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))); await advance();
    expect(progress).toHaveBeenCalledExactlyOnceWith("game:balloon:one");
  });
  it("cancels pointer capture, weak pulls, misses, and pending shots on slide exit", async () => {
    await render({ presentation: true });
    const arrow = () => button("Grab arrow, pull down and release to shoot"); const scene = () => container.querySelector("svg[data-archer-scene]")!;
    await pointer(arrow(), "pointerdown", 400, 490); await pointer(scene(), "pointermove", 400, 580); await pointer(scene(), "pointercancel", 400, 580); await advance(); expect(progress).not.toHaveBeenCalled();
    await act(async () => arrow().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))); await advance(); expect(progress).not.toHaveBeenCalled();
    for (let index = 0; index < 9; index++) await act(async () => arrow().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    await act(async () => arrow().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await render({ presentation: true }, false); await advance(); expect(progress).not.toHaveBeenCalled(); expect(container.querySelector('[data-archer-arrow="flying"]')).toBeNull(); expect(frames.size).toBe(0);
  });
  it("lets authors reposition balloons on release or cancel a drag, and preview without learner progress", async () => {
    await render({ authoring: true, editing: true });
    const balloon = () => button("Move balloon: Gravity"), scene = () => container.querySelector("svg[data-archer-scene]")!;
    await pointer(balloon(), "pointerdown", 400, 150); await pointer(scene(), "pointermove", 480, 210); expect(position).not.toHaveBeenCalled();
    await pointer(scene(), "pointerup", 480, 210); expect(position).toHaveBeenCalledExactlyOnceWith("one", { x: 60, y: 35 });
    position.mockClear(); await pointer(balloon(), "pointerdown", 400, 150); await pointer(scene(), "pointermove", 10, 590); await pointer(scene(), "pointercancel", 10, 590); expect(position).not.toHaveBeenCalled();
    await act(async () => button("Preview Balloon Archer").dispatchEvent(new MouseEvent("click", { bubbles: true }))); await shoot(); expect(container.textContent).toContain(data.balloons[0].content); expect(progress).not.toHaveBeenCalled();
  });
  it("drifts balloons without saving positions, and removes aim assistance and the shooting button", async () => {
    await render(); const balloon = () => container.querySelector('[data-archer-balloon="one"] ellipse')!;
    const before = [balloon().getAttribute("cx"), balloon().getAttribute("cy")]; await advance(90);
    expect([balloon().getAttribute("cx"), balloon().getAttribute("cy")]).not.toEqual(before);
    expect(position).not.toHaveBeenCalled(); expect(progress).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Choose balloon to aim at"]')).toBeNull(); expect(container.querySelector('[aria-label="Shoot arrow"]')).toBeNull();
    expect(container.textContent).not.toContain("Aim assistance");
    await act(async () => button("Balloon: Gravity").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(progress).not.toHaveBeenCalled(); expect(container.textContent).not.toContain(data.balloons[0].content);
  });
  it("keeps balloons still while authors arrange them and stops motion when a slide exits", async () => {
    await render({ authoring: true, editing: true }); await advance(90);
    const balloon = container.querySelector('[data-archer-balloon="one"] ellipse')!;
    expect(balloon.getAttribute("cx")).toBe("400"); expect(balloon.getAttribute("cy")).toBe("150");
    await render({ presentation: true }); await advance(10); expect(frames.size).toBeGreaterThan(0);
    await render({ presentation: true }, false); expect(frames.size).toBe(0);
  });
  it("keeps thumbnails still without scheduling background simulation", async () => {
    await render({ presentation: true, authoring: true, decorative: true }); await advance(60);
    expect(frames.size).toBe(0);
    const balloon = container.querySelector('[data-archer-balloon="one"] ellipse')!;
    expect(balloon.getAttribute("cx")).toBe("400"); expect(balloon.getAttribute("cy")).toBe("150");
  });
});
