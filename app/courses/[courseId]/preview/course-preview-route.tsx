"use client";

import { useRouter } from "next/navigation";
import { CoursePreview, type PreviewData } from "./course-preview";
import { lessonEditorHref } from "@/lib/editor/lesson-location";

export function CoursePreviewRoute({
  initialData,
  authorName,
  initialLessonId,
  canEdit = false,
  canPublish = false,
}: {
  initialData: PreviewData;
  authorName: string;
  initialLessonId?: string;
  canEdit?: boolean;
  canPublish?: boolean;
}) {
  const router = useRouter();

  return (
    <CoursePreview
      initialData={initialData}
      authorName={authorName}
      initialLessonId={initialLessonId}
      persistLocalProgress={false}
      canPublish={canPublish}
      onBack={() => router.push(canEdit ? `/courses/${initialData.courseId}/edit` : "/dashboard")}
      onEdit={canEdit ? (target) => router.push(lessonEditorHref(initialData.courseId, target?.lessonId, target?.blockId)) : undefined}
    />
  );
}
