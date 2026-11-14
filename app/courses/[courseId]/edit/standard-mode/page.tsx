import { EditorPage } from "../_components/editor-page";

export default function StandardModeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ generate?: string | string[] }>;
}) {
  return (
    <EditorPage
      params={params}
      mode="standard"
      searchParams={searchParams}
    />
  );
}
