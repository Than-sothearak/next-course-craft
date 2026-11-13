"use client";

import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import type { ContentBlock } from "@/lib/schemas/block";
import type { Draft } from "./use-editor-draft";
import { applyListTemplateToHtml } from "@/lib/editor/list-template";
import { applyProcessStepsPreset } from "@/lib/editor/process-steps";
import { defaultCanvasSlideFrame, resolveSlideTextLayout } from "@/lib/editor/slide-design";
import { pasteSlideObject } from "@/lib/editor/slide-clipboard";
import { removeLessonBlock } from "@/lib/editor/course-content";
import { createClientId } from "@/lib/client-id";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "../(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { blockTemplates, type BlockCategory, type BlockTemplate } from "../(editor_client_components)/(block_template_picker_components)/block-template-data";

export type TemplatePickerState =
  | { mode: "add"; index: number; category: BlockCategory }
  | { mode: "replace"; blockId: string; category: BlockCategory };

function newId() {
  return createClientId();
}

function enableSlideTextFit(block: ContentBlock): ContentBlock {
  if (block.type !== "heading" && block.type !== "richText" && block.type !== "statement") return block;
  return {
    ...block,
    slideTextLayout: { ...resolveSlideTextLayout(block.slideTextLayout), fitToText: true },
  };
}

function getTemplateCategory(block: ContentBlock): BlockCategory {
  if (block.type === "statement") return "Statement";
  if (block.type === "heading") return "Text";
  if (block.type === "link") return "Link";
  if (block.type === "richText") {
    if (block.data.html.includes("<pre")) return "Code";
    if (block.data.html.includes("<blockquote")) return "Quote";
    if (block.data.html.includes("<ul") || block.data.html.includes("<ol")) return "List";
    return "Text";
  }
  if (block.type === "image") return "Image";
  if (block.type === "gallery") return "Gallery";
  if (block.type === "video" || block.type === "audio" || block.type === "audioInstruction") return "Multimedia";
  if (block.type === "attachment") return "Attachment";
  if (block.type === "divider") return "Divider";
  if (block.type === "flipCard" || block.type === "accordion" || block.type === "labeledGraphic" || block.type === "processSteps" || block.type === "lessonMap" || block.type === "balloonArcher" || block.type === "peelToReveal" || block.type === "hangingRopeCards") return "Interactive";
  if (block.type === "chart") return "Chart";
  if (block.type === "knowledgeCheck") return "Knowledge check";
  return "Survey";
}

