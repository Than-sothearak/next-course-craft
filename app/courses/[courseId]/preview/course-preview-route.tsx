"use client";

import { useRouter } from "next/navigation";
import { CoursePreview, type PreviewData } from "./course-preview";
import { lessonEditorHref } from "@/lib/editor/lesson-location";
import { courseEditorMode, editorModeHref } from "@/lib/editor/course-routes";

export type CoursePreviewRouteProps = {
  initialData: PreviewData;
  authorName: string;
  initialLessonId?: string;
  canEdit?: boolean;
  canPublish?: boolean;
};

export function CoursePreviewRoute({
  initialData,
  authorName,
  initialLessonId,
  canEdit = false,
  canPublish = false,
}: CoursePreviewRouteProps) {
  const router = useRouter();
  const editorMode = courseEditorMode(initialData.courseLayout);

  return (
    <CoursePreview
      initialData={initialData}
      authorName={authorName}
      initialLessonId={initialLessonId}
      persistLocalProgress={false}
      canPublish={canPublish}
      onBack={() => router.push(canEdit ? editorModeHref(initialData.courseId, editorMode) : "/dashboard")}
      onEdit={canEdit ? (target) => router.push(lessonEditorHref(initialData.courseId, target?.lessonId, target?.blockId, editorMode)) : undefined}
    />
  );
}
