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
  navigateFresh?: (href: string) => void;
};

export function CoursePreviewRoute({
  initialData,
  authorName,
  initialLessonId,
  canEdit = false,
  canPublish = false,
  navigateFresh,
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
      onBack={() => {
        if (!canEdit) {
          router.push("/dashboard");
          return;
        }
        (navigateFresh ?? ((href: string) => window.location.assign(href)))(
          editorModeHref(initialData.courseId, editorMode),
        );
      }}
      onEdit={canEdit ? (target) => router.push(lessonEditorHref(initialData.courseId, target?.lessonId, target?.blockId, editorMode)) : undefined}
    />
  );
}
