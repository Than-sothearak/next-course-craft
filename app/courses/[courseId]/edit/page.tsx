import { EditorPage } from "./_components/editor-page";

export default function CourseEditPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  return <EditorPage params={params} mode="auto" />;
}
