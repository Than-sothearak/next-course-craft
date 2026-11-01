import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requirePageUser, requirePageCourseAccess } from "@/lib/auth/pages";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import {
  courseEditorMode,
  previewModeHref,
  type CourseRouteMode,
} from "@/lib/editor/course-routes";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { CoursePreviewLoading } from "../preview-loading";
import { PresentationPreview } from "../presentation-mode/_components/presentation-preview";
import { StandardPreview } from "../standard-mode/_components/standard-preview";

export function PreviewPage({
  params,
  mode,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  mode: CourseRouteMode;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <CoursePreviewLoading
          presentation={mode === "presentation" ? true : mode === "standard" ? false : undefined}
        />
      }
    >
      <PreviewPageContent params={params} mode={mode} searchParams={searchParams} />
    </Suspense>
  );
}

async function PreviewPageContent({
  params,
  mode,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  mode: CourseRouteMode;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const [{ courseId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { lessonId?: string | string[] }),
  ]);
  await connectToDatabase();
  const access = await requirePageCourseAccess(user.id, courseId, "courses.view");

  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  let authorName: string;
  try {
    [initialData, authorName] = await Promise.all([
      getCourseEditor(access.ownerId, courseId),
      getCourseAuthorName(access.ownerId, courseId),
    ]);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }

  const actualMode = courseEditorMode(initialData.courseLayout);
  const requestedLessonId =
    typeof query.lessonId === "string" ? query.lessonId : undefined;
  const initialLessonId = initialData.lessons.some(
    (lesson) => lesson.id === requestedLessonId,
  )
    ? requestedLessonId
    : undefined;

  if (mode === "auto" || mode !== actualMode) {
    const destination = previewModeHref(courseId, actualMode);
    redirect(
      initialLessonId
        ? `${destination}?lessonId=${encodeURIComponent(initialLessonId)}`
        : destination,
    );
  }

  const previewProps = {
    initialData,
    authorName,
    initialLessonId,
    canEdit: access.permissions.includes("courses.edit"),
    canPublish:
      access.permissions.includes("courses.publish") &&
      access.permissions.includes("courses.export"),
  };

  return actualMode === "presentation" ? (
    <PresentationPreview {...previewProps} />
  ) : (
    <StandardPreview {...previewProps} />
  );
}
