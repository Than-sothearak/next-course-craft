import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { EditorClient } from "../../_components/editor-client";
import { LessonEditSkeleton } from "../../_components/lesson-edit-skeleton";
import { resolveCourseAccess } from "@/lib/workspaces/access";

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
  await connectToDatabase();
  const access = await resolveCourseAccess(session.user.id, courseId, "view");
  if (access.role === "viewer") redirect(`/courses/${courseId}/preview?lessonId=${encodeURIComponent(lessonId)}`);
  const query = await searchParams;
  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  let authorName: string;
  try {
    [initialData, authorName] = await Promise.all([
      getCourseEditor(access.ownerId, courseId),
      getCourseAuthorName(access.ownerId, courseId),
    ]);
    if (!initialData.lessons.some((lesson) => lesson.id === lessonId)) notFound();
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }
  const userName = session.user.name?.trim() || session.user.email || "Author";
  const lesson = initialData.lessons.find((item) => item.id === lessonId)!;
  const focusedBlockId = typeof query?.blockId === "string" && lesson.blocks.some((block: { id: string }) => block.id === query.blockId)
    ? query.blockId : undefined;
  return <EditorClient key={lessonId} initialData={initialData} focusedLessonId={lessonId} focusedBlockId={focusedBlockId} authorName={authorName} userName={userName} />;
}
