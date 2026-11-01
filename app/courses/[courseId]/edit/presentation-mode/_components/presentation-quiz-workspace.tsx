"use client";

import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import type { Draft } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-draft";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";
import { SlideCoverPanel } from "./slide-presentation/slide-cover-panel";
import { SlideEditorNavigation } from "./slide-presentation/slide-editor-navigation";
import { SlideMasterPanel } from "./slide-presentation/slide-master-panel";
import { SlideQuizEditor } from "./slide-presentation/slide-quiz-editor";

type Lesson = EditorSnapshotInput["lessons"][number];

type PresentationQuizWorkspaceProps = {
  lesson: Lesson;
  slides: readonly SlideItem[];
  master: Draft["slideMaster"];
  courseId: string;
  courseTitle: string;
  number: number;
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  onSelectSlide: (lessonId: string) => void;
  onUpdateLesson: (change: (lesson: Lesson) => Lesson) => void;
  onUpdateMaster: (master: Draft["slideMaster"]) => void;
  onCourseTitleChange: (title: string) => void;
  onOpenCover: () => void;
};

export function PresentationQuizWorkspace({
  lesson,
  slides,
  master,
  courseId,
  courseTitle,
  number,
  zoom,
  onZoomChange,
  onSelectSlide,
  onUpdateLesson,
  onUpdateMaster,
  onCourseTitleChange,
  onOpenCover,
}: PresentationQuizWorkspaceProps) {
  return (
    <SlideQuizEditor
      appearance={lesson.slideAppearance}
      onAppearanceChange={(slideAppearance) =>
        onUpdateLesson((current) => ({ ...current, slideAppearance }))
      }
      courseId={courseId}
      key={lesson.id}
      title={lesson.title}
      headerStyle={lesson.slideHeaderStyle}
      onHeaderStyleChange={(slideHeaderStyle) =>
        onUpdateLesson((current) => ({ ...current, slideHeaderStyle }))
      }
      onTitleChange={(title) =>
        onUpdateLesson((current) => ({ ...current, title, titleHtml: undefined }))
      }
      questions={lesson.quizQuestions}
      onChange={(quizQuestions) =>
        onUpdateLesson((current) => ({ ...current, quizQuestions }))
      }
      passingScore={lesson.passingScore ?? 70}
      onPassingScoreChange={(passingScore) =>
        onUpdateLesson((current) => ({ ...current, passingScore }))
      }
      master={master}
      number={number}
      total={slides.length}
      zoom={zoom}
      onZoomChange={onZoomChange}
      controls={
        <SlideEditorNavigation
          key={lesson.id}
          slides={slides}
          selectedId={lesson.id}
          onSelect={onSelectSlide}
          guide={master?.navigationGuide}
        />
      }
      masterSettings={
        <SlideMasterPanel
          value={master}
          courseId={courseId}
          onChange={onUpdateMaster}
        />
      }
      coverSettings={
        <SlideCoverPanel
          hasCover={slides.some((slide) => Boolean(slide.slideCover))}
          courseId={courseId}
          courseTitle={courseTitle}
          onTitleChange={onCourseTitleChange}
          onChange={() => {}}
          onOpenCover={onOpenCover}
        />
      }
    />
  );
}
