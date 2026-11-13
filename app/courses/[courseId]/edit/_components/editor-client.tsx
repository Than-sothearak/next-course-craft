"use client";

import { useRouter } from "next/navigation";
import { CourseNavigationModeContext } from "@/lib/editor/course-navigation-context";
import { useMemo, useRef, useState } from "react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import { CourseGenerationProgress } from "./(editor_client_components)/course-generation-progress";
import { useCourseGenerationSession } from "./_components/use-course-generation-session";
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
    runServerMutation,
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
  const generation = useCourseGenerationSession(initialData.courseId, runServerMutation, permissions.includes("ai.generate"));
  function requestRouteAfterSave(path: string) {
    // Returning from a focused lesson performs a full-page navigation, which
    // already uses the native beforeunload warning.
    const nativeNavigation = focusedLessonId && path === editorModeHref(initialData.courseId, "standard");
    if (nativeNavigation || generation.confirmLeave()) openRouteAfterSave(path);
  }
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
    else if (generation.confirmLeave()) router.push("/dashboard");
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
    openRouteAfterSave: requestRouteAfterSave,
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
    requestRouteAfterSave(editorModeHref(initialData.courseId, "standard"));
  }

  return (
    <CourseNavigationModeContext.Provider value={draft.navigationMode}>
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
      onGenerate={() => { if (generation.session?.status === "generating") generation.showProgress(); else setCourseGenerationOpen(true); }}
      navigateBack={navigateBack}
      backToCourse={backToCourse}
      setActiveLessonId={setActiveLessonId}
      onForward={() => router.forward()}
      openPreview={openPreview}
      runServerMutation={runServerMutation}
      generationSession={generation.session}
      onGenerationStarted={(session) => { generation.setSession(session); setActiveLessonId(null); }}
      generationPanel={generation.progressVisible && <CourseGenerationProgress session={generation.session} running={generation.running} error={generation.error} onClose={generation.dismissProgress} onRetry={generation.resume} onCancel={() => void generation.cancel()} onSelectLesson={courseOperations.openLesson} />}
    />
    </CourseNavigationModeContext.Provider>
  );
}
