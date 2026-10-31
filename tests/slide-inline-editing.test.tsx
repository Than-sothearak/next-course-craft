/** @vitest-environment jsdom */
import type { Editor } from "@tiptap/core";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { resolveSlideSize } from "@/lib/editor/slide-design";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const frame = { x: 11, y: 8, width: 78, height: 55, z: 2 };
function presentation(blocks: unknown[]) {
  return { courseId: "slides", ...editorSnapshotSchema.parse({
    title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" },
    sections: [{ id: "section", title: "Slides", order: 0 }],
    lessons: [{ id: "slide", sectionId: "section", title: "Slide 1", order: 0, blocks }],
  }) };
}
function textBlock(type: "heading" | "richText", id = type) {
  return {
    id, version: 1, type, slideFrame: frame, blockPadding: 40, backgroundColor: "#fff7ed",
    data: type === "heading" ? { text: "Original content", level: 2 } : { html: "<p>Original content</p>" },
  };
}
function pointer(type: string, x: number, y = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

describe("inline slide text editing", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    // JSDOM has no text layout; TipTap measures the selection when toolbar commands restore focus.
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
    delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  function canvasEditor(id: string, label?: string) {
    const selector = label ? `[contenteditable="true"][aria-label="${label}"]` : '[contenteditable="true"]';
    const element = container.querySelector<HTMLElement & { editor: Editor }>(`[data-slide-object-id="${id}"] ${selector}`)!;
    expect(element).not.toBeNull();
    return { element, editor: element.editor };
  }
  function formatButton(label: string) {
    return container.querySelector<HTMLButtonElement>(`[aria-label="Slide text formatting"] button[aria-label="${label}"]`)!;
  }
  async function savedSnapshot() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }

  it("renders presentation lists with the same spacing and markers in editor and preview", async () => {
    const html = '<ol data-list-style="upper-roman" data-item-spacing="spacious"><li><p>First step</p></li><li><p>Second step</p></li></ol>';
    const data = presentation([{ id: "list", version: 1, type: "richText", slideFrame: frame, data: { html } }]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const editorText = container.querySelector<HTMLElement>('[data-slide-object-id="list"] .lesson-rich-text')!;
    expect(editorText.className).toContain("[&_.tiptap_p]:my-2");
    const editorList = editorText.querySelector("ol")!;
    expect(editorList.getAttribute("data-list-style")).toBe("upper-roman");
    expect(editorList.getAttribute("data-item-spacing")).toBe("spacious");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={data} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      const previewText = container.querySelector<HTMLElement>('[data-slide-object-id="list"] .lesson-rich-text')!;
      expect(previewText.className).toContain("[&_.tiptap_p]:my-2");
      expect(previewText.className).not.toContain("[&_.tiptap_p]:my-0");
      const previewList = previewText.querySelector("ol")!;
      expect(previewList.getAttribute("data-list-style")).toBe(editorList.getAttribute("data-list-style"));
      expect(previewList.getAttribute("data-item-spacing")).toBe(editorList.getAttribute("data-item-spacing"));
      expect([...previewList.querySelectorAll("li")].map((item) => item.textContent)).toEqual(["First step", "Second step"]);
    }
  });

  it.each(["heading", "richText"] as const)("edits and formats a %s object, then retains content and geometry after save and reload", async (type) => {
    const data = presentation([textBlock(type)]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const { element, editor } = canvasEditor(type);
    act(() => {
      element.focus();
      editor.view.dispatch(editor.state.tr.insertText("Edited on canvas", 1, 17));
      editor.commands.setTextSelection({ from: 1, to: 7 });
    });
    expect(container.querySelector('[aria-label="Slide text formatting"] [role="toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-slide-canvas] [role="toolbar"]')).toBeNull();
    expect(container.querySelector('aside[aria-label="Slide inspector"] [contenteditable="true"]')).toBeNull();
    await act(async () => formatButton("Bold").click());
    const fontSize = container.querySelector<HTMLSelectElement>('[aria-label="Slide text formatting"] [aria-label="Font size preset"]')!;
    await act(async () => { fontSize.value = "32px"; fontSize.dispatchEvent(new Event("change", { bubbles: true })); });
    const colorPicker = container.querySelector('[aria-label="Slide text formatting"] [aria-label="Text color"]')!.closest("details")!;
    colorPicker.open = true;
    await act(async () => formatButton("Text color #2563eb").click());
    const snapshot = await savedSnapshot();
    const block = snapshot.lessons[0].blocks[0];
    if (block.type !== "heading" && block.type !== "richText") throw new Error("Expected text object");
    expect(block.slideFrame).toEqual(frame);
    expect(block.blockPadding).toBe(40);
    expect(block.backgroundColor).toBe("#fff7ed");
    const html = new DOMParser().parseFromString(block.data.html!, "text/html");
    expect(html.querySelector("strong")?.textContent).toBe("Edited");
    expect(html.querySelector<HTMLElement>("span")?.style.fontSize).toBe("32px");
    expect(html.querySelector<HTMLElement>("span")?.style.color).toBe("rgb(37, 99, 235)");
    expect(html.body.textContent).toBe("Edited on canvas");
    if (block.type === "heading") expect(block.data.text).toBe("Edited on canvas");

    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(canvasEditor(type).element.textContent).toBe("Edited on canvas");
    expect(canvasEditor(type).element.querySelector("strong")?.textContent).toBe("Edited");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      const preview = container.querySelector<HTMLElement>(`[data-slide-object-id="${type}"]`)!;
      expect(preview.textContent).toBe("Edited on canvas");
      expect(preview.querySelector("strong")?.textContent).toBe("Edited");
      expect(preview.querySelector<HTMLElement>("span")?.style.fontSize).toBe("32px");
      expect(preview.querySelector<HTMLElement>("span")?.style.color).toBe("rgb(37, 99, 235)");
    }
  });

  it("selects text without moving its object, then moves it with the dedicated handle", async () => {
    await act(async () => root.render(<EditorClient initialData={presentation([textBlock("richText")])} authorName="Author" />));
    const objects = container.querySelector<HTMLElement>("[data-slide-objects]")!;
    vi.spyOn(objects, "getBoundingClientRect").mockReturnValue({ width: 960, height: 388 } as DOMRect);
    const object = container.querySelector<HTMLElement>('[data-slide-object-id="richText"]')!;
    object.setPointerCapture = vi.fn();
    const { element } = canvasEditor("richText");
    await act(async () => {
      expect(element.dispatchEvent(pointer("pointerdown", 0))).toBe(true);
      element.dispatchEvent(pointer("pointermove", 96));
      element.dispatchEvent(pointer("pointerup", 96));
    });
    expect(object.setPointerCapture).not.toHaveBeenCalled();
    expect(object.style.left).toBe("11%");
    expect(fetchMock).not.toHaveBeenCalled();

    const handle = container.querySelector<HTMLButtonElement>('[aria-label="Move richText object"]')!;
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn(() => false);
    await act(async () => {
      handle.dispatchEvent(pointer("pointerdown", 0));
      handle.dispatchEvent(pointer("pointermove", 96));
      handle.dispatchEvent(pointer("pointerup", 96));
    });
    expect(object.style.left).toBe("21%");
    expect((await savedSnapshot()).lessons[0].blocks[0].slideFrame).toEqual({ ...frame, x: 21 });
  });

  it("applies gradient text through the inspector and retains it after reload and export", async () => {
    await act(async () => root.render(<EditorClient initialData={presentation([textBlock("heading")])} authorName="Author" />));
    const { element, editor } = canvasEditor("heading");
    act(() => { element.focus(); editor.commands.setTextSelection({ from: 1, to: 9 }); });
    const palette = container.querySelector('[aria-label="Slide text formatting"] [aria-label="Text color"]')!.closest("details")!;
    palette.open = true;
    await act(async () => [...palette.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Color wheel")!.click());
    await act(async () => palette.querySelector<HTMLButtonElement>('[aria-label="Choose text color gradient"]')!.click());
    await act(async () => [...palette.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Apply color")!.click());
    const snapshot = await savedSnapshot();
    const block = snapshot.lessons[0].blocks[0];
    if (block.type !== "heading") throw new Error("Expected heading");
    expect(block.data.html).toContain("data-text-gradient"); expect(block.data.html).toContain("linear-gradient");
    await act(async () => root.render(<EditorClient key="gradient-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(canvasEditor("heading").editor.getHTML()).toContain("linear-gradient");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"] [data-text-gradient]')?.style.backgroundImage).toContain("linear-gradient");
    }
  });

  it("formats the focused statement field and switches toolbar targets between objects", async () => {
    const data = presentation([
      { id: "statement", version: 1, type: "statement", slideFrame: frame, data: { style: "tip", title: "Statement title", body: "Statement body" } },
      textBlock("richText"),
    ]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const title = canvasEditor("statement", "Statement title");
    act(() => { title.element.focus(); title.editor.commands.selectAll(); });
    await act(async () => formatButton("Bold").click());
    const body = canvasEditor("statement", "Statement text");
    act(() => { body.element.focus(); body.editor.commands.selectAll(); });
    await act(async () => formatButton("Italic").click());
    const text = canvasEditor("richText");
    act(() => { text.element.focus(); text.editor.commands.selectAll(); });
    await act(async () => formatButton("Underline").click());
    const snapshot = await savedSnapshot();
    const [statement, richText] = snapshot.lessons[0].blocks;
    expect(statement).toMatchObject({ data: { title: "Statement title", body: "Statement body" } });
    if (statement.type !== "statement" || richText.type !== "richText") throw new Error("Unexpected objects");
    expect(statement.data.titleHtml).toContain("<strong>");
    expect(statement.data.titleHtml).not.toContain("<em>");
    expect(statement.data.bodyHtml).toContain("<em>");
    expect(statement.data.bodyHtml).not.toContain("<strong>");
    expect(richText.data.html).toContain("<u>");
    expect(richText.data.html).not.toContain("<strong>");
    expect(richText.data.html).not.toContain("<em>");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete object"]')!.click());
    expect(container.querySelector('[aria-label="Slide text formatting"]')).toBeNull();
    expect(container.querySelector('[data-slide-object-id="richText"]')).toBeNull();
  });

  it.each([
    textBlock("heading"),
    textBlock("richText"),
    { id: "statement", version: 1, type: "statement", slideFrame: frame, data: { style: "tip", title: "Key idea", body: "Remember this" } },
    { id: "image", version: 1, type: "image", slideFrame: frame, data: { src: "/example.png", alt: "Example" } },
    { id: "divider", version: 1, type: "divider", slideFrame: frame, data: { style: "line" } },
  ])("changes the $type background and retains it through saving, reloading, and learner rendering", async (input) => {
    const data = presentation([input]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const selector = `[data-slide-object-id="${input.id}"]`;
    const object = container.querySelector<HTMLElement>(selector)!;
    expect(object.style.backgroundColor).toBe("transparent");
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Select ${input.type} object from layers"]`)!.click());
    expect(container.querySelector('[aria-label="Object background"] button[aria-pressed="true"]')?.textContent).toBe("Transparent");
    const color = container.querySelector<HTMLInputElement>('[aria-label="Object background color"]')!;
    const opacity = container.querySelector<HTMLInputElement>('[aria-label="Object background opacity"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(color, "#2563eb");
      color.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(object.style.backgroundColor).toBe("rgb(37, 99, 235)");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(opacity, "40");
      opacity.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(object.style.backgroundColor).toBe("rgba(37, 99, 235, 0.4)");
    expect(object.style.opacity).toBe("");
    const snapshot = await savedSnapshot();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({
      data: data.lessons[0].blocks[0].data, slideFrame: frame, slideBackground: { color: "#2563eb", opacity: 40 },
    });
    await act(async () => root.render(<EditorClient key="background-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector<HTMLElement>(selector)?.style.backgroundColor).toBe("rgba(37, 99, 235, 0.4)");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      const preview = container.querySelector<HTMLElement>(selector)!;
      expect(preview.style.backgroundColor).toBe("rgba(37, 99, 235, 0.4)");
      expect(preview.style.opacity).toBe("");
      expect([...preview.querySelectorAll<HTMLElement>("[style]")].filter((element) => element.style.backgroundColor === "rgba(37, 99, 235, 0.4)")).toHaveLength(0);
      expect(preview.querySelector<HTMLElement>(".w-full")?.style.backgroundColor).toBe("transparent");
    }
  });

  it("updates only the selected object's fill and preserves its color when switching transparency", async () => {
    const data = presentation([textBlock("heading"), { ...textBlock("richText"), slideBackground: { color: "#2563eb", opacity: 40 } }]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select richText object from layers"]')!.click());
    const backgroundButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Object background"] button')].find((button) => button.textContent === label)!;
    await act(async () => backgroundButton("Transparent").click());
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="richText"]')?.style.backgroundColor).toBe("transparent");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Object background color"]')?.value).toBe("#2563eb");
    await act(async () => backgroundButton("Color").click());
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="richText"]')?.style.backgroundColor).toBe("rgb(37, 99, 235)");
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.backgroundColor).toBe("transparent");
    await act(async () => backgroundButton("Transparent").click());
    const snapshot = await savedSnapshot();
    expect(snapshot.lessons[0].blocks[1].slideBackground).toEqual({ color: "#2563eb", opacity: 0 });
    expect(snapshot.lessons[0].blocks[0].slideBackground).toBeUndefined();
  });

  it.each([
    textBlock("heading"), textBlock("richText"),
    { id: "statement", version: 1, type: "statement", slideFrame: frame, data: { style: "tip", title: "Heading", body: "Body" } },
  ])("positions $type text in the center of its box and retains alignment after saving", async (input) => {
    await act(async () => root.render(<EditorClient initialData={presentation([input])} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Select ${input.type} object from layers"]`)!.click());
    const horizontal = container.querySelector<HTMLSelectElement>('[aria-label="Text box horizontal alignment"]')!;
    const vertical = container.querySelector<HTMLSelectElement>('[aria-label="Text box vertical alignment"]')!;
    const horizontalPadding = container.querySelector<HTMLInputElement>('[aria-label="Text box horizontal padding"]')!;
    const verticalPadding = container.querySelector<HTMLInputElement>('[aria-label="Text box vertical padding"]')!;
    const fitToText = container.querySelector<HTMLInputElement>('[aria-label="Fit text box to content"]')!;
    const box = container.querySelector<HTMLElement>("[data-slide-text-box]")!;
    expect(box.style.paddingLeft).toBe("0px");
    expect(box.style.paddingTop).toBe("0px");
    expect(horizontalPadding.value).toBe("0");
    expect(verticalPadding.value).toBe("0");
    if (input.type === "statement") expect(box.querySelector<HTMLElement>(".border-l-4")?.style.padding).toBe("0px");
    expect(fitToText.checked).toBe(true);
    await act(async () => {
      horizontal.value = "center"; horizontal.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      vertical.value = "middle"; vertical.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(horizontalPadding, "28");
      horizontalPadding.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(verticalPadding, "20");
      verticalPadding.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(box.style.paddingLeft).toBe("28px");
    expect(box.style.paddingTop).toBe("20px");
    expect(box.style.justifyContent).toBe("center");
    expect(box.style.textAlign).toBe("center");
    const snapshot = await savedSnapshot();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slideFrame: frame, slideTextLayout: { horizontal: "center", vertical: "middle", paddingX: 28, paddingY: 20, fitToText: true } });
    await act(async () => root.render(<EditorClient key="alignment-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector<HTMLElement>("[data-slide-text-box]")?.style.justifyContent).toBe("center");
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      const preview = container.querySelector<HTMLElement>("[data-slide-text-box]")!;
      expect(preview.style.justifyContent).toBe("center");
      expect(preview.style.textAlign).toBe("center");
      expect(preview.style.paddingLeft).toBe("28px");
      expect(preview.style.paddingTop).toBe("20px");
      if (input.type === "statement") expect(preview.querySelector<HTMLElement>(".border-l-4")?.style.padding).toBe("0px");
      expect(preview.closest('[data-lesson-block-id]')?.classList.contains("h-full")).toBe(true);
    }
  });

  it.each(["image", "video"] as const)("detects intrinsic %s dimensions and scales proportionally using a handle and size fields", async (type) => {
    const mediaSource = type === "image" ? "/portrait.png" : "/portrait.mp4";
    const data = presentation([{ id: type, version: 1, type, slideFrame: frame, data: type === "image" ? { src: mediaSource, alt: "Portrait" } : { src: mediaSource, mimeType: "video/mp4" } }]);
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    const object = container.querySelector<HTMLElement>(`[data-slide-object-id="${type}"]`)!;
    const media = object.querySelector<HTMLImageElement | HTMLVideoElement>(type === "image" ? "img" : "video")!;
    Object.defineProperty(media, type === "image" ? "naturalWidth" : "videoWidth", { configurable: true, value: 1080 });
    Object.defineProperty(media, type === "image" ? "naturalHeight" : "videoHeight", { configurable: true, value: 1920 });
    await act(async () => media.dispatchEvent(new Event(type === "image" ? "load" : "loadedmetadata", { bubbles: true })));
    const area = resolveSlideSize();
    const ratio = () => Number.parseFloat(object.style.width) * area.width / (Number.parseFloat(object.style.height) * area.height);
    expect(ratio()).toBeCloseTo(1080 / 1920, 8);
    expect(media.classList.contains("object-contain")).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Select ${type} object from layers"]`)!.click());
    const width = container.querySelector<HTMLInputElement>('aside[aria-label="Slide inspector"] [aria-label="Width (px)"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "96");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(Number.parseFloat(object.style.width)).toBeCloseTo(10);
    expect(ratio()).toBeCloseTo(1080 / 1920, 8);
    const objects = container.querySelector<HTMLElement>("[data-slide-objects]")!;
    vi.spyOn(objects, "getBoundingClientRect").mockReturnValue({ width: 960, height: area.height } as DOMRect);
    const resize = container.querySelector<HTMLButtonElement>(`[aria-label="Resize ${type} object"]`)!;
    resize.setPointerCapture = vi.fn(); resize.hasPointerCapture = vi.fn(() => false);
    await act(async () => {
      resize.dispatchEvent(pointer("pointerdown", 0)); resize.dispatchEvent(pointer("pointermove", 24, 10)); resize.dispatchEvent(pointer("pointerup", 24, 10));
    });
    expect(Number.parseFloat(object.style.width)).toBeGreaterThan(10);
    expect(ratio()).toBeCloseTo(1080 / 1920, 8);
    const scale = container.querySelector<HTMLInputElement>('[aria-label="Media scale"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(scale, "10");
      scale.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(Number.parseFloat(object.style.width) * area.width / 100).toBeCloseTo(108);
    const snapshot = await savedSnapshot();
    expect(snapshot.lessons[0].blocks[0].slideMedia).toEqual({ source: mediaSource, width: 1080, height: 1920 });
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      const preview = container.querySelector<HTMLElement>(`[data-slide-object-id="${type}"]`)!;
      expect(Number.parseFloat(preview.style.width) * area.width / (Number.parseFloat(preview.style.height) * area.height)).toBeCloseTo(1080 / 1920, 8);
      expect(preview.querySelector(type === "image" ? "img" : "video")?.classList.contains("object-contain")).toBe(true);
    }
  });
});
