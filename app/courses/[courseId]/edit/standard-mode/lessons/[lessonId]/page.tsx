import { Suspense } from "react";
import { EditorPage } from "../../../_components/editor-page";
import { LessonEditSkeleton } from "../../../_components/lesson-edit-skeleton";

type PageProps = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams?: Promise<{ blockId?: string | string[] }>;
};

export default function StandardModeLessonEditorPage(props: PageProps) {
  return (
    <Suspense fallback={<LessonEditSkeleton />}>
      <StandardModeLessonEditorContent {...props} />
    </Suspense>
  );
}

async function StandardModeLessonEditorContent({
  params,
  searchParams,
}: PageProps) {
  const { courseId, lessonId } = await params;
  return (
    <EditorPage
      params={Promise.resolve({ courseId })}
      mode="standard"
      lessonId={lessonId}
      searchParams={searchParams}
    />
  );
}
