import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getPublicCourse } from "@/lib/publishing/share";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";

export const metadata: Metadata = {
  title: "Shared course | Coursecraft",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharedCoursePage({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center text-sm text-slate-600">Loading course…</main>}><SharedCourseContent params={params} /></Suspense>;
}

async function SharedCourseContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  await connectToDatabase();
  let course: Awaited<ReturnType<typeof getPublicCourse>>;
  try {
    course = await getPublicCourse(token);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  return <CoursePreview initialData={course.data} authorName={course.authorName} standalone canPublish={false} />;
}