export function useEditorBlockOperations({
  draft,
  draftRef,
  activeLesson,
  activeLessonId,
  slideCourse,
  updateDraft,
  updateLesson,
}: {
  draft: Draft;
  draftRef: { current: Draft };
  activeLesson: Draft["lessons"][number] | null;
  activeLessonId: string | null;
  slideCourse: boolean;
  updateDraft: (update: (current: Draft) => Draft, options?: { recordHistory?: boolean }) => void;
  updateLesson: (id: string, change: (lesson: Draft["lessons"][number]) => Draft["lessons"][number]) => void;
}) {
  const [templatePicker, setTemplatePicker] = useState<TemplatePickerState | null>(null);
  function updateBlock(
    blockId: string,
    nextBlock: ContentBlock,
    options?: { recordHistory?: boolean },
  ) {
    if (!activeLesson) return;
    if (options?.recordHistory === false) {
      updateDraft(
        (current) => ({
          ...current,
          lessons: current.lessons.map((lesson) =>
            lesson.id === activeLesson.id
              ? {
                  ...lesson,
                  blocks: lesson.blocks.map((block) =>
                    block.id === blockId ? nextBlock : block,
                  ),
                }
              : lesson,
          ),
        }),
        options,
      );
      return;
    }
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: lesson.blocks.map((block) =>
        block.id === blockId ? nextBlock : block,
      ),
    }));
  }

  function openAddTemplatePicker(index: number) {
    setTemplatePicker({ mode: "add", index, category: "Text" });
  }

  function openReplaceTemplatePicker(block: ContentBlock) {
    setTemplatePicker({
      mode: "replace",
      blockId: block.id,
      category: getTemplateCategory(block),
    });
  }

  function applyTemplate(template: BlockTemplate) {
    const picker = templatePicker;
    if (!activeLesson || !picker) return;
    if (picker.mode === "add") {
      const insertedBlocks = (
        slideCourse ? createSlideBlocksFromTemplate : createBlocksFromTemplate
      )(template, newId(), {
        sections: draft.sections,
        lessons: draft.lessons,
        navigationMode: draft.navigationMode,
      }).map((block, offset) =>
        slideCourse
          ? {
              ...enableSlideTextFit(block),
              blockPadding: Math.min(block.blockPadding, 12),
              slideFrame: defaultCanvasSlideFrame(
                activeLesson.blocks.length + offset,
                block.type,
                draft.slideMaster,
                Boolean(activeLesson.slideCover),
              ),
            }
          : block,
      );
      updateLesson(activeLesson.id, (lesson) => {
        const blocks = [...lesson.blocks];
        blocks.splice(
          Math.max(0, Math.min(picker.index, blocks.length)),
          0,
          ...insertedBlocks,
        );
        return { ...lesson, blocks };
      });
    } else {
      const existing = activeLesson.blocks.find(
        (block) => block.id === picker.blockId,
      );
      const replacement =
        existing &&
        createBlocksFromTemplate(template, existing.id, {
          sections: draft.sections,
          lessons: draft.lessons,
          navigationMode: draft.navigationMode,
        })[0];
      if (!existing || !replacement) return;
      const slideReplacement = slideCourse
        ? enableSlideTextFit(replacement)
        : replacement;
      if (
        existing.type === "processSteps" &&
        slideReplacement.type === "processSteps"
      )
        slideReplacement.data = applyProcessStepsPreset(
          existing.data,
          slideReplacement.data,
        );
      if (
        existing.type === "richText" &&
        slideReplacement.type === "richText" &&
        template.category === "List"
      ) {
        slideReplacement.data.html = applyListTemplateToHtml(
          existing.data.html,
          template.html ?? "",
        );
      }
      updateBlock(existing.id, {
        ...slideReplacement,
        slideFrame: existing.slideFrame,
        slideGroupId: existing.slideGroupId,
        slideLocked: existing.slideLocked,
        slideHiddenInEditor: existing.slideHiddenInEditor,
        slideAnimation: existing.slideAnimation,
        requiredForProgress: existing.requiredForProgress ?? true,
        width: existing.width,
        widthCustom: existing.widthCustom,
        backgroundColor: existing.backgroundColor,
        blockPadding: existing.blockPadding,
        headingPadding: existing.headingPadding,
      });
    }
    setTemplatePicker(null);
  }

  function addSlideObject(templateId: string) {
    if (!activeLesson) return null;
    const template = blockTemplates.find((item) => item.id === templateId);
    if (!template) return null;
    const blocks = createSlideBlocksFromTemplate(template, newId(), {
      sections: draft.sections,
      lessons: draft.lessons,
      navigationMode: draft.navigationMode,
    });
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: [
        ...lesson.blocks,
        ...blocks.map((block, offset) => ({
          ...enableSlideTextFit(block),
          blockPadding: Math.min(block.blockPadding, 12),
          slideFrame: defaultCanvasSlideFrame(
            lesson.blocks.length + offset,
            block.type,
            draft.slideMaster,
            Boolean(lesson.slideCover),
          ),
        })),
      ],
    }));
    return blocks[0]?.id ?? null;
  }

  function reorderBlocks(event: DragEndEvent) {
    if (!activeLesson || !event.over || event.active.id === event.over.id)
      return;
    const from = activeLesson.blocks.findIndex(
      (block) => `block-${block.id}` === event.active.id,
    );
    const to = activeLesson.blocks.findIndex(
      (block) => `block-${block.id}` === event.over?.id,
    );
    if (from < 0 || to < 0) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: arrayMove(lesson.blocks, from, to),
    }));
  }

  function reorderBlocksFromManager(fromIndex: number, toIndex: number) {
    if (!activeLesson || fromIndex === toIndex) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: arrayMove(lesson.blocks, fromIndex, toIndex),
    }));
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    if (!activeLesson) return;
    updateLesson(activeLesson.id, (lesson) => {
      const from = lesson.blocks.findIndex((block) => block.id === blockId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= lesson.blocks.length) return lesson;
      return { ...lesson, blocks: arrayMove(lesson.blocks, from, to) };
    });
  }

  function duplicateBlock(blockId: string) {
    if (!activeLesson) return;
    const source = activeLesson.blocks.find((block) => block.id === blockId);
    if (!source) return;
    const copy = {
      ...source,
      id: newId(),
      ...(slideCourse && source.slideFrame
        ? {
            slideFrame: {
              ...source.slideFrame,
              x: Math.min(
                100 - source.slideFrame.width,
                source.slideFrame.x + 3,
              ),
              y: Math.min(
                100 - source.slideFrame.height,
                source.slideFrame.y + 3,
              ),
              z: Math.min(500, source.slideFrame.z + 1),
            },
          }
        : {}),
    } as ContentBlock;
    updateLesson(activeLesson.id, (lesson) => {
      const index = lesson.blocks.findIndex((block) => block.id === blockId);
      const blocks = [...lesson.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...lesson, blocks };
    });
  }

  function pastePresentationObject(source: ContentBlock): string {
    const lesson = draftRef.current.lessons.find(
      (item) => item.id === activeLessonId,
    );
    if (!slideCourse || !lesson || lesson.lessonType === "quiz")
      throw new Error("Choose a content slide before pasting an object.");
    if (lesson.slideCover && source.type !== "audioInstruction")
      throw new Error(
        "A cover slide can contain only audio instruction objects.",
      );
    if (lesson.blocks.length >= 500)
      throw new Error("A slide can contain up to 500 objects.");
    const copy = pasteSlideObject(source, lesson.blocks, newId);
    updateDraft((current) => ({
      ...current,
      lessons: current.lessons.map((item) =>
        item.id === lesson.id
          ? { ...item, blocks: [...item.blocks, copy] }
          : item,
      ),
    }));
    return copy.id;
  }

  function deleteBlock(blockId: string) {
    if (!activeLesson) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: removeLessonBlock(lesson.blocks, blockId),
    }));
  }


  return {
    templatePicker,
    setTemplatePicker,
    updateBlock,
    openAddTemplatePicker,
    openReplaceTemplatePicker,
    applyTemplate,
    addSlideObject,
    reorderBlocks,
    reorderBlocksFromManager,
    moveBlock,
    duplicateBlock,
    pastePresentationObject,
    deleteBlock,
  };
}
