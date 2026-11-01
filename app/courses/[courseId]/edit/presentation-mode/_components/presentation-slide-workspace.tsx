"use client";

import type { ComponentProps } from "react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import type { Draft } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-draft";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";
import { resolveSlideSize } from "@/lib/editor/slide-design";
import { reorderSlideLayers } from "@/lib/editor/slide-layers";
import { SlideObjectWorkspace } from "./slide-presentation/slide-object-workspace";
import { SlideEditorNavigation } from "./slide-presentation/slide-editor-navigation";

type Lesson = EditorSnapshotInput["lessons"][number];
type WorkspaceProps = ComponentProps<typeof SlideObjectWorkspace>;

type PresentationSlideWorkspaceProps = {
  lesson: Lesson;
  slides: readonly SlideItem[];
  courseId: string;
  draft: Draft;
  initialSelectedId?: string;
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (enabled: boolean) => void;
  onSelectSlide: (lessonId: string) => void;
  onUpdateLesson: (change: (lesson: Lesson) => Lesson) => void;
  onUpdateDraft: (change: (draft: Draft) => Draft) => void;
  onUpdateCourseTitle: (title: string) => void;
  onApplyCover: () => void;
  onBlockChange: WorkspaceProps["onBlockChange"];
  onAddTemplate: WorkspaceProps["onAddTemplate"];
  onMoreTemplates: WorkspaceProps["onMoreTemplates"];
  onReplaceTemplate: WorkspaceProps["onReplaceTemplate"];
  onDuplicate: WorkspaceProps["onDuplicate"];
  onPasteObject: WorkspaceProps["onPasteObject"];
  onDelete: WorkspaceProps["onDelete"];
};

export function PresentationSlideWorkspace({
  lesson,
  slides,
  courseId,
  draft,
  initialSelectedId,
  zoom,
  onZoomChange,
  snapEnabled,
  onSnapEnabledChange,
  onSelectSlide,
  onUpdateLesson,
  onUpdateDraft,
  onUpdateCourseTitle,
  onApplyCover,
  onBlockChange,
  onAddTemplate,
  onMoreTemplates,
  onReplaceTemplate,
  onDuplicate,
  onPasteObject,
  onDelete,
}: PresentationSlideWorkspaceProps) {
  const slideNumber = slides.findIndex((slide) => slide.id === lesson.id) + 1;
  const onStart =
    slideNumber < slides.length
      ? () => onSelectSlide(slides[slideNumber].id)
      : undefined;

  return (
    <SlideObjectWorkspace
      key={lesson.id}
      initialSelectedId={initialSelectedId}
      title={lesson.title}
      headerStyle={lesson.slideHeaderStyle}
      onHeaderStyleChange={(slideHeaderStyle) =>
        onUpdateLesson((current) => ({ ...current, slideHeaderStyle }))
      }
      appearance={lesson.slideAppearance}
      onAppearanceChange={(slideAppearance) =>
        onUpdateLesson((current) => ({ ...current, slideAppearance }))
      }
      courseTitle={draft.title}
      slideNumber={slideNumber}
      slideCount={slides.length}
      blocks={lesson.blocks}
      sections={draft.sections}
      lessons={draft.lessons}
      master={draft.slideMaster}
      cover={lesson.slideCover}
      hasCover={slides.some((slide) => Boolean(slide.slideCover))}
      courseId={courseId}
      zoom={zoom}
      onZoomChange={onZoomChange}
      snapEnabled={snapEnabled}
      onSnapEnabledChange={onSnapEnabledChange}
      onTitleChange={(title) =>
        onUpdateLesson((current) => ({ ...current, title, titleHtml: undefined }))
      }
      onMasterChange={(slideMaster) =>
        onUpdateDraft((current) => ({ ...current, slideMaster }))
      }
      onCoverChange={(slideCover) =>
        onUpdateLesson((current) => ({ ...current, slideCover }))
      }
      onApplyCover={onApplyCover}
      onCourseTitleChange={onUpdateCourseTitle}
      onStart={onStart}
      onBlockChange={onBlockChange}
      onReorderLayer={(activeId, overId) =>
        onUpdateLesson((current) => ({
          ...current,
          blocks: reorderSlideLayers(
            current.blocks,
            activeId,
            overId,
            resolveSlideSize(draft.slideMaster),
          ),
        }))
      }
      onApplyBorderRadiusToAll={(slideBorderRadius) =>
        onUpdateDraft((current) => ({
          ...current,
          lessons: current.lessons.map((currentLesson) => ({
            ...currentLesson,
            blocks: currentLesson.blocks.map((block) => ({
              ...block,
              slideBorderRadius,
            })),
          })),
        }))
      }
      onAddTemplate={onAddTemplate}
      onMoreTemplates={onMoreTemplates}
      onReplaceTemplate={onReplaceTemplate}
      onDuplicate={onDuplicate}
      onPasteObject={onPasteObject}
      onDelete={onDelete}
      controls={
        <SlideEditorNavigation
          slides={slides}
          selectedId={lesson.id}
          onSelect={onSelectSlide}
          guide={draft.slideMaster?.navigationGuide}
        />
      }
    />
  );
}

