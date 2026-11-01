/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { serializeSlideObject, slideObjectClipboardType } from "@/lib/editor/slide-clipboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const area = { width: 960, height: 540 };
const frame = { x: 17, y: 23, width: 44, height: 31, rotation: 37, z: 2 };
const presentation = () => ({ courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" },
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "source", sectionId: "section", title: "Source", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", slideFrame: frame, slideTextLayout: { fitToText: false }, slideBackground: { color: "#dbeafe", opacity: 40 }, slideAnimation: { effect: "zoom", duration: 700, delay: 200 }, data: { text: "Copy me", html: "<h2><strong>Copy me</strong></h2>", level: 2 } }] },
    { id: "destination", sectionId: "section", title: "Destination", order: 1, blocks: [{ id: "existing", version: 1, type: "richText", slideFrame: { ...frame, z: 20 }, slideTextLayout: { fitToText: false }, data: { html: "<p>Existing content</p>" } }] },
    { id: "cover", sectionId: "section", title: "Cover", order: 2, blocks: [], slideCover: { template: "imageCover" } },
  ],
}) });

function clipboard(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getData: (type: string) => data.get(type) ?? "", setData: (type: string, value: string) => { data.set(type, value); }, clearData: () => data.clear(), get types() { return [...data.keys()]; } };
}
function event(type: "copy" | "paste", data: ReturnType<typeof clipboard>) {
  const value = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(value, "clipboardData", { value: data });
  return value;
}

