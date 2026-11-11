/** @vitest-environment jsdom */
import { act, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processStepsBlockSchema, processStepMediaSchema, type ContentBlock } from "@/lib/schemas/block";
import { ProcessStepsBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/process-steps-block-editor";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { InteractiveProcessSteps } from "@/app/courses/[courseId]/preview/interactive-blocks";
import { SlideObject } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getHandoutBlockText } from "@/lib/pdf/content";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { ProcessStepMedia } from "@/app/courses/[courseId]/preview/_components/(interactive_blocks_components)/(interactive_process_steps_components)/process-step-media";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const assetId = "a".repeat(24);
const media = { src: `/api/assets/${assetId}/file`, fileName: "Guide.png", mimeType: "image/png" as const, size: 128 };
vi.mock("@/app/courses/[courseId]/edit/_components/media-library-dialog", () => ({
  MediaLibraryDialog: ({ open, courseId, kind, onSelect }: { open: boolean; courseId: string; kind: string; onSelect: (asset: unknown) => void }) => open ? <button aria-label="Select step media" data-course-id={courseId} data-kind={kind} onClick={() => onSelect({ id: assetId, fileUrl: media.src, originalName: media.fileName, contentType: media.mimeType, size: media.size })}>Select media</button> : null,
}));

const initial = () => processStepsBlockSchema.parse({ id: "steps", version: 1, type: "processSteps", data: { steps: [{ id: "one", title: "Prepare", body: "First instructions" }, { id: "two", title: "Finish", body: "Last instructions" }] } });
type ProcessBlock = ReturnType<typeof initial>;

