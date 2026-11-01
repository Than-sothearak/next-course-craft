import { EditorPage } from "../../../_components/editor-page";

export default async function StandardModeLessonEditorPage({
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
      mode="standard"
      lessonId={lessonId}
      searchParams={searchParams}
    />
  );
}
