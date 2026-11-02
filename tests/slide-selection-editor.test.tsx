/** @vitest-environment jsdom */
import { act, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { InteractionPopupEditor } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/interaction-popup-editor";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideObjectClipboardType } from "@/lib/editor/slide-clipboard";
import { useSlideSelection, type SlideSelection } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/use-slide-selection";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial = () => ({ courseId: "slides", ...editorSnapshotSchema.parse({ title: "Selection", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Slide", order: 0, blocks: [
  { id: "one", type: "heading", version: 1, slideFrame: { x: 10, y: 30, width: 20, height: 20, z: 0 }, slideTextLayout: { fitToText: false }, data: { text: "Heading", level: 2 } },
  { id: "two", type: "richText", version: 1, slideFrame: { x: 40, y: 40, width: 20, height: 20, z: 1 }, slideTextLayout: { fitToText: false }, data: { html: "<p>Text</p>" } },
  { id: "three", type: "image", version: 1, slideFrame: { x: 70, y: 50, width: 20, height: 20, z: 2 }, data: { src: "/image.png", alt: "Image" } },
] }] }) });
function pointer(type: string, x: number, y: number, modifiers: MouseEventInit = {}, pointerId = 1) {
  return Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, ...modifiers }), { pointerId });
}

describe("presentation multi-object editing", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>, zoom: number;
  beforeEach(() => {
    vi.useFakeTimers(); zoom = 1;
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) { return new DOMRect(0, 0, this.hasAttribute("data-slide-canvas") || this.hasAttribute("data-slide-objects") ? 960 * zoom : 0, this.hasAttribute("data-slide-canvas") || this.hasAttribute("data-slide-objects") ? 540 * zoom : 0); });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).setPointerCapture; delete (HTMLElement.prototype as unknown as Record<string, unknown>).hasPointerCapture;
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
  });
  const canvas = () => container.querySelector<HTMLElement>("[data-slide-canvas]")!;
  const scope = () => container.querySelector<HTMLElement>('[aria-label="Presentation slide editor"]')!;
  const object = (id: string) => canvas().querySelector<HTMLElement>(`[data-slide-object-id="${id}"]`)!;
  const label = (text: string, within: ParentNode = container) => within.querySelector<HTMLButtonElement>(`[aria-label="${text}"]`)!;
  const clickText = (text: string, within: ParentNode = container) => act(async () => [...within.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const toggle = (id: string, within: ParentNode = container) => act(async () => within.querySelector<HTMLInputElement>(`[data-slide-layer="${id}"] input[type=checkbox]`)!.click());
  const key = (key: string, extra: KeyboardEventInit = {}, target: HTMLElement = scope()) => act(async () => { target.focus(); const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...extra }); target.dispatchEvent(event); return event; });
  const render = (data = initial()) => act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }
  async function drag(element: HTMLElement, dx: number, dy: number, finish = "pointerup") {
    await act(async () => element.dispatchEvent(pointer("pointerdown", 100, 100)));
    await act(async () => element.dispatchEvent(pointer("pointermove", 100 + dx * zoom, 100 + dy * zoom)));
    await act(async () => element.dispatchEvent(finish === "Escape" ? new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }) : pointer(finish, 100 + dx * zoom, 100 + dy * zoom)));
  }

  it("supports modified clicks and layer checkboxes, groups atomically, and restores groups after reload", async () => {
    await render();
    await act(async () => { object("one").dispatchEvent(pointer("pointerdown", 100, 200)); object("one").dispatchEvent(pointer("pointerup", 100, 200)); });
    await act(async () => object("two").dispatchEvent(pointer("pointerdown", 400, 240, { shiftKey: true })));
    expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("2 objects selected");
    await act(async () => object("three").dispatchEvent(pointer("pointerdown", 700, 300, { metaKey: true })));
    expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("3 objects selected");
    await toggle("three"); await key("g", { ctrlKey: true });
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideGroupId).toBeTruthy(); expect(snapshot.lessons[0].blocks[1].slideGroupId).toBe(snapshot.lessons[0].blocks[0].slideGroupId);
    expect(snapshot.lessons[0].blocks[2].slideGroupId).toBeUndefined();
    await act(async () => label("Undo").click()); expect(container.querySelector("[data-slide-layer-group]")).toBeNull();
    await act(async () => label("Redo").click()); expect(container.querySelector("[data-slide-layer-group]")).not.toBeNull();
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await act(async () => object("one").dispatchEvent(pointer("pointerdown", 100, 200)));
    expect(canvas().querySelector("[data-slide-selection]")).not.toBeNull();
    await act(async () => object("one").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("Editing group member");
    await key("Escape", {}, object("one").querySelector<HTMLElement>('[contenteditable="true"]')!); expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("2 objects selected");
  });

  it.each([.5, 1.5])("moves and resizes a group at scale %s with single undo steps and cancellable drafts", async (scale) => {
    zoom = scale; await render(); await toggle("one"); await toggle("two"); await clickText("Group");
    await drag(label("Move selected objects"), 96, 54);
    expect(object("one").style.left).toBe("20%"); expect(object("two").style.left).toBe("50%");
    await drag(label("Move selected objects"), 96, 54, "Escape"); expect(object("one").style.left).toBe("20%");
    await drag(label("Resize selection bottom right"), 48, 16.2);
    expect(Number.parseFloat(object("one").style.width)).toBeCloseTo(22);
    expect(Number.parseFloat(object("two").style.left)).toBeCloseTo(53);
    await act(async () => label("Undo").click()); expect(object("one").style.width).toBe("20%"); expect(object("one").style.left).toBe("20%");
    await act(async () => label("Undo").click()); expect(object("one").style.left).toBe("10%"); expect(object("two").style.left).toBe("40%");
    await act(async () => label("Undo").click()); expect(container.querySelector("[data-slide-layer-group]")).toBeNull();
  });

  it("selects fully enclosed objects with a marquee and preserves native text shortcuts", async () => {
    await render();
    await act(async () => canvas().dispatchEvent(pointer("pointerdown", 90, 150)));
    await act(async () => scope().dispatchEvent(pointer("pointermove", 600, 330)));
    expect(canvas().querySelector("[data-slide-marquee]")).not.toBeNull();
    await act(async () => scope().dispatchEvent(pointer("pointerup", 600, 330)));
    expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("2 objects selected");
    await key("Escape");
    const text = object("one").querySelector<HTMLElement>('[contenteditable="true"]')!;
    await key("a", { ctrlKey: true }, text);
    expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("1 object selected");
    const title = canvas().querySelector<HTMLInputElement>('[aria-label="Slide title"]')!;
    const event = await key("a", { ctrlKey: true }, title); expect(event.defaultPrevented).toBe(false);
    await key("a", { ctrlKey: true }); expect(container.querySelector('[aria-label="Selection tools"]')?.textContent).toContain("3 objects selected");
  });

  it("discards bulk drafts on pointer cancellation or lost capture without adding undo entries", async () => {
    await render(); await toggle("one"); await toggle("two"); await clickText("Group");
    for (const event of ["pointercancel", "lostpointercapture"]) {
      await drag(label("Move selected objects"), 96, 54, event);
      expect(object("one").style.left).toBe("10%"); expect(object("two").style.left).toBe("40%");
    }
    await act(async () => label("Undo").click()); expect(container.querySelector("[data-slide-layer-group]")).toBeNull();
  });

  it("locks and hides groups only in authoring and keeps learner objects intact", async () => {
    await render(); await toggle("one"); await toggle("two"); await clickText("Group");
    const group = () => container.querySelector<HTMLElement>("[data-slide-layer-group]")!;
    await act(async () => group().querySelector<HTMLButtonElement>('[aria-label^="Lock group"]')!.click());
    expect(object("one").hasAttribute("data-slide-object-locked")).toBe(true);
    await act(async () => group().querySelector<HTMLButtonElement>('[aria-label^="Select group"]')!.click());
    expect(label("Move selected objects")).toBeNull();
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Delete selection")?.disabled).toBe(true);
    await act(async () => group().querySelector<HTMLButtonElement>('[aria-label^="Hide group"]')!.click());
    expect(object("one")).toBeNull(); expect(object("two")).toBeNull();
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks.slice(0, 2).every((block) => block.slideLocked && block.slideHiddenInEditor)).toBe(true);
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone persistLocalProgress={false} />));
    expect(container.querySelector('[data-slide-active="true"]')?.textContent).toContain("Heading");
    expect(container.querySelector('[data-slide-active="true"]')?.textContent).toContain("Text");
  });

  it("aligns and spaces the selected units through the shared controls with atomic undo", async () => {
    const data = initial(); data.lessons[0].blocks[1].slideFrame!.x = 35;
    await render(data); await toggle("one"); await toggle("two"); await toggle("three");
    await clickText("Space horizontally"); expect(object("two").style.left).toBe("40%");
    await act(async () => label("Undo").click()); expect(object("two").style.left).toBe("35%");
    await act(async () => { const field = container.querySelector<HTMLSelectElement>('[aria-label="Selection alignment target"]')!; field.value = "canvas"; field.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => label("Align selection bottom").click());
    for (const id of ["one", "two", "three"]) expect(object(id).style.top).toBe("80%");
    await act(async () => label("Undo").click()); expect(object("one").style.top).toBe("30%"); expect(object("two").style.top).toBe("40%");
  });

  it("copies multiple grouped objects and repeatedly pastes independently with atomic undo", async () => {
    await render(); await toggle("one"); await toggle("two"); await clickText("Group");
    const payload = new Map<string, string>(), clipboardData = { setData: (type: string, value: string) => payload.set(type, value), getData: (type: string) => payload.get(type) ?? "" };
    function clipboard(type: string) { return Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clipboardData }); }
    await act(async () => document.body.dispatchEvent(clipboard("copy")));
    expect(JSON.parse(payload.get(slideObjectClipboardType)!).version).toBe(2);
    await act(async () => { document.body.dispatchEvent(clipboard("paste")); document.body.dispatchEvent(clipboard("paste")); });
    expect(canvas().querySelectorAll("[data-slide-object-id]")).toHaveLength(7);
    const snapshot = await saved(), groups = snapshot.lessons[0].blocks.flatMap((block) => block.slideGroupId ? [block.slideGroupId] : []);
    expect(new Set(groups).size).toBe(3);
    await act(async () => label("Undo").click()); expect(canvas().querySelectorAll("[data-slide-object-id]")).toHaveLength(5);
    await act(async () => label("Undo").click()); expect(canvas().querySelectorAll("[data-slide-object-id]")).toHaveLength(3);
  });

  it("applies popup groups once and cancels later popup changes without editing the parent", async () => {
    const data = initial(), nested = blockSchema.parse({ id: "popup", version: 1, type: "interactionButton", data: { popup: { blocks: data.lessons[0].blocks.slice(0, 2) } } });
    data.lessons[0].blocks = [nested]; await render(data);
    await act(async () => label("Select interactionButton object from layers").click()); await clickText("Edit popup mini slide (2 objects)");
    const dialog = () => [...container.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1)!;
    await toggle("two", dialog()); await clickText("Group", dialog());
    expect(dialog().querySelector("[data-slide-layer-group]")).not.toBeNull();
    await clickText("Apply popup", dialog());
    const snapshot = await saved(), parent = snapshot.lessons[0].blocks[0];
    if (parent.type !== "interactionButton") throw new Error("Expected popup");
    expect(parent.data.popup.blocks[0].slideGroupId).toBe(parent.data.popup.blocks[1].slideGroupId);
    await clickText("Edit popup mini slide (2 objects)"); await clickText("Delete selection", dialog()); await clickText("Cancel", dialog());
    await act(async () => label("Undo").click());
    const restored = await saved();
    const restoredParent = restored.lessons[0].blocks[0];
    if (restoredParent.type !== "interactionButton") throw new Error("Expected popup");
    expect(restoredParent.data.popup.blocks.map((block) => block.slideGroupId)).toEqual([undefined, undefined]);
  });

  it("rejects oversized popup duplication as a whole", async () => {
    const blocks = Array.from({ length: 19 }, (_, index) => ({ ...initial().lessons[0].blocks[0], id: `item-${index}` }));
    const parent = blockSchema.parse({ id: "popup", version: 1, type: "interactionButton", data: { popup: { blocks } } });
    if (parent.type !== "interactionButton") throw new Error("Expected popup");
    const apply = vi.fn(), close = vi.fn();
    await act(async () => root.render(<InteractionPopupEditor popup={parent.data.popup} courseId="slides" sections={[]} lessons={[]} onApply={apply} onClose={close} />));
    await toggle("item-1"); await clickText("Duplicate selection");
    expect(container.textContent).toContain("up to 20 objects"); expect(canvas().querySelectorAll("[data-slide-object-id]")).toHaveLength(19);
    expect(apply).not.toHaveBeenCalled(); await clickText("Cancel"); expect(close).toHaveBeenCalledOnce();
  });

  it("rejects main-slide overflow and mixed cover pastes before changing any blocks", async () => {
    let api!: SlideSelection;
    const commit = vi.fn(), source = initial().lessons[0].blocks;
    function Fixture({ blocks, cover = false }: { blocks: typeof source; cover?: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      api = useSlideSelection({ blocks, cover, area: { width: 960, height: 540 }, scopeRef: ref, onBlocksChange: commit });
      return <div ref={ref} />;
    }
    const full = Array.from({ length: 499 }, (_, index) => ({ ...source[0], id: `block-${index}` }));
    await act(async () => root.render(<Fixture blocks={full} />));
    expect(() => api.paste(source.slice(0, 2))).toThrow("500 objects"); expect(commit).not.toHaveBeenCalled();
    await act(async () => root.render(<Fixture blocks={[]} cover />));
    const audio = blockSchema.parse({ id: "audio", version: 1, type: "audioInstruction", data: { src: "" } });
    expect(() => api.paste([audio, source[0]])).toThrow("only audio instruction"); expect(commit).not.toHaveBeenCalled();
  });
});
