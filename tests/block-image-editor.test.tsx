/** @vitest-environment jsdom */
import { act, useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StandardLessonEditor } from "@/app/courses/[courseId]/edit/standard-mode/_components/standard-lesson-editor";
import { useEditorDraft, type Draft } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-draft";
import { useEditorBlockOperations } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-block-operations";
import { blockSchema, richTextBlockSchema } from "@/lib/schemas/block";
import { DefaultImageModelContext } from "@/components/image-model-select";

vi.mock("@/app/courses/[courseId]/edit/standard-mode/_components/lesson-title-editor", () => ({ LessonTitleEditor: () => null }));
vi.mock("@/app/courses/[courseId]/edit/standard-mode/_components/sortable-item", () => ({ SortableItem: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor", () => ({ ContentBlockEditor: () => null }));
vi.mock("@/app/courses/[courseId]/edit/_components/(editor_client_components)/block-format-menu", () => ({ BlockFormatMenu: () => null }));

const source = richTextBlockSchema.parse({ id: "source", version: 1, type: "richText", data: { html: "<p>Current block content</p>" } });
const next = blockSchema.parse({ id: "next", version: 1, type: "heading", data: { text: "Next topic", level: 2 } });
const media = { src: `/api/assets/${"a".repeat(24)}/file`, fileName: "generated.webp", mimeType: "image/webp" as const, size: 150_000 };
let root: Root, container: HTMLDivElement;
let editor: ReturnType<typeof useEditorDraft>;
let operations: ReturnType<typeof useEditorBlockOperations>;
let fetchMock: ReturnType<typeof vi.fn>;
let startingBlocks = [source, next];

function Harness() {
  const initialDraft: Draft = { title: "Course", description: "", authorVisible: true,
    theme: { preset: "ocean", primaryColor: "#2f5f9f", accentColor: "#ff876c", fontFamily: "sans" }, navigationMode: "free",
    sections: [{ id: "section", title: "Section", order: 0 }],
    lessons: [{ id: "lesson", sectionId: "section", title: "Lesson", order: 0, lessonType: "content", quizQuestions: [], blocks: startingBlocks }],
  };
  const titleValidRef = useRef(true);
  const currentEditor = useEditorDraft({ initialDraft, initialRevision: 1, courseId: "course", titleValid: true, titleValidRef, onNavigate: vi.fn() });
  const lesson = currentEditor.draft.lessons[0];
  const currentOperations = useEditorBlockOperations({ draft: currentEditor.draft, draftRef: currentEditor.draftRef, activeLesson: lesson, activeLessonId: lesson.id, slideCourse: false,
    updateDraft: currentEditor.updateDraft,
    updateLesson: (id, update) => currentEditor.updateDraft((current) => ({ ...current, lessons: current.lessons.map((item) => item.id === id ? update(item) : item) })),
  });
  useEffect(() => { editor = currentEditor; operations = currentOperations; });
  return <DefaultImageModelContext.Provider value="gpt-image-2.6-flare"><StandardLessonEditor lesson={lesson} courseId="course" sections={currentEditor.draft.sections} lessons={currentEditor.draft.lessons}
    saveState={currentEditor.saveState} hasUnsavedChanges={currentEditor.hasUnsavedChanges} saveMessage="" onRetrySave={vi.fn()} onTitleChange={vi.fn()} onTitleValidityChange={vi.fn()}
    onReorderBlocks={currentOperations.reorderBlocks} onAddBlock={vi.fn()} onMoveBlock={currentOperations.moveBlock} onDuplicateBlock={currentOperations.duplicateBlock}
    onDeleteBlock={currentOperations.deleteBlock} onChangeBlock={currentOperations.updateBlock} onReplaceTemplate={vi.fn()}
    onAddGeneratedImage={(id, image) => currentOperations.addGeneratedBlockImage(lesson.id, id, image)} /></DefaultImageModelContext.Provider>;
}

const dialogButton = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find((button) => button.textContent === text)!;
const open = () => act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Generate image for block"]')!.click());
const click = (text: string) => act(async () => dialogButton(text).click());

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  startingBlocks = [source, next];
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ media }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
});

