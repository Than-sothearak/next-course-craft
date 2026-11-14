import { EditorPage } from "../_components/editor-page";

export default function PresentationModeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{
    lessonId?: string | string[];
    blockId?: string | string[];
    generate?: string | string[];
  }>;
}) {
  return (
    <EditorPage
      params={params}
      mode="presentation"
      searchParams={searchParams}
    />
  );
}
