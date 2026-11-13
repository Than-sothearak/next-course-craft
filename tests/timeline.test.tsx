/** @vitest-environment jsdom */
import { act, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { timelineBlockSchema, blockSchema } from "@/lib/schemas/block";
import { timelinePresets, timelineSample, applyTimelinePreset, type TimelineBlock as Block } from "@/lib/editor/timeline";
import { TimelineBlock } from "@/components/timeline-block";
import { TimelineBlockEditor, TimelineBlockSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/timeline-block-editor";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getHandoutBlockText } from "@/lib/pdf/content";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
import { SlideObject } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editable-object";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.restoreAllMocks(); });
const initial = (style: Block["data"]["style"] = "vertical") => timelineBlockSchema.parse({ id: "timeline", version: 1, type: "timeline", data: { style, items: structuredClone(timelineSample) } });

describe("timeline blocks", () => {
  it("validates bounded entries, layouts, IDs, colors and formatted text", () => {
    const block = initial();
    expect(blockSchema.parse(block)).toEqual(block);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, items: [] } }).success).toBe(false);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, items: Array(21).fill(block.data.items[0]) } }).success).toBe(false);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, items: [block.data.items[0], block.data.items[0]] } }).success).toBe(false);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, style: "bad" } }).success).toBe(false);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, accentColor: "url(javascript:bad)" } }).success).toBe(false);
    expect(timelineBlockSchema.safeParse({ ...block, data: { ...block.data, items: [{ ...block.data.items[0], bodyHtml: "a".repeat(100001) }] } }).success).toBe(false);
    expect(getInteractiveBlockProgressIds(block)).toEqual([]);
  });

  it.each(timelinePresets)("inserts $style templates with independent IDs and preserves content when switching", ({ style }) => {
    const template = blockTemplates.find((entry) => entry.id === `interactive-timeline-${style}`)!;
    const first = timelineBlockSchema.parse(createBlocksFromTemplate(template, "first")[0]);
    const second = timelineBlockSchema.parse(createSlideBlocksFromTemplate(template, "second")[0]);
    expect(first.data.style).toBe(style);
    expect(first.data.items).toHaveLength(3);
    expect(new Set([...first.data.items, ...second.data.items].map((entry) => entry.id)).size).toBe(6);
    const original = initial();
    original.data.items[0].bodyHtml = "<p><strong>Authored content</strong></p>";
    original.data.accentColor = "#118877";
    expect(applyTimelinePreset(original.data, first.data)).toEqual({ ...original.data, style });
  });

  it("retains formatting in snapshots and PDF handouts and remaps duplicated event IDs", () => {
    const block = initial();
    block.data.items[0] = { ...block.data.items[0], labelHtml: "<p>2026</p>", titleHtml: "<h3><strong>Start here</strong></h3>", bodyHtml: '<p>Read the <a href="https://example.com">source</a>.</p>' };
    let count = 0;
    const copy = timelineBlockSchema.parse(duplicateLessonBlocks([block], () => `copy-${++count}`)[0]);
    expect(copy.data.items.every((item) => !block.data.items.some((original) => original.id === item.id))).toBe(true);
    expect(copy.data.items[0].bodyHtml).toBe(block.data.items[0].bodyHtml);
    const snapshot = parseScorm12Snapshot({ title: "Timeline", description: "", revision: 1, sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "History", order: 0, blocks: [block] }] });
    expect(snapshot.lessons[0].blocks[0]).toEqual(block);
    expect(getHandoutBlockText(block).slice(0, 3)).toEqual(["2026", "Start here", "Read the source ."]);
  });

  it.each(["standard", "slide", "popup"] as const)("directly edits labels and formatted text in %s", async (mode) => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let saved = initial();
    function Authoring() {
      const [block, setBlock] = useState(initial()); saved = block;
      return mode === "standard" ? <TimelineBlockEditor block={block} onChange={setBlock} /> : <div data-popup={mode === "popup" || undefined}><SlideObject block={block} courseId="course" index={0} total={1} selected onSelect={() => {}} onFrame={() => {}} onChange={(next) => setBlock(timelineBlockSchema.parse(next))} onEditorFocus={() => {}} /></div>;
    }
    try {
      await act(async () => root.render(<Authoring />));
      const editor = (field: string) => container.querySelector<HTMLElement & { editor: Editor }>(`[contenteditable="true"][aria-label="Edit timeline event 1 ${field}"]`)!.editor;
      await act(async () => { editor("label").commands.setContent("<p>Launch day</p>"); });
      await act(async () => { editor("text").commands.setContent('<p><strong>Important event</strong> with <a href="https://example.com/guide">a source</a>.</p>'); });
      expect(saved.data.items[0].label).toBe("Launch day");
      expect(saved.data.items[0].bodyHtml).toContain("<strong>Important event</strong>");
      await act(async () => root.render(<TimelineBlock data={saved.data} />));
      expect(container.querySelector("strong")?.textContent).toBe("Important event");
      expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com/guide");
      expect(container.textContent).toContain("Launch day");
    } finally { await act(async () => root.unmount()); container.remove(); }
  });

  it("changes layout, reorders, adds and removes events without losing formatted content", async () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let saved = initial(); saved.data.items[0].bodyHtml = "<p><em>Preserved</em></p>";
    const original = structuredClone(saved);
    function Settings() { const [block, setBlock] = useState(original); saved = block; return <><TimelineBlockEditor block={block} onChange={setBlock} /><TimelineBlockSettings block={block} onChange={setBlock} /></>; }
    try {
      await act(async () => root.render(<Settings />));
      await act(async () => { const select = container.querySelector("select")!; select.value = "horizontal"; select.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(saved.data.style).toBe("horizontal");
      expect(saved.data.items[0].bodyHtml).toBe("<p><em>Preserved</em></p>");
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Move timeline event 1 down"]')!.click());
      expect(saved.data.items[1].id).toBe(original.data.items[0].id);
      expect(container.querySelector('[data-timeline-item="event-1"] [contenteditable="true"][aria-label="Edit timeline event 2 text"]')).not.toBeNull();
      await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Add timeline event")!.click());
      expect(saved.data.items).toHaveLength(4);
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Delete timeline event 4"]')!.click());
      expect(saved.data.items).toHaveLength(3);
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
});
