"use client";

import { useRouter } from "next/navigation";
import { CoursePreview, type PreviewData } from "./course-preview";

export function CoursePreviewRoute({
  initialData,
  authorName,
}: {
  initialData: PreviewData;
  authorName: string;
}) {
  const router = useRouter();

  return (
    <CoursePreview
      initialData={initialData}
      authorName={authorName}
      persistLocalProgress={false}
      onEdit={() => router.push(`/courses/${initialData.courseId}/edit`)}
    />
  );
}
