/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { audioInstructionGuideSchema } from "@/lib/editor/audio-instruction-guide";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const frame = { x: 35, y: 80, width: 30, height: 12, z: 0 };
const data = (cover = false) => ({ courseId: "guides", ...editorSnapshotSchema.parse({ title: "Guides", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Slide", order: 0, ...(cover ? { slideCover: { template: "imageCover" } } : {}), blocks: [{ id: "audio", version: 1, type: "audioInstruction", slideFrame: frame, data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", fileName: "Narration.mp3" } }] }] }) });

describe("audio instruction guide authoring", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>; let play: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? new DOMRect(20, 40, 480, 270) : new DOMRect(0, 0, 0, 0); });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const click = (label: string) => act(async () => button(label).click());
  const popup = () => container.querySelector<HTMLElement>("[data-audio-guide-popup]")!;
  const point = () => button("Move audio guide point");
  async function input(label: string, value: string) {
    const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
    await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: 1 }); return event;
  }
  async function drag(label: string, dx: number, dy: number, cancel = false) {
    const handle = button(label);
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 100 + dx, 100 + dy)));
    await act(async () => handle.dispatchEvent(pointer(cancel ? "pointercancel" : "pointerup", 100 + dx, 100 + dy)));
  }
  async function start(cover = false) {
    await act(async () => root.render(<EditorClient initialData={data(cover)} authorName="Author" />));
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((item) => item.textContent === "Object block")!.click());
    await click("Select audioInstruction object from layers");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Audio instruction guide popup"]')!.click());
  }
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body));
  }

  it.each([false, true])("drags the point in canvas coordinates at 50%% zoom, supports undo, and saves on content or cover slides (cover=%s)", async (cover) => {
    await start(cover); expect(play).not.toHaveBeenCalled();
    await input("Audio guide title", "Focus on this step"); await input("Audio guide explanation", "Read this point while listening to the audio.");
    const zoom = container.querySelector<HTMLSelectElement>('[aria-label="Canvas zoom"]')!;
    await act(async () => { zoom.value = "50"; zoom.dispatchEvent(new Event("change", { bubbles: true })); });
    const handle = point();
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 148, 127)));
    expect(point().style.left).toBe("55%"); expect(point().style.top).toBe("60%");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => handle.dispatchEvent(pointer("pointerup", 148, 127)));
    await click("Undo"); expect(point().style.left).toBe("45%"); expect(point().style.top).toBe("50%");
    await click("Redo"); expect(point().style.left).toBe("55%");
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideFrame: frame, data: { guide: { enabled: true, title: "Focus on this step", text: "Read this point while listening to the audio.", point: { x: 55, y: 60 }, popup: { x: 55, y: 28, width: 36, height: 34 } } } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "guides" }} authorName="Author" />));
    await click("Select audioInstruction object from layers");
    expect(point().style.left).toBe("55%"); expect(popup().textContent).toContain("Read this point while listening to the audio.");
    expect(popup().closest('[data-slide-object-id="audio"]')).toBeNull();
  });

  it("moves and resizes the popup independently, clamps it to the canvas, and cancels unfinished drags", async () => {
    await start();
    await drag("Move audio guide popup", 24, 13.5); expect(popup().style.left).toBe("60%"); expect(popup().style.top).toBe("33%"); expect(point().style.left).toBe("45%");
    await drag("Move audio guide popup", -100, 50, true); expect(popup().style.left).toBe("60%"); expect(popup().style.top).toBe("33%");
    await drag("Resize audio guide popup", 480, 270); expect(popup().style.width).toBe("40%"); expect(popup().style.height).toBe("67%");
    await click("Undo"); expect(popup().style.width).toBe("36%"); expect(popup().style.height).toBe("34%"); await click("Redo");
    const snapshot = await saved(), instruction = snapshot.lessons[0].blocks[0];
    if (instruction.type !== "audioInstruction") throw new Error("Wrong type");
    expect(instruction.slideFrame).toEqual(frame); expect(audioInstructionGuideSchema.safeParse(instruction.data.guide).success).toBe(true);
    expect(instruction.data.guide?.popup).toEqual({ x: 60, y: 33, width: 40, height: 67 });
  });

  it("supports keyboard positioning, keeps settings when disabled, and retains the guide on duplication", async () => {
    await start();
    await act(async () => point().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true, cancelable: true }))); expect(point().style.left).toBe("50%");
    await input("Audio guide popup left", "40"); expect(popup().style.left).toBe("40%");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Audio instruction guide popup"]')!.click()); expect(container.querySelector("[data-audio-guide]")).toBeNull();
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Audio instruction guide popup"]')!.click()); expect(point().style.left).toBe("50%"); expect(popup().style.left).toBe("40%");
    await click("Duplicate object");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks).toHaveLength(2);
    snapshot.lessons[0].blocks.forEach((block) => expect(block).toMatchObject({ data: { guide: { enabled: true, point: { x: 50, y: 50 }, popup: { x: 40 } } } }));
  });

  it("configures guide timing, animation and delay with preview, undo, saving and reload", async () => {
    await start();
    const field = (label: string) => container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
    const choose = (label: string, value: string) => act(async () => { field(label).value = value; field(label).dispatchEvent(new Event("change", { bubbles: true })); });
    expect(field("Audio guide timing").value).toBe("with"); expect(field("Audio guide animation").value).toBe("slide-up");
    await choose("Audio guide timing", "after"); await choose("Audio guide animation", "zoom");
    await input("Audio guide animation duration", "700"); await input("Audio guide popup delay", "5000");
    const animate = vi.fn(() => ({ cancel: vi.fn() })); Object.defineProperty(popup(), "animate", { configurable: true, value: animate });
    await click("Preview audio guide animation");
    expect(animate.mock.calls[0]).toEqual([[{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 5000, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]);
    expect(play).not.toHaveBeenCalled();
    await choose("Audio guide timing", "before"); await click("Undo"); expect(field("Audio guide timing").value).toBe("after"); await click("Redo");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { guide: { timing: "before", animation: { effect: "zoom", duration: 700, delay: 5000 } } } });
    await act(async () => root.render(<EditorClient key="timing-reload" initialData={{ ...snapshot, courseId: "guides" }} authorName="Author" />));
    await click("Select audioInstruction object from layers");
    expect(field("Audio guide timing").value).toBe("before"); expect(field("Audio guide animation").value).toBe("zoom");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Audio guide popup delay"]')?.value).toBe("5000");
    await choose("Audio guide animation", "none"); expect(button("Preview audio guide animation").disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Audio guide animation duration"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Audio guide popup delay"]')?.disabled).toBe(false);
  });
});
