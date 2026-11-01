import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { requirePageUser, requirePageCourseAccess } from "@/lib/auth/pages";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DashboardError } from "@/lib/dashboard/rules";
import {
  courseEditorMode,
  editorModeHref,
  lessonEditorHref,
  type CourseRouteMode,
} from "@/lib/editor/course-routes";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { PresentationEditor } from "../presentation-mode/_components/presentation-editor";
import { StandardEditor } from "../standard-mode/_components/standard-editor";

type SearchParams = {
  lessonId?: string | string[];
  blockId?: string | string[];
};

export function EditorPage({
  params,
  mode,
  lessonId,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  mode: CourseRouteMode;
  lessonId?: string;
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<LoadingPage message="Loading course editor…" />}>
      <EditorPageContent
        params={params}
        mode={mode}
        lessonId={lessonId}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

async function EditorPageContent({
  params,
  mode,
  lessonId: routeLessonId,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  mode: CourseRouteMode;
  lessonId?: string;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requirePageUser();
  const [{ courseId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as SearchParams),
  ]);
  await connectToDatabase();
  const access = await requirePageCourseAccess(user.id, courseId, "courses.edit");

  let initialData: Awaited<ReturnType<typeof getCourseEditor>>;
  let authorName: string;
  try {
    [initialData, authorName] = await Promise.all([
      getCourseEditor(access.ownerId, courseId),
      getCourseAuthorName(access.ownerId, courseId),
    ]);
  } catch (error) {
    if (error instanceof DashboardError && error.status === 404) notFound();
    throw error;
  }

  const actualMode = courseEditorMode(initialData.courseLayout);
  const queryLessonId =
    typeof query.lessonId === "string" ? query.lessonId : undefined;
  const selectedLessonId = routeLessonId ?? queryLessonId;

  if (selectedLessonId && !initialData.lessons.some((lesson) => lesson.id === selectedLessonId)) {
    notFound();
  }

  const selectedLesson = initialData.lessons.find(
    (lesson) => lesson.id === selectedLessonId,
  );
  const requestedBlockId =
    typeof query.blockId === "string" &&
    selectedLesson?.blocks.some((block: { id: string }) => block.id === query.blockId)
      ? query.blockId
      : undefined;

  if (mode === "auto" || mode !== actualMode) {
    redirect(
      selectedLessonId
        ? lessonEditorHref(courseId, selectedLessonId, requestedBlockId, actualMode)
        : editorModeHref(courseId, actualMode),
    );
  }

  const presentation = actualMode === "presentation";
  const sharedProps = {
    initialData,
    authorName,
    userName: user.name,
    permissions: access.permissions,
    globalPermissions: user.permissions,
  };

  if (presentation) {
    return (
      <PresentationEditor
        key={`${selectedLessonId ?? "overview"}:${requestedBlockId ?? ""}`}
        {...sharedProps}
        initialPresentationLessonId={selectedLessonId}
        initialPresentationBlockId={requestedBlockId}
      />
    );
  }

  return (
    <StandardEditor
      key={selectedLessonId}
      {...sharedProps}
      focusedLessonId={selectedLessonId}
      focusedBlockId={requestedBlockId}
    />
  );
}
