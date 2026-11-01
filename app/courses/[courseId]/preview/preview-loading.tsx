"use client";

import { useSearchParams } from "next/navigation";
import { CoursePreviewSkeleton } from "./preview-skeleton";

export function CoursePreviewLoading({ presentation }: { presentation?: boolean }) {
  const searchParams = useSearchParams();
  return <CoursePreviewSkeleton presentation={presentation ?? searchParams.get("previewLayout") === "slides"} />;
}
