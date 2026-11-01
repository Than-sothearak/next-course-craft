import { PreviewPage } from "./_components/preview-page";

export default function CoursePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}) {
  return <PreviewPage params={params} mode="auto" searchParams={searchParams} />;
}
