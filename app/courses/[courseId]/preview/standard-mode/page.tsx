import { PreviewPage } from "../_components/preview-page";

export default function StandardModePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}) {
  return <PreviewPage params={params} mode="standard" searchParams={searchParams} />;
}
