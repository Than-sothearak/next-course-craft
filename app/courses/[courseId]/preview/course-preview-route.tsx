"use client";

import { useRouter } from "next/navigation";
import { CoursePreview, type PreviewData } from "./course-preview";
import { lessonEditorHref } from "@/lib/editor/lesson-location";

export function CoursePreviewRoute({
  initialData,
  authorName,
  initialLessonId,
}: {
  initialData: PreviewData;
  authorName: string;
  initialLessonId?: string;
}) {
  const router = useRouter();

  return (
    <CoursePreview
      initialData={initialData}
      authorName={authorName}
      initialLessonId={initialLessonId}
      persistLocalProgress={false}
      onEdit={(target) => router.push(lessonEditorHref(initialData.courseId, target?.lessonId, target?.blockId))}
    />
  );
}
