import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { CoursePreviewRoute } from "./course-preview-route";
import { CoursePreviewSkeleton } from "./preview-skeleton";
import { resolveCourseAccess } from "@/lib/workspaces/access";

type CoursePreviewPageProps = {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
};

export default function CoursePreviewPage(props: CoursePreviewPageProps) {
  return (
    <Suspense fallback={<CoursePreviewSkeleton />}>
      <CoursePreviewContent {...props} />
    </Suspense>
  );
}

async function CoursePreviewContent({
  params,
  searchParams,
}: CoursePreviewPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ courseId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { lessonId?: string | string[] }),
  ]);
  await connectToDatabase();
  const access = await resolveCourseAccess(session.user.id, courseId, "view");
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
  return <CoursePreviewRoute initialData={initialData} authorName={authorName} initialLessonId={initialLessonId} canEdit={access.role !== "viewer"} />;
}
