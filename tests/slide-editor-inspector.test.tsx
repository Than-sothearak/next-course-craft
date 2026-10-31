/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const heading = { id: "heading", version: 1, type: "heading", data: { text: "Keep this content", level: 2 } };
const first = { id: "first", sectionId: "section", title: "Content", order: 0, blocks: [heading] };
const makeData = (lessons: unknown[] = [first]) => ({ courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons }) });

describe("presentation inspector tabs", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const tab = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === label)!;
  const panel = (label: string) => document.getElementById(tab(label).getAttribute("aria-controls")!) as HTMLDivElement;
  const clickTab = (label: string) => act(async () => tab(label).click());
  const click = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }

  it("shows pixel geometry with two decimal places and preserves precision in other saved fields", async () => {
    const frame = { x: 11.23456, y: 8.76543, width: 65.4321, height: 24.56789, z: 0 };
    await act(async () => root.render(<EditorClient initialData={makeData([{ ...first, blocks: [{ ...heading, slideFrame: frame }] }])} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]')!.click());
    const inputs = [...panel("Object block").querySelectorAll<HTMLInputElement>('input[type="number"]:not([aria-label="Object border radius"])')];
    expect(inputs.map((input) => input.value)).toEqual(["107.85", "32.26", "628.15", "90.41"]);
    expect(inputs.every((input) => input.step === "0.01")).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(inputs[0], "120.25");
      inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    });
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideFrame).toEqual({ ...frame, x: 120.25 / 960 * 100 });
  });

  it("keeps canvas pixels independent of zoom and converts vertical size edits back to saved geometry", async () => {
    const frame = { x: 10, y: 10, width: 50, height: 50, z: 0 };
    await act(async () => root.render(<EditorClient initialData={makeData([{ ...first, blocks: [{ ...heading, slideFrame: frame }] }])} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]')!.click());
    const inputs = () => [...container.querySelectorAll<HTMLInputElement>('[aria-label="Object position and size"] input')];
    for (const zoom of ["50", "150"]) {
      const select = container.querySelector<HTMLSelectElement>('[aria-label="Canvas zoom"]')!;
      await act(async () => { select.value = zoom; select.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(inputs().map((input) => input.value)).toEqual(["96", "36.8", "480", "184"]);
    }
    for (const [label, value] of [["Top (px)", "73.6"], ["Height (px)", "110.4"]]) {
      const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideFrame).toMatchObject({ x: 10, width: 50, z: 0 });
    expect(snapshot.lessons[0].blocks[0].slideFrame?.y).toBeCloseTo(20, 10);
    expect(snapshot.lessons[0].blocks[0].slideFrame?.height).toBeCloseTo(30, 10);
  });

  it("displays and accepts two decimal places for media scale", async () => {
    const source = "/diagram.png";
    const block = { id: "image", version: 1, type: "image", data: { src: source, alt: "Diagram" }, slideMedia: { source, width: 1920, height: 1080 }, slideFrame: { x: 11, y: 8, width: 22.461111, height: 40, z: 0 } };
    await act(async () => root.render(<EditorClient initialData={makeData([{ ...first, blocks: [block] }])} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select image object from layers"]')!.click());
    const scale = container.querySelector<HTMLInputElement>('[aria-label="Media scale"]')!;
    expect(scale.value).toBe("11.23");
    expect(scale.step).toBe("0.01");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(scale, "12.34");
      scale.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0].slideFrame?.width).toBeCloseTo(24.68, 8);
  });

  it("applies square corners to every block across slides with one undoable bulk change", async () => {
    const image = { id: "other", version: 1, type: "image", data: { src: "/diagram.png", alt: "Diagram" } };
    const data = makeData([first, { ...first, id: "second", order: 1, blocks: [image] }]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]')!.click());
    const radius = container.querySelector<HTMLInputElement>('[aria-label="Object border radius"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(radius, "0");
      radius.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Apply radius to all blocks");
    const snapshot = await saved();
    expect(snapshot.lessons.every((lesson) => lesson.blocks.every((block) => block.slideBorderRadius === 0))).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.borderRadius).toBe("0px");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
    expect(container.querySelector<HTMLElement>('[data-slide-thumbnail="second"] [data-slide-thumbnail-object-id="other"]')?.style.borderRadius).toBe("12px");
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.borderRadius).toBe("0px");
  });

  it("switches settings panels and opens Object block when selecting a canvas object", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData()} authorName="Author" />));
    expect(panel("Object block").hidden).toBe(false); expect(panel("Master slide").hidden).toBe(true);
    await clickTab("Master slide"); expect(panel("Master slide").hidden).toBe(false); expect(panel("Object block").hidden).toBe(true);
    await act(async () => container.querySelector('[data-slide-object-id="heading"]')!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    expect(panel("Object block").hidden).toBe(false); expect(panel("Master slide").hidden).toBe(true);
    expect(container.querySelector('[aria-label="Delete object"]')).not.toBeNull();
    await clickTab("Master slide"); await clickTab("Object block");
    expect(container.querySelector('[aria-label="Delete object"]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("supports arrow, Home, and End keyboard navigation with one tab stop", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData()} authorName="Author" />));
    const key = (label: string, value: string) => act(async () => tab(label).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
    await key("Object block", "ArrowRight"); expect(document.activeElement).toBe(tab("Cover page")); expect(panel("Cover page").hidden).toBe(false);
    await key("Cover page", "ArrowRight"); expect(document.activeElement).toBe(tab("Master slide"));
    await key("Master slide", "End"); expect(document.activeElement).toBe(tab("Cover page"));
    await key("Cover page", "Home"); expect(document.activeElement).toBe(tab("Master slide"));
    expect(container.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  });

  it("sets progress requirements per object with saving, undo/redo, and reload", async () => {
    const data = makeData([{ ...first, blocks: [heading, { id: "question", version: 1, type: "knowledgeCheck", data: { question: "Ready?", options: ["Yes", "No"] } }] }]);
    data.navigationMode = "restricted";
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const toggle = () => container.querySelector<HTMLInputElement>('[role="switch"][aria-label="Required for progress"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select knowledgeCheck object from layers"]')!.click());
    expect(toggle().checked).toBe(true);
    await act(async () => toggle().click()); expect(toggle().checked).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]')!.click()); expect(toggle().checked).toBe(true);
    await act(async () => toggle().click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click()); expect(toggle().checked).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!.click()); expect(toggle().checked).toBe(false);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks.map((block) => block.requiredForProgress)).toEqual([false, false]);
    await act(async () => root.render(<EditorClient key="requirements-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select knowledgeCheck object from layers"]')!.click()); expect(toggle().checked).toBe(false);
  });

  it("starts all tabs collapsed and retains individual or grouped changes without saving", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData()} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]')!.click());
    const collapse = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
    const sections = (label: string) => [...panel(label).querySelectorAll<HTMLElement>('[data-inspector-section-content]')];
    const position = container.querySelector<HTMLButtonElement>('[aria-label="Toggle Position & size settings"]')!;
    expect(position.getAttribute("aria-expanded")).toBe("false");
    expect(sections("Object block").every((section) => section.hidden)).toBe(true);
    expect(sections("Master slide").every((section) => section.hidden)).toBe(true);
    expect(sections("Cover page").every((section) => section.hidden)).toBe(true);
    expect(position.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    await collapse("Toggle Position & size settings");
    expect(document.getElementById(position.getAttribute("aria-controls")!)?.hidden).toBe(false);
    await collapse("Hide all Object block settings");
    expect(sections("Object block").every((section) => section.hidden)).toBe(true);
    await clickTab("Master slide");
    expect(sections("Master slide").every((section) => section.hidden)).toBe(true);
    await collapse("Toggle Header settings");
    expect(sections("Master slide").filter((section) => !section.hidden)).toHaveLength(1);
    await clickTab("Cover page"); await collapse("Hide all Cover page settings");
    expect(sections("Cover page").every((section) => section.hidden)).toBe(true);
    await clickTab("Object block");
    expect(sections("Object block").every((section) => section.hidden)).toBe(true);
    await collapse("Show all Object block settings");
    expect(sections("Object block").every((section) => !section.hidden)).toBe(true);
    await clickTab("Master slide"); expect(sections("Master slide").filter((section) => !section.hidden)).toHaveLength(1);
    await clickTab("Object block"); expect(sections("Object block").every((section) => !section.hidden)).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Width (px)"]')?.value).toBe("748.8");
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.render(<EditorClient key="reset-inspector" initialData={makeData()} authorName="Author" />));
    expect(container.querySelectorAll('[data-inspector-section-content]:not([hidden])')).toHaveLength(0);
  });

  it("adds a cover from its tab and preserves existing slide objects", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData()} authorName="Author" />));
    await clickTab("Cover page"); await click("Add cover page");
    expect(panel("Cover page").hidden).toBe(false);
    expect(container.querySelector('[aria-label="Cover slide content settings"]')).not.toBeNull();
    const snapshot = await saved();
    expect(snapshot.lessons).toHaveLength(2);
    expect(snapshot.lessons.find((lesson) => lesson.id === "first")?.blocks[0]).toMatchObject(heading);
    expect(snapshot.lessons.filter((lesson) => lesson.slideCover)).toHaveLength(1);
  });

  it("opens an existing cover without replacing its content or adding another slide", async () => {
    const data = makeData([{ id: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", subtitle: "Keep the cover" } }, { ...first, order: 1 }]);
    await act(async () => root.render(<EditorClient initialData={data} focusedLessonId="first" authorName="Author" />));
    await clickTab("Cover page"); await click("Edit cover page");
    expect(panel("Cover page").hidden).toBe(false);
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Cover slide content settings"] textarea')?.value).toBe("Keep the cover");
    expect(container.querySelectorAll('[data-slide-thumbnail]')).toHaveLength(2);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects an empty first slide when adding a cover from a later slide", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData([{ ...first, blocks: [] }, { ...first, id: "later", order: 1 }])} focusedLessonId="later" authorName="Author" />));
    await clickTab("Cover page"); await click("Add cover page");
    expect(container.querySelector('[aria-label="Cover slide content settings"]')).not.toBeNull();
    const snapshot = await saved();
    expect(snapshot.lessons).toHaveLength(2); expect(snapshot.lessons[0].slideCover).toBeDefined();
    expect(snapshot.lessons[1].blocks[0]).toMatchObject(heading);
  });

  it("provides the same tabs on quizzes and adds a separate cover before an empty quiz", async () => {
    await act(async () => root.render(<EditorClient initialData={makeData([{ ...first, lessonType: "quiz", blocks: [] }])} authorName="Author" />));
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    await clickTab("Master slide"); expect(panel("Master slide").querySelector('[aria-label="Master slide settings"]')).not.toBeNull();
    await clickTab("Cover page"); await click("Add cover page");
    const snapshot = await saved();
    expect(snapshot.lessons).toHaveLength(2);
    expect(snapshot.lessons.find((lesson) => lesson.id === "first")).toMatchObject({ lessonType: "quiz", quizQuestions: [] });
  });
});
