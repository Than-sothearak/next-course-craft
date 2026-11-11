"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import type { GeneratedCourseDraft } from "@/lib/ai/course-generation-schemas";
import { useFocusedContentBlock } from "./(editor_client_components)/use-focused-content-block";
import type { Permission } from "@/lib/auth/policy";
import { createClientId } from "@/lib/client-id";
import { editorModeHref } from "@/lib/editor/course-routes";
import { migrateCoverAudio } from "@/lib/editor/audio-instruction";
import { defaultSlideMaster, normalizeSlideLessonFrames } from "@/lib/editor/slide-design";

import { useEditorDraft, type Draft } from "./_components/use-editor-draft";
import { useEditorCourseOperations } from "./_components/use-editor-course-operations";
import { useEditorBlockOperations } from "./_components/use-editor-block-operations";
import { EditorWorkspace } from "./editor-workspace";

export type InitialData = { courseId: string } & EditorSnapshotInput;
export type EditorClientProps = {
  initialData: InitialData;
  focusedLessonId?: string;
  focusedBlockId?: string;
  initialPresentationLessonId?: string;
  initialPresentationBlockId?: string;
  authorName: string;
  userName?: string;
  permissions?: Permission[];
  globalPermissions?: Permission[];
};

export function EditorClient({
  initialData,
  focusedLessonId,
  focusedBlockId,
  initialPresentationLessonId,
  initialPresentationBlockId,
  authorName,
  userName,
  permissions = [],
  globalPermissions = [],
}: EditorClientProps) {
  useDismissDetailsOnOutsideClick();
  const router = useRouter();
  const initialDraft: Draft = {
    title: initialData.title,
    description: initialData.description,
    descriptionHtml: initialData.descriptionHtml,
    authorVisible: initialData.authorVisible,
    theme: initialData.theme,
    navigationMode: initialData.navigationMode ?? defaultCourseNavigationMode,
    courseLayout: initialData.courseLayout,
    slideMaster:
      initialData.courseLayout === "slides"
        ? {
            ...defaultSlideMaster,
            ...initialData.slideMaster,
            objectLayout: "canvas",
          }
        : initialData.slideMaster,
    sections: initialData.sections,
    lessons:
      initialData.courseLayout === "slides"
        ? normalizeSlideLessonFrames(
            initialData.lessons.map((lesson) =>
              migrateCoverAudio(lesson, initialData.slideMaster),
            ),
            initialData.slideMaster,
          )
        : initialData.lessons,
  };
  const [activeLessonId, setSelectedLessonId] = useState<string | null>(
    focusedLessonId ??
      (initialData.courseLayout === "slides"
        ? (initialData.lessons.some((lesson) => lesson.id === initialPresentationLessonId)
            ? initialPresentationLessonId!
            : (initialData.lessons[0]?.id ?? null))
        : null),
  );
  const [blockManagerOpen, setBlockManagerOpen] = useState(false);
  const [slideZoom, setSlideZoom] = useState<number | undefined>(undefined);
  const [slideSnapEnabled, setSlideSnapEnabled] = useState(true);
  const [titleValid, setTitleValid] = useState(true);
  const titleValidRef = useRef(true);
  const {
    draft,
    draftRef,
    pendingRouteRef,
    canUndo,
    canRedo,
    saveState,
    saveMessage,
    hasUnsavedChanges,
    updateDraft,
    openRouteAfterSave,
    undo,
    redo,
    saveLatest,
    clearSaveError,
  } = useEditorDraft({
    initialDraft,
    initialRevision: initialData.revision,
    courseId: initialData.courseId,
    titleValid,
    titleValidRef,
    onNavigate: (path) => {
      if (
        focusedLessonId &&
        path === editorModeHref(initialData.courseId, "standard")
      ) {
        // The overview may still be in the App Router cache from before this lesson was edited.
        window.location.assign(path);
        return;
      }
      router.push(path);
    },
  });
  const [courseGenerationOpen, setCourseGenerationOpen] = useState(false);
  const activeLesson =
    draft.lessons.find((lesson) => lesson.id === activeLessonId) ?? null;
  useFocusedContentBlock(focusedLessonId, activeLessonId, focusedBlockId);
  const orderedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.order - b.order),
    [draft.sections],
  );
  const slideCourse = draft.courseLayout === "slides";
  const slides = orderedSections.flatMap((section) =>
    draft.lessons
      .filter((lesson) => lesson.sectionId === section.id)
      .sort((a, b) => a.order - b.order),
  );
  function setActiveLessonId(id: string | null) {
    titleValidRef.current = true;
    setTitleValid(true);
    setBlockManagerOpen(false);
    setSelectedLessonId(id);
  }

  function navigateBack() {
    const hasSameOriginHistory = document.referrer.startsWith(
      window.location.origin,
    );
    if (window.history.length > 1 && hasSameOriginHistory) router.back();
    else router.push("/dashboard");
  }

  function applyGeneratedCourse(
    course: GeneratedCourseDraft,
    mode: "append" | "replace",
  ) {
    const append = mode === "append" && draftRef.current.lessons.length > 0;
    updateDraft((current) => {
      if (!append) {
        return {
          ...current,
          title: course.title,
          description: course.description,
          descriptionHtml: undefined,
          sections: course.sections,
          lessons: course.lessons,
        };
      }
      const sectionOffset = current.sections.length;
      return {
        ...current,
        sections: [
          ...current.sections,
          ...course.sections.map((section, index) => ({
            ...section,
            order: sectionOffset + index,
          })),
        ],
        lessons: [...current.lessons, ...course.lessons],
      };
    });
    if (!append) {
      titleValidRef.current = true;
      setTitleValid(true);
    }
    setCourseGenerationOpen(false);
    void saveLatest();
  }

  const courseOperations = useEditorCourseOperations({
    draftRef,
    courseId: initialData.courseId,
    slideCourse,
    activeLesson,
    activeLessonId,
    orderedSections,
    slides,
    updateDraft,
    openRouteAfterSave,
    pendingRouteRef,
    saveLatest,
    setActiveLessonId,
    newId: createClientId,
  });
  const { updateLesson, openPreview } = courseOperations;
  const blockOperations = useEditorBlockOperations({
    draft,
    draftRef,
    activeLesson,
    activeLessonId,
    slideCourse,
    updateDraft,
    updateLesson,
  });

  function backToCourse() {
    openRouteAfterSave(editorModeHref(initialData.courseId, "standard"));
  }

  return (
    <EditorWorkspace
      courseId={initialData.courseId}
      focusedLessonId={focusedLessonId}
      initialPresentationBlockId={initialPresentationBlockId}
      authorName={authorName}
      userName={userName}
      permissions={permissions}
      globalPermissions={globalPermissions}
      draft={draft}
      activeLessonId={activeLessonId}
      activeLesson={activeLesson}
      orderedSections={orderedSections}
      slides={slides}
      slideCourse={slideCourse}
      titleValid={titleValid}
      titleValidRef={titleValidRef}
      setTitleValid={setTitleValid}
      updateDraft={updateDraft}
      clearSaveError={clearSaveError}
      saveState={saveState}
      saveMessage={saveMessage}
      hasUnsavedChanges={hasUnsavedChanges}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      saveLatest={saveLatest}
      courseOperations={courseOperations}
      blockOperations={blockOperations}
      blockManagerOpen={blockManagerOpen}
      setBlockManagerOpen={setBlockManagerOpen}
      slideZoom={slideZoom}
      setSlideZoom={setSlideZoom}
      slideSnapEnabled={slideSnapEnabled}
      setSlideSnapEnabled={setSlideSnapEnabled}
      courseGenerationOpen={courseGenerationOpen}
      setCourseGenerationOpen={setCourseGenerationOpen}
      navigateBack={navigateBack}
      backToCourse={backToCourse}
      setActiveLessonId={setActiveLessonId}
      onForward={() => router.forward()}
      openPreview={openPreview}
      applyGeneratedCourse={applyGeneratedCourse}
    />
  );
}