describe("native presentation object copy and paste", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); window.getSelection()?.removeAllRanges();
    for (const key of ["showModal", "close"]) delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[key];
    for (const key of ["getClientRects", "getBoundingClientRect"]) delete (Range.prototype as unknown as Record<string, unknown>)[key];
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const canvas = () => container.querySelector<HTMLElement>("[data-slide-canvas]")!;
  const objects = () => [...canvas().querySelectorAll<HTMLElement>("[data-slide-object-id]")];
  const render = (data = presentation()) => act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
  async function copySelected() {
    await act(async () => button("Select heading object from layers").click());
    const data = clipboard(), copy = event("copy", data);
    await act(async () => objects()[0].dispatchEvent(copy));
    expect(copy.defaultPrevented).toBe(true);
    expect(data.getData(slideObjectClipboardType)).toBe(data.getData("text/plain"));
    return data;
  }
  async function paste(data: ReturnType<typeof clipboard>, target: EventTarget = document.body) {
    const value = event("paste", data);
    await act(async () => target.dispatchEvent(value));
    return value;
  }
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }

  it("copies without editing the course and repeatedly pastes at the exact position with independent IDs and undo steps", async () => {
    await render(); const data = await copySelected();
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { document.body.dispatchEvent(event("paste", data)); document.body.dispatchEvent(event("paste", data)); });
    expect(objects()).toHaveLength(3);
    expect(new Set(objects().map((object) => object.dataset.slideObjectId)).size).toBe(3);
    for (const object of objects()) {
      expect(object.style.left).toBe("17%"); expect(object.style.top).toBe("23%");
      expect(object.style.width).toBe("44%"); expect(object.style.height).toBe("31%"); expect(object.style.rotate).toBe("37deg");
    }
    expect(objects()[2].querySelectorAll("[data-slide-resize-handle]")).toHaveLength(8);
    const snapshot = await saved(), blocks = snapshot.lessons[0].blocks;
    expect(blocks.map((block) => block.slideFrame?.z)).toEqual([2, 3, 4]);
    blocks.slice(1).forEach((block) => expect(block).toEqual({ ...blocks[0], id: block.id, slideFrame: { ...frame, z: block.slideFrame!.z } }));
    await act(async () => button("Undo").click()); expect(objects()).toHaveLength(2);
    await act(async () => button("Undo").click()); expect(objects()).toHaveLength(1);
    await act(async () => button("Redo").click()); expect(objects()).toHaveLength(2);
    await act(async () => button("Redo").click()); expect(objects()).toHaveLength(3);
  });

  it("pastes on another slide and preserves content, styles, placement and rotation after saving and reloading", async () => {
    const initial = presentation(); await render(initial); const data = await copySelected();
    await act(async () => button("Edit slide 2: Destination").click());
    expect((await paste(data)).defaultPrevented).toBe(true);
    const snapshot = await saved(), pasted = snapshot.lessons[1].blocks[1];
    expect(snapshot.lessons[0].blocks).toEqual(initial.lessons[0].blocks);
    expect(pasted).toEqual({ ...initial.lessons[0].blocks[0], id: pasted.id, slideFrame: { ...frame, z: 21 } });
    expect(container.querySelector<HTMLElement>(`[data-slide-thumbnail-object-id="${pasted.id}"]`)?.style.rotate).toBe("37deg");
    await act(async () => button("Undo").click()); expect(objects()).toHaveLength(1);
    await act(async () => button("Redo").click()); expect(objects()).toHaveLength(2);
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} focusedLessonId="destination" authorName="Author" />));
    expect(objects()).toHaveLength(2); expect(objects()[1].style.left).toBe("17%");
    await act(async () => root.render(<CoursePreview key="standalone" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="destination" standalone persistLocalProgress={false} />));
    const exported = container.querySelector<HTMLElement>(`[data-slide-object-id="${pasted.id}"]`)!;
    expect(exported.style.left).toBe("17%"); expect(exported.style.rotate).toBe("37deg");
    expect((await paste(data)).defaultPrevented).toBe(false);
  });

  it("supports browsers that preserve only the plain text clipboard payload", async () => {
    await render(); const copied = await copySelected();
    expect((await paste(clipboard({ "text/plain": copied.getData("text/plain") }))).defaultPrevented).toBe(true);
    expect(objects()).toHaveLength(2);
  });

  it("leaves inputs, textareas and editable text to their native copy and paste handlers", async () => {
    await render(); const data = await copySelected();
    for (const tag of ["input", "textarea", "div"]) {
      const target = document.createElement(tag);
      if (tag === "div") target.setAttribute("contenteditable", "true");
      canvas().append(target);
      const copied = clipboard(), copy = event("copy", copied);
      await act(async () => { target.focus(); target.dispatchEvent(copy); });
      expect(copy.defaultPrevented).toBe(false); expect(copied.types).toEqual([]);
      expect((await paste(data, target)).defaultPrevented).toBe(false);
      expect(objects()).toHaveLength(1); target.remove();
    }
    expect((await paste(clipboard({ "text/plain": "Ordinary text" }))).defaultPrevented).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves copying a browser text selection and does nothing without a selected object", async () => {
    await render(); await copySelected();
    const paragraph = document.createElement("p"); paragraph.textContent = "Selected browser text"; canvas().append(paragraph);
    const range = document.createRange(); range.selectNodeContents(paragraph); window.getSelection()!.addRange(range);
    const copy = event("copy", clipboard());
    await act(async () => paragraph.dispatchEvent(copy)); expect(copy.defaultPrevented).toBe(false);
    window.getSelection()!.removeAllRanges(); paragraph.remove();
    const background = canvas().querySelector<HTMLElement>("[data-slide-objects] > div")!;
    await act(async () => background.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    const noSelection = event("copy", clipboard());
    await act(async () => document.body.dispatchEvent(noSelection)); expect(noSelection.defaultPrevented).toBe(false);
  });

  it("rejects foreign-course and malformed object data without changing the slide", async () => {
    const initial = presentation(); await render(initial);
    const foreign = serializeSlideObject("another-course", initial.lessons[0].blocks[0], 0, 1, area);
    expect((await paste(clipboard({ "text/plain": foreign }))).defaultPrevented).toBe(true);
    expect(container.textContent).toContain("Copy an object from this course");
    const invalid = JSON.parse(serializeSlideObject("slides", initial.lessons[0].blocks[0], 0, 1, area)); invalid.version = 2;
    await paste(clipboard({ "text/plain": JSON.stringify(invalid) }));
    expect(container.textContent).toContain("This copied object is invalid"); expect(objects()).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps cover restrictions and permits copying an audio instruction onto a cover", async () => {
    await render(); const data = await copySelected();
    await act(async () => button("Edit slide 3: Cover").click()); await paste(data);
    expect(objects()).toHaveLength(0); expect(container.textContent).toContain("A cover slide can contain only audio instruction objects");
    const instruction = blockSchema.parse({ id: "instruction", type: "audioInstruction", version: 1, slideFrame: frame, data: { src: "" } });
    await paste(clipboard({ "text/plain": serializeSlideObject("slides", instruction, 0, 1, area) }));
    expect(objects()).toHaveLength(1);
    expect((await saved()).lessons[2].blocks[0]).toMatchObject({ type: "audioInstruction", slideFrame: { ...frame, z: 0 } });
  });

  it("pastes once into the topmost popup editor and commits the copied object only when applying", async () => {
    const initial = presentation();
    initial.lessons[0].blocks.push(blockSchema.parse({ id: "popup", version: 1, type: "interactionButton", slideFrame: frame, data: { popup: { blocks: [{ id: "popup-text", version: 1, type: "richText", data: { html: "<p>Popup text</p>" } }] } } }));
    await render(initial); const data = await copySelected();
    await act(async () => button("Select interactionButton object from layers").click());
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Edit popup mini slide (1 objects)")!.click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog[open]")!;
    await paste(data, dialog);
    expect(dialog.querySelectorAll("[data-slide-object-id]")).toHaveLength(2); expect(objects()).toHaveLength(2);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => [...dialog.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Apply popup")!.click());
    const block = (await saved()).lessons[0].blocks[1];
    expect(block).toMatchObject({ data: { popup: { blocks: [{ id: "popup-text" }, { type: "heading", slideFrame: { ...frame, z: 1 } }] } } });
  });
});
