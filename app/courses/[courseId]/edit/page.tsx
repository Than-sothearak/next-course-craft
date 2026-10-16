import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoadingPage } from "@/components/loading-page";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { EditorClient } from "./_components/editor-client";
import { resolveCourseAccess } from "@/lib/workspaces/access";

type CoursePageProps = { params: Promise<{ courseId: string }> };

export default function CoursePage(props: CoursePageProps) {
  return (
    <Suspense fallback={<LoadingPage message="Loading course editor…" />}>
      <CoursePageContent {...props} />
    </Suspense>
  );
}

async function CoursePageContent({ params }: CoursePageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId } = await params;
  await connectToDatabase();
  const access = await resolveCourseAccess(session.user.id, courseId, "view");
  if (access.role === "viewer") redirect(`/courses/${courseId}/preview`);
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
  const userName = session.user.name?.trim() || session.user.email || "Author";
  return <EditorClient initialData={initialData} authorName={authorName} userName={userName} />;
}
