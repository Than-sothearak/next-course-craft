import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requirePageCourseAccess, requirePageUser } from "@/lib/auth/pages";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { getCourseSlides, getSlideCourseTheme } from "@/lib/slides/service";
import { SlideEditorClient } from "./slide-editor-client";

type SlideEditorPageProps = { params: Promise<{ courseId: string }> };

export default function SlideEditorPage(props: SlideEditorPageProps) {
  return <Suspense fallback={<LoadingPage message="Loading slide editor…" />}><SlideEditorContent {...props} /></Suspense>;
}

async function SlideEditorContent({ params }: SlideEditorPageProps) {
  const user = await requirePageUser();
  const { courseId } = await params;
  await connectToDatabase();
  const access = await requirePageCourseAccess(user.id, courseId, "courses.edit");
  let course: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    course = await getCourseEditor(access.ownerId, courseId);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  if (course.editorType !== "slide") redirect(`/courses/${courseId}/edit`);
  const [slides, theme] = await Promise.all([getCourseSlides(access.ownerId, courseId), getSlideCourseTheme(access.ownerId, courseId)]);

  return <SlideEditorClient key={courseId} courseId={courseId} courseTitle={course.title} initialSlides={slides} initialTheme={theme} />;
}
