import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requirePageCourseAccess, requirePageUser } from "@/lib/auth/pages";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { getCourseSlides, getSlideCourseTheme } from "@/lib/slides/service";
import { SlidePlayerClient } from "./slide-player-client";

type Props = { params: Promise<{ courseId: string }> };

export default function SlidePreviewPage(props: Props) {
  return <Suspense fallback={<LoadingPage message="Loading slide preview…" />}><SlidePreviewContent {...props} /></Suspense>;
}

async function SlidePreviewContent({ params }: Props) {
  const user = await requirePageUser();
  const { courseId } = await params;
  await connectToDatabase();
  const access = await requirePageCourseAccess(user.id, courseId, "courses.view");
  let course: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    course = await getCourseEditor(access.ownerId, courseId);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  if (course.editorType !== "slide") redirect(`/courses/${courseId}/preview`);
  const [slides, theme] = await Promise.all([getCourseSlides(access.ownerId, courseId), getSlideCourseTheme(access.ownerId, courseId)]);
  return <SlidePlayerClient title={course.title} slides={slides} theme={theme.theme} progressKey={`${user.id}:${courseId}`} editorHref={access.permissions.includes("courses.edit") ? `/courses/${courseId}/slides/edit` : undefined} />;
}