describe("Standard block image action", () => {
  it("uses the environment default, sends a selected model and clears the preview when it changes", async () => {
    await act(async () => root.render(<Harness />));
    await open();
    const dialog = document.querySelector("dialog")!;
    const model = dialog.querySelector<HTMLSelectElement>('[aria-label="Image generation model"]')!;
    expect(model.value).toBe("");
    expect(model.selectedOptions[0].textContent).toBe("Default (gpt-image-2.6-flare)");
    expect([...model.options].some((option) => option.value === "gpt-image-1-mini")).toBe(true);
    await act(async () => { model.value = "gpt-image-1-mini"; model.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("Generate image");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).imageModel).toBe("gpt-image-1-mini");
    expect(dialog.querySelector("img")).not.toBeNull();
    await act(async () => { model.value = ""; model.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(dialog.querySelector("img")).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ media }), { status: 201 }));
    await click("Generate image");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("imageModel");
  });
  it("opens beside Move block up, uses draft content, inserts below and supports undo/redo/save", async () => {
    await act(async () => root.render(<Harness />));
    const generate = container.querySelector('[aria-label="Generate image for block"]')!;
    expect(generate.nextElementSibling?.getAttribute("aria-label")).toBe("Move block up");
    act(() => operations.updateBlock(source.id, { ...source, data: { html: "<p>Updated content</p>" } }));
    await open(); await click("Generate image");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/courses/course/process-step-image");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ source: "block", title: "", instructions: "Updated content", customPrompt: "" });
    expect(editor.draft.lessons[0].blocks).toHaveLength(2);
    expect(document.querySelector("dialog img")?.getAttribute("src")).toBe(media.src);
    await click("Use image");
    const blocks = editor.draft.lessons[0].blocks;
    expect(blocks.map((block) => block.type)).toEqual(["richText", "image", "heading"]);
    expect(blocks[1]).toMatchObject({ data: { caption: "Updated content", src: media.src } });
    expect(document.querySelector("dialog")).toBeNull();
    act(() => editor.undo()); expect(editor.draft.lessons[0].blocks).toHaveLength(2);
    act(() => editor.redo()); expect(editor.draft.lessons[0].blocks).toEqual(blocks);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2 })));
    await act(async () => editor.saveLatest());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).lessons[0].blocks).toEqual(blocks);
  });

  it("supports custom instructions on empty content, retries failures and cancels without inserting", async () => {
    startingBlocks = [{ ...source, data: { html: "<p></p>" } }];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Please retry" }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ media }), { status: 201 }));
    await act(async () => root.render(<Harness />)); await open();
    expect(dialogButton("Generate image").disabled).toBe(true);
    await act(async () => {
      const input = document.querySelector<HTMLTextAreaElement>("dialog textarea")!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Show a seedling");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Generate image");
    expect(document.querySelector('[role="alert"]')?.textContent).toBe("Please retry");
    await click("Generate image");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).customPrompt).toBe("Show a seedling");
    await click("Cancel");
    expect(editor.draft.lessons[0].blocks).toHaveLength(1);
    expect(editor.hasUnsavedChanges).toBe(false);
  });

  it("uses the latest order and refuses insertion after the source has been deleted", async () => {
    await act(async () => root.render(<Harness />)); await open(); await click("Generate image");
    act(() => operations.moveBlock(source.id, 1));
    await click("Use image");
    expect(editor.draft.lessons[0].blocks.map((block) => block.type)).toEqual(["heading", "richText", "image"]);
    act(() => operations.deleteBlock(source.id));
    expect(() => operations.addGeneratedBlockImage("lesson", source.id, media)).toThrow("source block was removed");
  });

  it("starts both selectors on Auto and regenerates with the chosen type and look", async () => {
    await act(async () => root.render(<Harness />)); await open();
    const [visualType, look] = [...document.querySelectorAll<HTMLSelectElement>("dialog select")];
    expect(visualType.value).toBe("auto"); expect(look.value).toBe("auto");
    expect([...look.options].map((option) => option.textContent)).toEqual(["Auto", "Clean Educational", "Screenshot / UI Mockup", "Realistic Photo", "Flat Illustration", "3D Illustration"]);
    await click("Generate image");
    expect(dialogButton("Use image")).toBeDefined();
    await act(async () => { visualType.value = "beforeAfter"; visualType.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(dialogButton("Use image")).toBeUndefined();
    await act(async () => { look.value = "screenshotUi"; look.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.querySelector("dialog")?.textContent).toContain("Browser windows, code editors, or app screens.");
    await click("Generate image");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ visualType: "beforeAfter", look: "screenshotUi", instructions: "Current block content" });
    await act(async () => { look.value = "flatIllustration"; look.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.querySelector("dialog img")).toBeNull();
    await click("Generate image");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ visualType: "beforeAfter", look: "flatIllustration" });
    expect(editor.hasUnsavedChanges).toBe(false);
  });

  it("aborts pending generation when leaving the editor", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await act(async () => root.render(<Harness />)); await open(); await click("Generate image");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(dialogButton("Generating…").disabled).toBe(true);
    expect([...document.querySelectorAll<HTMLSelectElement>("dialog select")].every((select) => select.disabled)).toBe(true);
    await act(async () => root.render(<div />));
    expect(signal.aborted).toBe(true);
  });
});
