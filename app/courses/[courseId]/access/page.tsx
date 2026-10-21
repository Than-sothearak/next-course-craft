import { Suspense } from "react";
import Link from "next/link";
import { requirePageUser, requirePageCourseAccess } from "@/lib/auth/pages";
import { Course } from "@/models";
import { DashboardNavbar, DashboardUserProfile } from "@/app/dashboard/_components/dashboard-navbar";
import { CourseAccessManager } from "@/app/courses/[courseId]/access/_components/course-access-manager";
import { AdminLoading } from "@/app/admin/_components/admin-loading";

export default function CourseAccessPage({ params }: { params: Promise<{ courseId: string }> }) {
  return <Suspense fallback={<AdminLoading />}><Content params={params} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await requirePageUser();
  const { courseId } = await params;
  const access = await requirePageCourseAccess(user.id, courseId, "courses.assign");
  const course = await Course.findOne({ _id: courseId, ownerId: access.ownerId }).select("title").lean();
  return <main className="min-h-screen bg-[#f7f8fc]"><DashboardNavbar profile={<DashboardUserProfile userName={user.name} permissions={user.permissions} />} /><div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8"><Link href="/dashboard" className="text-sm font-medium text-indigo-600">← Workspace</Link><div><h1 className="text-3xl font-semibold tracking-tight">Share course access</h1><p className="mt-2 text-slate-500">{course?.title}</p></div><CourseAccessManager courseId={courseId} /></div></main>;
}
