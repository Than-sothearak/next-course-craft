import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { CoursePreviewRoute } from "./course-preview-route";

export default async function CoursePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ courseId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { lessonId?: string | string[] }),
  ]);
  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    await connectToDatabase();
    initialData = await getCourseEditor(session.user.id, courseId);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  const authorName = session.user.name?.trim() || session.user.email || "Course author";
  const requestedLessonId = typeof query.lessonId === "string" ? query.lessonId : null;
  const initialLessonId = initialData.lessons.some((lesson) => lesson.id === requestedLessonId)
    ? requestedLessonId ?? undefined
    : undefined;
  return <CoursePreviewRoute initialData={initialData} authorName={authorName} initialLessonId={initialLessonId} />;
}
