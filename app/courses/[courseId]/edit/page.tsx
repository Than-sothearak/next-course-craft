import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { EditorClient } from "./_components/editor-client";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId } = await params;
  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    await connectToDatabase();
    initialData = await getCourseEditor(session.user.id, courseId);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  const authorName = session.user.name?.trim() || session.user.email || "Course author";
  return <EditorClient initialData={initialData} authorName={authorName} />;
}
