import { EditorClient, type EditorClientProps } from "../../_components/editor-client";

type StandardEditorProps = Pick<
  EditorClientProps,
  | "initialData"
  | "focusedLessonId"
  | "focusedBlockId"
  | "authorName"
  | "userName"
  | "permissions"
  | "globalPermissions"
>;

export function StandardEditor(props: StandardEditorProps) {
  return <EditorClient {...props} />;
}
