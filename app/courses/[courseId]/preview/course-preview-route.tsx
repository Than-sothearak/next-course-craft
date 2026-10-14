"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CoursePreview, type PreviewData } from "./course-preview";

export function CoursePreviewRoute({
  initialData,
  authorName,
}: {
  initialData: PreviewData;
  authorName: string;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishingScorm12, setPublishingScorm12] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function publishHtml5() {
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch(
        `/api/courses/${initialData.courseId}/publish`,
        { method: "POST" },
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error || "Could not create the HTML5 course.");
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${
        initialData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "course"
      }.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Could not create the HTML5 course.",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function publishScorm12() {
    setPublishingScorm12(true);
    setPublishError(null);
    try {
      const response = await fetch(
        `/api/courses/${initialData.courseId}/publish/scorm12`,
        { method: "POST" },
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error || "Could not create the SCORM 1.2 package.");
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${
        initialData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "course"
      }.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Could not create the SCORM 1.2 package.",
      );
    } finally {
      setPublishingScorm12(false);
    }
  }

  return (
    <CoursePreview
      initialData={initialData}
      authorName={authorName}
      onEdit={() => router.push(`/courses/${initialData.courseId}/edit`)}
      onPublishHtml5={() => void publishHtml5()}
      publishing={publishing}
      onPublishScorm12={() => void publishScorm12()}
      publishingScorm12={publishingScorm12}
      publishError={publishError}
    />
  );
}
