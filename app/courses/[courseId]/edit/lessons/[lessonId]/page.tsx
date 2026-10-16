import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { EditorClient } from "../../_components/editor-client";
import { LessonEditSkeleton } from "../../_components/lesson-edit-skeleton";

type LessonEditPageProps = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams?: Promise<{ blockId?: string | string[] }>;
};

export default function LessonEditPage(props: LessonEditPageProps) {
  return (
    <Suspense fallback={<LessonEditSkeleton />}>
      <LessonEditContent {...props} />
    </Suspense>
  );
}

async function LessonEditContent({ params, searchParams }: LessonEditPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { courseId, lessonId } = await params;
  const query = await searchParams;
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
  const lesson = initialData.lessons.find((item) => item.id === lessonId)!;
  const focusedBlockId = typeof query?.blockId === "string" && lesson.blocks.some((block: { id: string }) => block.id === query.blockId)
    ? query.blockId : undefined;
  return <EditorClient key={lessonId} initialData={initialData} focusedLessonId={lessonId} focusedBlockId={focusedBlockId} authorName={authorName} />;
}
