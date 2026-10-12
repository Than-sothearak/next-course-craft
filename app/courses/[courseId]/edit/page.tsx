import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/service";
import { AddLessonButton } from "./_components/add-lesson-button";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId } = await params;
  let data: Awaited<ReturnType<typeof getCourseEditor>>;
  try {
    await connectToDatabase();
    data = await getCourseEditor(session.user.id, courseId);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  const sections = [...data.sections].sort((a, b) => a.order - b.order);
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5"><div className="flex items-center gap-3"><Link href="/dashboard" aria-label="Back to dashboard" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><ArrowLeft size={18} /></Link><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Course</p><h1 className="text-lg font-semibold">{data.title}</h1></div></div><AddLessonButton courseId={courseId} /></div></header>
    <div className="mx-auto max-w-5xl px-5 py-8"><h2 className="text-xl font-semibold">Lessons</h2><p className="mt-1 text-sm text-slate-500">Choose a lesson to edit its content.</p>
      {data.lessons.length ? <div className="mt-6 space-y-6">{sections.map((section) => {
        const lessons = data.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order);
        if (!lessons.length) return null;
        return <section key={section.id}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</h3><div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{lessons.map((lesson) => <Link key={lesson.id} href={`/courses/${courseId}/edit/lessons/${lesson.id}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0 hover:bg-slate-50"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><FileText size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{lesson.title}</span><span className="mt-0.5 block text-xs text-slate-500">{lesson.blocks.length} {lesson.blocks.length === 1 ? "block" : "blocks"}</span></span><span className="text-sm text-indigo-600">Edit</span></Link>)}</div></section>;
      })}</div> : <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><FileText className="mx-auto text-slate-400" size={28} /><h3 className="mt-3 font-medium">No lessons yet</h3><p className="mt-1 text-sm text-slate-500">Add a lesson to start building this course.</p></div>}
    </div>
  </main>;
}
