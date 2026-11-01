import { EditorPage } from "../../_components/editor-page";

export default async function LegacyLessonEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams?: Promise<{ blockId?: string | string[] }>;
}) {
  const { courseId, lessonId } = await params;
  return (
    <EditorPage
      params={Promise.resolve({ courseId })}
      mode="auto"
      lessonId={lessonId}
      searchParams={searchParams}
    />
  );
}
