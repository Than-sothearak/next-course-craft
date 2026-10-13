import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/service";
import { EditorClient } from "../../_components/editor-client";

export default async function LessonEditPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId, lessonId } = await params;
  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    await connectToDatabase();
    initialData = await getCourseEditor(session.user.id, courseId);
    if (!initialData.lessons.some((lesson) => lesson.id === lessonId)) notFound();
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  const authorName = session.user.name?.trim() || session.user.email || "Course author";
  return <EditorClient initialData={initialData} focusedLessonId={lessonId} authorName={authorName} />;
}