describe("process step authoring", () => {
  let root: Root, container: HTMLDivElement, saved: ProcessBlock;
  beforeEach(() => {
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks();
    delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
    delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
  });
  const click = (label: string) => act(async () => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const input = (label: string, value: string) => act(async () => {
    const control = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const editor = (field: "title" | "instructions", index = 1) => container.querySelector<HTMLElement & { editor: Editor }>(`[contenteditable="true"][aria-label="Edit process step ${index} ${field}"]`)!;
  function Authoring({ mode = "standard", original = initial() }: { mode?: "standard" | "slide" | "popup"; original?: ProcessBlock }) {
    const [block, setBlock] = useState<ContentBlock>(original);
    saved = processStepsBlockSchema.parse(block);
    return mode === "standard" ? <ProcessStepsBlockEditor block={saved} courseId="course" onChange={setBlock} />
      : <div data-popup={mode === "popup" || undefined}><SlideObject block={saved} courseId="course" index={0} total={1} selected onSelect={() => {}} onFrame={() => {}} onChange={setBlock} onEditorFocus={() => {}} /></div>;
  }

  it.each(["standard", "slide", "popup"] as const)("directly edits optional titles, formatted instructions and labels in %s", async (mode) => {
    await act(async () => root.render(<Authoring mode={mode} />));
    act(() => editor("title").editor.commands.setContent("<h3></h3>"));
    const body = editor("instructions");
    act(() => { body.focus(); body.editor.commands.setContent("<p>Read the guide</p><p>Then continue.</p>"); body.editor.commands.setTextSelection({ from: 1, to: 5 }); });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-text-selection-popup] [aria-label="Bold"]')!.click());
    act(() => { body.editor.commands.setTextSelection({ from: 10, to: 15 }); body.editor.chain().setLink({ href: "https://example.com/guide" }).run(); });
    await input("Edit process next button label", "Continue learning");
    await input("Edit process previous button label", "Go back");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("1");
    expect(saved.data.steps[0]).toMatchObject({ title: "", body: "Read the guide\n\nThen continue.", bodyHtml: expect.stringContaining("<strong>Read</strong>") });
    expect(saved.data.steps[0].bodyHtml).toContain('href="https://example.com/guide"');
    expect(saved.data).toMatchObject({ previousLabel: "Go back", nextLabel: "Continue learning" });
    expect(container.querySelector("button [contenteditable], button input")).toBeNull();
    await click("Go to next process step");
    expect(editor("instructions", 2).textContent).toBe("Last instructions");
    await click("Go to previous process step");
    expect(editor("instructions").querySelector("strong")?.textContent).toBe("Read");

    const exported = parseScorm12Snapshot({ title: "Steps", description: "", revision: 1, sections: [{ id: "s", title: "Learn", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks: [JSON.parse(JSON.stringify(saved))] }] }).lessons[0].blocks[0];
    expect(exported).toEqual(saved);
    expect(getHandoutBlockText(exported)).toEqual(["Step 1", "Read the guide\nThen continue.", "Step 2: Finish", "Last instructions"]);
    await act(async () => root.render(<InteractiveProcessSteps blockId={saved.id} {...saved.data} />));
    expect(container.querySelector("article h3")).toBeNull();
    expect(container.querySelector('article a[href="https://example.com/guide"]')).not.toBeNull();
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Go back", "Continue learning"]);
  });

  it("adds and removes course media on the active step and retains it through static asset remapping", async () => {
    await act(async () => root.render(<Authoring />));
    await click("Add process step 1 media");
    expect(document.querySelector('[aria-label="Select step media"]')?.getAttribute("data-course-id")).toBe("course");
    expect(document.querySelector('[aria-label="Select step media"]')?.getAttribute("data-kind")).toBe("attachment");
    await click("Select step media");
    expect(saved.data.steps[0].media).toEqual(media);
    expect(saved.data.steps[1].media).toBeUndefined();
    expect(container.querySelector("article img")?.getAttribute("src")).toBe(media.src);
    expect(courseAssetIds(saved)).toEqual(new Set([assetId]));
    expect(remapCourseAssetUrls(saved, new Map([[assetId, "./media/guide.png"]])).data.steps[0].media?.src).toBe("./media/guide.png");
    await click("Go to next process step");
    expect(container.querySelector("article img")).toBeNull();
    await click("Go to previous process step");
    await click("Remove process step 1 media");
    expect(saved.data.steps[0].media).toBeUndefined();
    expect(container.querySelector("article img")).toBeNull();
  });

  it("preserves line breaks and literal markup in older plain-text instructions", async () => {
    const original = initial();
    original.data.steps[0].body = "First line\nSecond <instruction> & detail";
    await act(async () => root.render(<Authoring original={original} />));
    const body = editor("instructions");
    expect(body.querySelectorAll("br")).toHaveLength(1);
    expect(body.textContent).toContain("Second <instruction> & detail");
    act(() => { body.editor.commands.setTextSelection(1); body.editor.commands.insertContent("Updated "); });
    expect(saved.data.steps[0].body).toBe("Updated First line\nSecond <instruction> & detail");
  });

  it("pauses instructional media on slide exit and cleanup, and keeps thumbnails inactive", async () => {
    const audio = { ...media, mimeType: "audio/mpeg" as const };
    await act(async () => root.render(<SlidePlaybackContext value={true}><ProcessStepMedia media={audio} presentation /></SlidePlaybackContext>));
    const player = container.querySelector("audio")!;
    const pause = vi.spyOn(player, "pause").mockImplementation(() => {});
    Object.defineProperty(player, "paused", { configurable: true, value: false });
    await act(async () => root.render(<SlidePlaybackContext value={false}><ProcessStepMedia media={audio} presentation /></SlidePlaybackContext>));
    expect(pause).toHaveBeenCalled();
    pause.mockClear();
    await act(async () => root.render(<div />));
    expect(pause).toHaveBeenCalled();
    await act(async () => root.render(<ProcessStepMedia media={audio} decorative />));
    expect(container.querySelector("audio")?.hasAttribute("controls")).toBe(false);
    expect(container.querySelector("audio")?.preload).toBe("none");
  });

  it.each(["image/png", "video/mp4", "audio/mpeg", "application/pdf"] as const)("renders %s files from static export paths", async (mimeType) => {
    const steps = initial().data.steps.map((step) => ({ ...step, media: { ...media, src: "./media/file", mimeType } }));
    await act(async () => root.render(<InteractiveProcessSteps blockId="steps" steps={steps} />));
    const tag = mimeType.startsWith("image") ? "img" : mimeType.startsWith("video") ? "video" : mimeType.startsWith("audio") ? "audio" : "a";
    const element = container.querySelector(`article ${tag}`)!;
    expect(element.getAttribute(tag === "a" ? "href" : "src")).toBe("./media/file");
    if (tag === "audio" || tag === "video") expect(element.hasAttribute("controls")).toBe(true);
  });

  it("clears corresponding formatting when editing the plain settings fields", async () => {
    function Settings() {
      const [block, setBlock] = useState<ContentBlock>({ ...initial(), data: { ...initial().data, steps: initial().data.steps.map((step) => ({ ...step, titleHtml: `<h3><strong>${step.title}</strong></h3>`, bodyHtml: `<p><em>${step.body}</em></p>`, media })) } });
      saved = processStepsBlockSchema.parse(block);
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} inlineSettings />;
    }
    await act(async () => root.render(<Settings />));
    await input("Process step 1 title", "");
    expect(saved.data.steps[0].titleHtml).toBeUndefined();
    expect(saved.data.steps[0].bodyHtml).toContain("<em>");
    await input("Process step 1 instructions", "Plain instructions");
    expect(saved.data.steps[0].bodyHtml).toBeUndefined();
    expect(saved.data.steps[0].media).toEqual(media);
  });

  it("inherits the course color in every new style and validates the new fields", async () => {
    for (const template of blockTemplates.filter((entry) => entry.type === "processSteps")) {
      const block = createBlocksFromTemplate(template, "process")[0];
      if (block.type !== "processSteps") throw new Error("Wrong block");
      expect(block.data.accentColor).toBeUndefined();
      await act(async () => root.render(<InteractiveProcessSteps blockId={block.id} {...block.data} />));
      expect(container.querySelector("section")?.style.getPropertyValue("--process-accent")).toBe("var(--course-primary, #2f5f9f)");
      expect(container.querySelector("section")?.style.getPropertyValue("--process-tint")).toContain("var(--process-accent)");
    }
    const original = initial();
    expect(processStepsBlockSchema.parse({ ...original, data: { ...original.data, steps: [{ id: "one", body: "No title" }, original.data.steps[1]] } }).data.steps[0].title).toBe("");
    expect(processStepsBlockSchema.safeParse({ ...original, data: { ...original.data, nextLabel: "x".repeat(121) } }).success).toBe(false);
    expect(processStepsBlockSchema.safeParse({ ...original, data: { ...original.data, steps: [{ ...original.data.steps[0], bodyHtml: "x".repeat(100001) }, original.data.steps[1]] } }).success).toBe(false);
    expect(processStepMediaSchema.safeParse({ ...media, src: "javascript:alert(1)" }).success).toBe(false);
  });
});
