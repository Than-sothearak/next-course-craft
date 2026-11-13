import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { changeCourseNavigationMode, initializeBlockProgress, isProgressButton, isProgressCapableBlock, setBlocksRequiredForProgress } from "@/lib/editor/progress-settings";
import { getPendingInteractiveProgressIds, getPresentationLessonProgress, getRestrictedLessonProgress } from "@/lib/export/progress";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const activity = blockSchema.parse({ id: "check", version: 1, type: "knowledgeCheck", requiredForProgress: false, data: { question: "Ready?", options: ["Yes", "No"] } });
const popup = blockSchema.parse({ id: "popup", version: 1, type: "interactionButton", data: { action: "popup", popup: { blocks: [activity] } } });
const blocks = [activity, popup, blockSchema.parse({ id: "audio", version: 1, type: "audioInstruction", data: { src: "" } }), blockSchema.parse({ id: "video", version: 1, type: "video", data: { src: "/clip.webm" } }), blockSchema.parse({ id: "continue", version: 1, type: "divider", data: { style: "continue" } }), blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Read", level: 1 } })];
const course = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, navigationMode: "sequential", sections: [{ id: "section", title: "Section", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Lesson", order: 0, blocks }] });

describe("course progress defaults", () => {
  for (const [label, create] of [["Standard", createBlocksFromTemplate], ["Presentation", createSlideBlocksFromTemplate]] as const) {
    it.each(["free", "sequential", "restricted"] as const)(`${label} templates use the %s default, including empty media and activities`, (navigationMode) => {
      for (const template of blockTemplates) {
        const created = create(template, template.id, { sections: course.sections, lessons: course.lessons, navigationMode });
        for (const block of created) expect(block.requiredForProgress, template.id).toBe(isProgressButton(block) || navigationMode === "restricted");
      }
    });
  }
  it("defaults nested interaction buttons to Required without requiring other popup activities", () => {
    const outer = blockSchema.parse({ id: "outer", version: 1, type: "interactionButton", data: { popup: { blocks: [popup] } } });
    const [created] = initializeBlockProgress([outer], "free");
    expect(created.requiredForProgress).toBe(true);
    expect(created).toMatchObject({ data: { popup: { blocks: [{ requiredForProgress: true, data: { popup: { blocks: [{ requiredForProgress: false }] } } }] } } });
    expect(setBlocksRequiredForProgress([created], false)[0].requiredForProgress).toBe(false);
  });
  it("makes non-button activities required with one mode change, including popup activities", () => {
    const changed = changeCourseNavigationMode(course, "restricted");
    expect(changed.lessons[0].blocks.filter((block) => isProgressCapableBlock(block) && !isProgressButton(block)).every((block) => block.requiredForProgress === true)).toBe(true);
    expect(changed.lessons[0].blocks[1]).toMatchObject({ data: { popup: { blocks: [{ requiredForProgress: true }] } } });
    expect(changed.lessons[0].blocks[5]).toBe(course.lessons[0].blocks[5]);
    expect(course.lessons[0].blocks[0].requiredForProgress).toBe(false);
  });
  it("preserves independent overrides when Restricted is selected again", () => {
    const changed = changeCourseNavigationMode(course, "restricted");
    changed.lessons[0].blocks[0] = { ...activity, requiredForProgress: false };
    expect(changeCourseNavigationMode(changed, "restricted")).toBe(changed);
    expect(changed.lessons[0].blocks[0].requiredForProgress).toBe(false);
    expect(changed.lessons[0].blocks[1].requiredForProgress).toBeUndefined();
  });
  it.each(["free", "sequential"] as const)("makes non-button activities optional when leaving Restricted for %s", (mode) => {
    const changed = changeCourseNavigationMode(changeCourseNavigationMode(course, "restricted"), mode);
    expect(changed.lessons[0].blocks.filter((block) => isProgressCapableBlock(block) && !isProgressButton(block)).every((block) => block.requiredForProgress === false)).toBe(true);
    expect(changed.lessons[0].blocks[1]).toMatchObject({ data: { popup: { blocks: [{ requiredForProgress: false }] } } });
  });
  it.each([undefined, true, false])("preserves button choices (%s) through every navigation transition, including nested Continue dividers", (requiredForProgress) => {
    const divider = blockSchema.parse({ id: "continue", version: 1, type: "divider", requiredForProgress, data: { style: "continue" } });
    const trigger = blockSchema.parse({ ...popup, requiredForProgress, data: { ...popup.data, popup: { blocks: [divider, activity] } } });
    let current = { navigationMode: "sequential" as "free" | "sequential" | "restricted", lessons: [{ blocks: [trigger, divider] }] };
    for (const mode of ["restricted", "free", "restricted", "sequential"] as const) {
      current = changeCourseNavigationMode(current, mode);
      expect(current.lessons[0].blocks[0].requiredForProgress).toBe(requiredForProgress);
      expect(current.lessons[0].blocks[1].requiredForProgress).toBe(requiredForProgress);
      const button = current.lessons[0].blocks[0];
      if (button.type !== "interactionButton") throw new Error("Expected interaction button");
      expect(button.data.popup.blocks[0].requiredForProgress).toBe(requiredForProgress);
      expect(button.data.popup.blocks[1].requiredForProgress).toBe(mode === "restricted");
    }
  });
  it("preserves authored settings between Free and Sequential", () => {
    const changed = changeCourseNavigationMode(course, "free");
    expect(changed.lessons).toBe(course.lessons);
    expect(changeCourseNavigationMode(changed, "sequential").lessons).toBe(course.lessons);
  });
  it("retains existing legacy requirements without rewriting blocks on read", () => {
    expect(blocks[1].requiredForProgress).toBeUndefined();
    expect(getPendingInteractiveProgressIds([blocks[1]], new Set())).toEqual(["popup:opened"]);
    expect(changeCourseNavigationMode(course, "sequential")).toBe(course);
  });
  it("uses explicit optional flags in shared learner progress and static exports", () => {
    const optional = setBlocksRequiredForProgress([activity], false);
    expect(getRestrictedLessonProgress(100, optional, new Set())).toBe(100);
    expect(getPresentationLessonProgress(optional, new Set())).toBeNull();
    expect(getPendingInteractiveProgressIds(optional, new Set())).toEqual([]);
    expect(getPresentationLessonProgress(setBlocksRequiredForProgress(optional, true), new Set())).toBe(0);
    const saved = changeCourseNavigationMode(changeCourseNavigationMode(course, "restricted"), "free");
    const exported = parseScorm12Snapshot(JSON.parse(JSON.stringify(saved)));
    expect(exported.lessons[0].blocks[0].requiredForProgress).toBe(false);
    expect(exported.lessons[0].blocks[1]).toMatchObject({ data: { popup: { blocks: [{ requiredForProgress: false }] } } });
  });
});
