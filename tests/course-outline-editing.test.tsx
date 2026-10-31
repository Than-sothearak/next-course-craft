/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "../app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "../lib/editor/schemas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn(), forward: vi.fn() }) }));
vi.mock("../app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1,
  sections: [{ id: "a", title: "Pre Activities", order: 0 }, { id: "b", title: "Learn", order: 1 }, { id: "c", title: "Post Activities", order: 2 }],
  lessons: [{ id: "lesson", sectionId: "a", title: "Introduction", order: 0, blocks: [{ id: "block", version: 1, type: "richText", data: { html: "<p>Original content</p>" } }] }, { id: "destination", sectionId: "b", title: "Existing lesson", order: 0, blocks: [] }],
}) };

describe("course outline editing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  const sourceMenu = () => container.querySelector('[aria-label="Content actions for Introduction"]')!.closest("details")!;

  it("duplicates and saves content without routing away from the course outline", async () => {
    await render();
    const menu = sourceMenu();
    menu.open = true;
    const duplicate = Array.from(menu.querySelectorAll("button")).find((button) => button.textContent === "Duplicate content")!;
    await act(async () => duplicate.click());
    expect(menu.open).toBe(false);
    expect(container.querySelector('[aria-label="Content actions for Introduction copy"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Course title"]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    const snapshot = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(editorSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const copy = snapshot.lessons.find((lesson: { title: string }) => lesson.title === "Introduction copy");
    expect(copy.sectionId).toBe("a");
    expect(copy.id).not.toBe("lesson");
    expect(copy.blocks[0].id).not.toBe("block");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(push).not.toHaveBeenCalled();
  });

  it("moves content to another section and saves the updated order without routing", async () => {
    await render();
    const menu = sourceMenu();
    menu.open = true;
    const select = menu.querySelector<HTMLSelectElement>('[aria-label="Move Introduction to section"]')!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "b", "c"]);
    await act(async () => { select.value = "b"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const movedMenu = sourceMenu();
    expect(movedMenu.closest("section")?.querySelector<HTMLInputElement>('[aria-label="Section title"]')?.value).toBe("Learn");
    expect(movedMenu.closest("section")?.textContent).toContain("Existing lesson");
    const snapshot = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(editorSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.lessons.find((lesson: { id: string }) => lesson.id === "lesson")).toMatchObject({ sectionId: "b", order: 1, blocks: initialData.lessons[0].blocks });
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Course title"]')).not.toBeNull();
  });

  it("uses the available width for the standard lesson editor", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} focusedLessonId="lesson" authorName="Author" />));
    const canvas = container.querySelector<HTMLElement>('section[aria-label="Lesson canvas"] > div')!;
    expect(canvas.classList.contains("w-full")).toBe(true);
    expect(canvas.classList.contains("max-w-none")).toBe(true);
    expect(canvas.className).not.toContain("max-w-5xl");
  });

  it("opens the standard course preview at its overview from a lesson", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} focusedLessonId="lesson" authorName="Author" />));
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Preview")!.click());
    expect(push).toHaveBeenCalledWith("/courses/course/preview");
  });

  it("keeps presentation preview focused on the active slide", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Preview")!.click());
    expect(push).toHaveBeenCalledWith("/courses/slides/preview?lessonId=first");
  });

  it("opens a slide course with a thumbnail panel and adds and selects slides in place", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    expect(container.querySelector('[aria-label="Presentation slide editor"]')).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Slide thumbnails"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Edit slide 1: Slide 1"]')?.getAttribute("aria-current")).toBe("step");
    expect(container.querySelector('[data-slide-canvas] [aria-label="Slide navigation"]')).not.toBeNull();
    expect(container.querySelector("details summary")?.textContent).not.toContain("Course outline");
    expect(container.querySelector<HTMLElement>('[data-slide-canvas]')?.parentElement?.style.aspectRatio).toBe("960 / 540");
    expect(container.querySelector('[aria-label="Select slide"]')).toBeNull();
    expect(container.querySelector('[aria-label="Slide actions"]')).toBeNull();
    const addSlide = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide thumbnails"] button')].find((button) => button.textContent?.includes("Add slide"))!;
    await act(async () => addSlide.click());
    expect(container.querySelectorAll('[aria-label="Slide thumbnails"] button[aria-label^="Edit slide "]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Edit slide 2: Slide 2"]')?.getAttribute("aria-current")).toBe("step");
    expect(container.querySelectorAll('[aria-label="Slide thumbnails"] button[aria-label^="Delete slide "]')).toHaveLength(2);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit slide 1: Slide 1"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("Slide 1");
    expect(container.querySelector('[aria-label="Edit slide 1: Slide 1"]')?.getAttribute("aria-current")).toBe("step");
    expect(push).not.toHaveBeenCalled();
  });

  it("selects and deletes slides in place, saves their order, and can add after deleting the last slide", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: ["first", "middle", "last"].map((id, order) => ({ id, sectionId: "section", title: id, order, blocks: [] })),
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} focusedLessonId="first" authorName="Author" />));
    const remove = (title: string) => container.querySelector<HTMLButtonElement>(`[aria-label^="Delete slide "][aria-label$=": ${title}"]`)!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit slide 2: middle"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("middle");
    await act(async () => remove("middle").click());
    expect(container.querySelector('[aria-label="Edit slide 2: last"]')?.getAttribute("aria-current")).toBe("step");
    expect(editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).lessons.map(({ id, order }) => ({ id, order }))).toEqual([{ id: "first", order: 0 }, { id: "last", order: 1 }]);
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Preview")!.click());
    expect(push).toHaveBeenLastCalledWith("/courses/slides/preview?lessonId=last");
    push.mockClear();
    await act(async () => remove("last").click());
    expect(container.querySelector('[aria-label="Edit slide 1: first"]')?.getAttribute("aria-current")).toBe("step");
    await act(async () => remove("first").click());
    expect(container.querySelectorAll('[aria-label^="Edit slide "]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-label^="Delete slide "]')).toHaveLength(0);
    expect(container.textContent).toContain("Your presentation has no slides");
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).lessons).toEqual([]);
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide thumbnails"] button')].find((button) => button.textContent?.includes("Add slide"))!.click());
    expect(container.querySelectorAll('[aria-label^="Edit slide "]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label^="Delete slide "]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Presentation slide editor"]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("can undo deletion of the last slide from the presentation overview", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete slide 1: Introduction"]')!.click());
    expect(container.textContent).toContain("Your presentation has no slides");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
    expect(container.querySelector('[aria-label="Edit slide 1: Introduction"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit slide 1: Introduction"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("Introduction");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).lessons.map((lesson: { id: string }) => lesson.id)).toEqual(["first"]);
  });

  it("deletes an inactive slide without changing the selected slide", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: ["first", "middle", "last"].map((id, order) => ({ id, sectionId: "section", title: id, order, blocks: [] })),
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const remove = container.querySelector<HTMLButtonElement>('[aria-label="Delete slide 2: middle"]')!;
    expect(remove.parentElement?.tagName).not.toBe("BUTTON");
    await act(async () => remove.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("first");
    expect(container.querySelector('[aria-label="Edit slide 1: first"]')?.getAttribute("aria-current")).toBe("step");
    expect(container.querySelector('[aria-label="Edit slide 2: last"]')?.getAttribute("aria-current")).toBeNull();
    expect(editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).lessons.map(({ id, order }) => ({ id, order }))).toEqual([{ id: "first", order: 0 }, { id: "last", order: 1 }]);
    expect(push).not.toHaveBeenCalled();
  });

  it("adds and positions a slide object using slide templates", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const heading = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide object templates"] button')].find((button) => button.textContent?.includes("Heading"))!;
    await act(async () => heading.click());
    const object = container.querySelector<HTMLElement>('[data-slide-object-id]')!;
    expect(object).not.toBeNull();
    await act(async () => object.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const width = container.querySelector<HTMLInputElement>('aside[aria-label="Slide inspector"] [aria-label="Width (px)"]')!;
    expect(width).not.toBeNull();
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "480"); width.dispatchEvent(new Event("input", { bubbles: true })); width.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const latest = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body ?? "{}");
    expect(latest.lessons?.[0]?.blocks?.[0]?.slideFrame?.width).toBe(50);
    const midnight = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Presentation themes"] button')].find((button) => button.textContent?.includes("Midnight"))!;
    await act(async () => midnight.click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const themed = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body ?? "{}");
    expect(themed.slideMaster?.template).toBe("midnight");
    expect(container.querySelector<HTMLElement>('[data-slide-canvas] > div')?.style.background).toContain("rgb(15, 23, 42)");
    expect(push).not.toHaveBeenCalled();
  });

  it("saves abstract and uploaded master backgrounds and restores the image settings", async () => {
    const imageSrc = "/api/assets/123456789012345678901234/file";
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets: [{ id: "123456789012345678901234", originalName: "Background.png", contentType: "image/png", size: 3000, fileUrl: imageSrc, createdAt: "2026-01-01" }] } : { revision: 2 } }));
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const chooseStyle = async (value: string) => act(async () => { const input = container.querySelector<HTMLSelectElement>('[aria-label="Master background style"]')!; input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await chooseStyle("abstract");
    const designs = container.querySelectorAll<HTMLButtonElement>('[aria-label="Free abstract backgrounds"] button');
    expect(designs).toHaveLength(6);
    await act(async () => [...designs].find((button) => button.textContent?.includes("Orbits"))!.click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).slideMaster.background).toEqual({ type: "abstract", design: "orbits" });
    expect(container.querySelector('[data-slide-canvas] [data-abstract-design="orbits"]')).not.toBeNull();
    await chooseStyle("image");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Choose or upload background image"))!.click());
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/slides/assets", { cache: "no-store" });
    expect(container.querySelector<HTMLInputElement>('[aria-label="Upload image"]')?.accept).toContain("image/png");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Use Background.png"]')!.click());
    await act(async () => { const position = container.querySelector<HTMLSelectElement>('[aria-label="Master background image position"]')!; position.value = "bottom"; position.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { const overlay = container.querySelector<HTMLInputElement>('[aria-label="Master background image overlay"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(overlay, "60"); overlay.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const saved = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body));
    expect(saved.slideMaster?.background).toEqual({ type: "image", imageSrc, imagePosition: "bottom", overlayOpacity: 60 });
    expect(container.querySelector<HTMLImageElement>('[data-slide-canvas] [data-slide-master-background="image"] img')?.getAttribute("src")).toBe(imageSrc);
    await act(async () => root.render(<EditorClient key="reloaded" initialData={{ ...saved, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Master background style"]')?.value).toBe("image");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Master background image position"]')?.value).toBe("bottom");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Master background image overlay"]')?.value).toBe("60");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Remove background image")!.click());
    expect(container.querySelector('[data-slide-canvas] [data-slide-master-background="image"]')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["video", "audio"] as const)("saves and restores presentation playback settings for %s", async (type) => {
    const mediaFrame = { x: 11, y: 8, width: 78, height: 24, z: 0 };
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Media", order: 0, blocks: [{ id: "media", version: 1, type, slideFrame: mediaFrame, data: { src: "/api/assets/123456789012345678901234/file", mimeType: type === "video" ? "video/webm" : "audio/webm", fileName: "Narration" } }] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const select = () => container.querySelector<HTMLButtonElement>(`[aria-label="Select ${type} object from layers"]`)!;
    await act(async () => select().click());
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Autoplay media"]')!.click());
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Show media player controls"]')!.click());
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Align to footer")!.click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const saved = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.at(-1)![1].body));
    expect(saved.lessons[0].blocks[0]).toMatchObject({ slidePlayback: { autoPlay: true, showControls: false }, slideFrame: { ...mediaFrame, y: 76 } });
    await act(async () => root.render(<EditorClient key="restored" initialData={{ ...saved, courseId: "slides" }} authorName="Author" />));
    await act(async () => select().click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Autoplay media"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Show media player controls"]')?.checked).toBe(false);
  });

  it("drags a slide object within the canvas and saves its position", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Drag me", level: 1 }, slideFrame: { x: 11, y: 8, width: 78, height: 24, z: 0 } }] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const objects = container.querySelector<HTMLElement>("[data-slide-objects]")!;
    vi.spyOn(objects, "getBoundingClientRect").mockReturnValue({ width: 960, height: 388 } as DOMRect);
    const handle = container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')!;
    handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = vi.fn(() => false);
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(event, "pointerId", { value: 1 });
      return event;
    };
    await act(async () => { handle.dispatchEvent(pointer("pointerdown", 0, 0)); handle.dispatchEvent(pointer("pointermove", 96, 0)); handle.dispatchEvent(pointer("pointerup", 96, 0)); });
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.left).toBe("21%");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const latest = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body ?? "{}");
    expect(latest.lessons?.[0]?.blocks?.[0]?.slideFrame?.x).toBe(21);
    const resize = container.querySelector<HTMLButtonElement>('[aria-label="Resize heading object"]')!;
    resize.setPointerCapture = vi.fn(); resize.hasPointerCapture = vi.fn(() => false);
    await act(async () => { resize.dispatchEvent(pointer("pointerdown", 0, 0)); resize.dispatchEvent(pointer("pointermove", 96, 0)); resize.dispatchEvent(pointer("pointerup", 96, 0)); });
    expect(container.querySelector<HTMLElement>('[data-slide-object-id="heading"]')?.style.width).toBe("79%");
  });

  it("offers a cover preset without deleting existing first-slide content", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Intro", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Keep me", level: 1 } }] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Image cover slide")!.click());
    expect(container.querySelector('[aria-label="Cover slide content settings"]')).not.toBeNull();
    const subtitle = container.querySelector<HTMLTextAreaElement>('[aria-label="Cover slide content settings"] textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(subtitle, "Welcome"); subtitle.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const latest = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body ?? "{}");
    expect(latest.lessons).toHaveLength(2);
    expect(latest.lessons.find((lesson: { id: string }) => lesson.id === "first").blocks[0].data.text).toBe("Keep me");
    expect(latest.lessons.find((lesson: { slideCover?: unknown }) => lesson.slideCover)?.slideCover?.template).toBe("imageCover");
  });

  it("raises an object selected from layers without changing its saved position", async () => {
    const frame = { x: 11, y: 8, width: 78, height: 24 };
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Intro", order: 0, blocks: [
        { id: "back", version: 1, type: "heading", data: { text: "Back", level: 1 }, slideFrame: { ...frame, z: 0 } },
        { id: "front", version: 1, type: "heading", data: { text: "Front", level: 1 }, slideFrame: { ...frame, z: 1 } },
      ] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const back = container.querySelector<HTMLElement>('[data-slide-object-id="back"]')!;
    const front = container.querySelector<HTMLElement>('[data-slide-object-id="front"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Select heading object from layers"]:last-child')!.click());
    expect(Number(back.style.zIndex)).toBeGreaterThan(Number(front.style.zIndex));
    expect(back.style.left).toBe("11%");
    expect(back.style.top).toBe("8%");
  });

  it("shows a direct file picker as soon as a slide media object is added", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    fetchMock.mockImplementation(async (url: string) => url.endsWith("/assets") ? Response.json({ assets: [] }) : Response.json({ revision: 2 }));
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    const add = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide object templates"] button')].find((button) => button.textContent?.trim() === name)!.click();
    for (const [name, label, accept] of [["Image", "Choose or upload image", "image/png"], ["Video", "Choose or upload video", "video/mp4"], ["Audio", "Choose or upload audio", ".mp3"], ["File", "Choose or upload file", "*/*"], ["Gallery", "Add gallery image", "image/png"], ["Interactive image", "Choose or upload image", "image/png"]]) {
      await act(async () => add(name));
      const choose = [...container.querySelectorAll<HTMLButtonElement>('aside[aria-label="Slide inspector"] button')].find((button) => button.textContent?.trim() === label)!;
      expect(choose, label).toBeDefined();
      await act(async () => choose.click());
      expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.accept).toContain(accept);
      act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close media library"]')!.click());
    }
  });

  it("shows interactive block content controls in the slide inspector", async () => {
    const slideData = { courseId: "slides", ...editorSnapshotSchema.parse({
      title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }],
    }) };
    await act(async () => root.render(<EditorClient initialData={slideData} authorName="Author" />));
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide object templates"] button')].find((button) => button.textContent?.trim() === "Flip cards")!.click());
    const inspector = container.querySelector('aside[aria-label="Slide inspector"]')!;
    expect(inspector.querySelector('[aria-label="Cards per row"]')).not.toBeNull();
    expect([...inspector.querySelectorAll("button")].some((button) => button.textContent?.includes("Change block style"))).toBe(true);
  });
});
