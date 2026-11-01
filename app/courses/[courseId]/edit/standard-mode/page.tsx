import { EditorPage } from "../_components/editor-page";

export default function StandardModeEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  return <EditorPage params={params} mode="standard" />;
}
