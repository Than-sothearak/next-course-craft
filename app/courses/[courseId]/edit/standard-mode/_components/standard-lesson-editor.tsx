"use client";

import { useId } from "react";
import { AnimatePresence } from "framer-motion";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { editorBlockElementId } from "@/lib/editor/lesson-location";
import { LessonTitleEditor } from "@/app/courses/[courseId]/edit/standard-mode/_components/lesson-title-editor";
import { SortableItem } from "@/app/courses/[courseId]/edit/standard-mode/_components/sortable-item";
import { BlockFormatMenu } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/block-format-menu";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";

type Lesson = EditorSnapshotInput["lessons"][number];
type Section = EditorSnapshotInput["sections"][number];
type SaveState = "saved" | "saving" | "error" | "conflict";

type StandardLessonEditorProps = {
  lesson: Lesson;
  courseId: string;
  sections: Section[];
  lessons: Lesson[];
  saveState: SaveState;
  hasUnsavedChanges: boolean;
  saveMessage: string;
  onRetrySave: () => void;
  onTitleChange: (title: string, titleHtml: string) => void;
  onTitleValidityChange: (valid: boolean) => void;
  onReorderBlocks: (event: DragEndEvent) => void;
  onAddBlock: (index: number) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onChangeBlock: (blockId: string, next: ContentBlock) => void;
  onReplaceTemplate: (block: ContentBlock) => void;
};

function contrastTextColor(hex: string) {
  const channels = hex
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return "#111827";
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return 1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.06
    ? "#ffffff"
    : "#111827";
}

export function StandardLessonEditor({
  lesson,
  courseId,
  sections,
  lessons,
  saveState,
  hasUnsavedChanges,
  saveMessage,
  onRetrySave,
  onTitleChange,
  onTitleValidityChange,
  onReorderBlocks,
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onChangeBlock,
  onReplaceTemplate,
}: StandardLessonEditorProps) {
  const dndId = `lesson-blocks-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  return (
    <div className="w-full">
      <LessonTitleEditor
        key={lesson.id}
        title={lesson.title}
        html={lesson.titleHtml}
        onChange={onTitleChange}
        onValidityChange={onTitleValidityChange}
      />
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onReorderBlocks}
      >
        <SortableContext
          items={lesson.blocks.map((block) => `block-${block.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div>
            <AnimatePresence initial={false}>
              {lesson.blocks.map((block, index) => {
                const contentWidth = block.widthCustom
                  ? block.width
                  : defaultBlockWidthForBlock(block);
                const widthClass =
                  contentWidth === "small"
                    ? "max-w-[520px]"
                    : contentWidth === "medium"
                      ? "max-w-[720px]"
                      : "max-w-[920px]";
                const blockPadding =
                  block.blockPadding ?? defaultBlockPaddingForBlock(block);
                const headingPaddingClass = {
                  none: "",
                  small: "px-2 py-1",
                  medium: "px-4 py-2",
                  large: "px-8 py-4",
                }[block.headingPadding ?? "none"];

                return (
                  <SortableItem
                    key={block.id}
                    id={`block-${block.id}`}
                    className="relative w-full"
                    overlayHandle
                    animateLayout
                    exit
                  >
                    <div className="group/boundary absolute -top-1.5 inset-x-0 z-40 h-3">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Add block"
                        title="Add block"
                        onClick={() => onAddBlock(index)}
                        className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0 opacity-0 shadow-sm transition-opacity group-hover/boundary:opacity-100 group-focus-within/boundary:opacity-100"
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                    <div
                      id={editorBlockElementId(block.id)}
                      data-editor-block-id={block.id}
                      tabIndex={-1}
                      className="group/block-content relative min-w-0 flex-1 scroll-mt-24 outline-none focus-within:ring-2 focus-within:ring-indigo-200"
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-10 border border-dashed border-slate-400 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100"
                      />
                      <div className="absolute right-4 top-3 z-40 flex items-center gap-1 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveBlock(block.id, -1)}
                          disabled={index === 0}
                          aria-label="Move block up"
                          title="Move block up"
                          className="size-8"
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveBlock(block.id, 1)}
                          disabled={index === lesson.blocks.length - 1}
                          aria-label="Move block down"
                          title="Move block down"
                          className="size-8"
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <BlockFormatMenu
                          block={block}
                          onChange={(next) => onChangeBlock(block.id, next)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDuplicateBlock(block.id)}
                          aria-label="Duplicate block"
                          className="size-8"
                        >
                          <Copy size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteBlock(block.id)}
                          aria-label="Delete block"
                          className="size-8 text-slate-400 hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                      <div
                        className="w-full"
                        style={{
                          backgroundColor: block.backgroundColor,
                          color: contrastTextColor(block.backgroundColor),
                          paddingTop: `${blockPadding}px`,
                          paddingBottom: `${blockPadding}px`,
                        }}
                      >
                        <div
                          className={`mx-auto w-full ${widthClass} px-4 transition-all duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
                        >
                          <div
                            className={
                              block.type === "heading"
                                ? headingPaddingClass
                                : ""
                            }
                          >
                            <ContentBlockEditor
                              block={block}
                              courseId={courseId}
                              sections={sections}
                              lessons={lessons}
                              lessonBlocks={lesson.blocks}
                              saveState={saveState}
                              hasUnsavedChanges={hasUnsavedChanges}
                              saveMessage={saveMessage}
                              onRetrySave={onRetrySave}
                              onChange={(next) => onChangeBlock(block.id, next)}
                              onReplaceTemplate={() => onReplaceTemplate(block)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {index === lesson.blocks.length - 1 && (
                      <div className="group/boundary absolute -bottom-1.5 inset-x-0 z-40 h-3">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Add block"
                          title="Add block"
                          onClick={() => onAddBlock(lesson.blocks.length)}
                          className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0 opacity-0 shadow-sm transition-opacity group-hover/boundary:opacity-100 group-focus-within/boundary:opacity-100"
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>
      {!lesson.blocks.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
          <p className="font-medium text-slate-800">
            Build this lesson one block at a time
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Add a text block, heading, or media link to begin.
          </p>
        </div>
      )}
      <div className="mt-5 flex justify-center">
        <Button variant="outline" onClick={() => onAddBlock(lesson.blocks.length)}>
          <Plus size={16} />
          Add block
        </Button>
      </div>
    </div>
  );
}
