import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePageUser, requirePageCourseAccess } from "@/lib/auth/pages";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { CoursePreviewRoute } from "./course-preview-route";
import { CoursePreviewLoading } from "./preview-loading";

type CoursePreviewPageProps = {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
};

export default function CoursePreviewPage(props: CoursePreviewPageProps) {
  return (
    <Suspense fallback={<CoursePreviewLoading />}>
      <CoursePreviewContent {...props} />
    </Suspense>
  );
}

async function CoursePreviewContent({
  params,
  searchParams,
}: CoursePreviewPageProps) {
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
  const requestedLessonId = typeof query.lessonId === "string" ? query.lessonId : null;
  const initialLessonId = initialData.lessons.some((lesson) => lesson.id === requestedLessonId)
    ? requestedLessonId ?? undefined
    : undefined;
  return <CoursePreviewRoute initialData={initialData} authorName={authorName} initialLessonId={initialLessonId} canEdit={access.permissions.includes("courses.edit")} canPublish={access.permissions.includes("courses.publish") && access.permissions.includes("courses.export")} />;
}
