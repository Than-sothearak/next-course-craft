import { describe, expect, it } from "vitest";
import { blockSchema, blockTypes } from "@/lib/schemas/block";
import { defaultSlideAnimation, slideAnimationSchema } from "@/lib/editor/slide-animation";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

describe("presentation block animation contract", () => {
  it("defaults to a one-second slide up without requiring a migration of older content", () => {
    expect(defaultSlideAnimation).toEqual({ effect: "slide-up", duration: 1000, delay: 0 });
    expect(slideAnimationSchema.parse({})).toEqual(defaultSlideAnimation);
    expect(blockSchema.parse({ id: "old", version: 1, type: "heading", data: { text: "Older content", level: 2 } }).slideAnimation).toBeUndefined();
  });

  it("keeps explicitly authored effects and durations while applying the new defaults to partial settings", () => {
    expect(slideAnimationSchema.parse({ effect: "fade", duration: 480 })).toEqual({ effect: "fade", duration: 480, delay: 0 });
    expect(slideAnimationSchema.parse({ delay: 120 })).toEqual({ effect: "slide-up", duration: 1000, delay: 120 });
  });

  it.each([{ effect: "spin" }, { effect: "fade;opacity:0" }, { duration: 99 }, { duration: 2001 }, { duration: 400.5 }, { duration: "480" }, { duration: Number.NaN }, { delay: -1 }, { delay: 3001 }, { delay: 0.5 }, { delay: "0" }])("rejects invalid animation settings: %j", (settings) => {
    expect(slideAnimationSchema.safeParse(settings).success).toBe(false);
  });

  it("saves animations for every block type, including nested popup objects, through editor and export snapshots", () => {
    const examples = [...new Map(blockTemplates.flatMap((template) => createBlocksFromTemplate(template, template.id)).map((block) => [block.type, block])).values(),
      blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Heading", level: 2 } }),
      blockSchema.parse({ id: "map", version: 1, type: "lessonMap", data: { checkpoints: [] } }),
    ];
    expect(examples.map((block) => block.type).sort()).toEqual([...blockTypes, "lessonMap"].sort());
    const animation = { effect: "slide-right" as const, duration: 640, delay: 120 };
    const blocks = examples.map((block) => ({ ...block, slideAnimation: animation }));
    const parents = Array.from({ length: Math.ceil(blocks.length / 20) }, (_, index) => blockSchema.parse({ id: `parent-${index}`, version: 1, type: "interactionButton", slideAnimation: { effect: "none" }, data: { popup: { blocks: blocks.slice(index * 20, (index + 1) * 20) } } }));
    const snapshot = editorSnapshotSchema.parse({ title: "Animations", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Slide", order: 0, blocks: parents }] });
    const exportedBlocks = parseScorm12Snapshot(snapshot).lessons[0].blocks;
    const exported = exportedBlocks[0];
    if (exported.type !== "interactionButton") throw new Error("Wrong block type");
    expect(exported.slideAnimation?.effect).toBe("none");
    expect(exported.data.popup.blocks.every((block) => JSON.stringify(block.slideAnimation) === JSON.stringify(animation))).toBe(true);
    let id = 0;
    const duplicates = duplicateLessonBlocks(exportedBlocks, () => `copy-${++id}`);
    const duplicate = duplicates[0];
    expect(duplicate.slideAnimation).toEqual(exported.slideAnimation);
    if (duplicate.type !== "interactionButton") throw new Error("Wrong block type");
    expect(duplicates.flatMap((block) => block.type === "interactionButton" ? block.data.popup.blocks.map((item) => item.slideAnimation) : [])).toEqual(blocks.map(() => animation));
  });
});
