"use client";

import { useSearchParams } from "next/navigation";
import { CoursePreviewSkeleton } from "./preview-skeleton";

export function CoursePreviewLoading() {
  const searchParams = useSearchParams();
  return <CoursePreviewSkeleton presentation={searchParams.get("previewLayout") === "slides"} />;
}
