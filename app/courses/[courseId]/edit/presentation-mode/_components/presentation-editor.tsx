import { EditorClient, type EditorClientProps } from "../../_components/editor-client";

type PresentationEditorProps = Pick<
  EditorClientProps,
  | "initialData"
  | "initialPresentationLessonId"
  | "initialPresentationBlockId"
  | "authorName"
  | "userName"
  | "permissions"
  | "globalPermissions"
>;

export function PresentationEditor(props: PresentationEditorProps) {
  return <EditorClient {...props} />;
}
