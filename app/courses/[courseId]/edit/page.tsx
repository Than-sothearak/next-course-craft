import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requirePageUser, requirePageCourseAccess } from "@/lib/auth/pages";
import { LoadingPage } from "@/components/loading-page";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { EditorClient } from "./_components/editor-client";
import { courseEditorPath } from "@/lib/editor/editor-type";

type CoursePageProps = { params: Promise<{ courseId: string }> };

export default function CoursePage(props: CoursePageProps) {
  return (
    <Suspense fallback={<LoadingPage message="Loading course editor…" />}>
      <CoursePageContent {...props} />
    </Suspense>
  );
}

async function CoursePageContent({ params }: CoursePageProps) {
  const user = await requirePageUser();
  const { courseId } = await params;
  await connectToDatabase();
  const access = await requirePageCourseAccess(user.id, courseId, "courses.edit");
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
  if (initialData.editorType === "slide")
    redirect(courseEditorPath(courseId, initialData.editorType));
  const userName = user.name;
  return <EditorClient initialData={initialData} authorName={authorName} userName={userName} permissions={access.permissions} globalPermissions={user.permissions} />;
}
