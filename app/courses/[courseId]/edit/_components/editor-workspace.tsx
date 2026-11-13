"use client";

import type { ReactNode, CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Permission } from "@/lib/auth/policy";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import { courseThemeFontFamilies } from "@/lib/editor/theme";
import { CourseOutline } from "../standard-mode/_components/course-outline";
import { BlockTemplatePicker } from "./(editor_client_components)/block-template-picker";
import { BlockManagerSidebar } from "../standard-mode/_components/block-manager-sidebar";
import { QuizEditor } from "../standard-mode/_components/quiz-editor";
import { PresentationQuizWorkspace } from "../presentation-mode/_components/presentation-quiz-workspace";
import { SlideEditorSidebar } from "../presentation-mode/_components/slide-presentation/slide-editor-sidebar";
import { EditorTopbar } from "../presentation-mode/_components/slide-presentation/editor-topbar";
import { PresentationSlideWorkspace } from "../presentation-mode/_components/presentation-slide-workspace";
import { StandardLessonEditor } from "../standard-mode/_components/standard-lesson-editor";
import { CourseOverviewEditor } from "../standard-mode/_components/course-overview-editor";
import { CourseOverviewToolbar } from "./course-overview-toolbar";
import { CourseGenerationWizard } from "./(editor_client_components)/course-generation-wizard";
import { EditorSaveStatus } from "./_components/editor-save-status";
import type { Draft } from "./_components/use-editor-draft";
import { useEditorDraft } from "./_components/use-editor-draft";
import { useEditorCourseOperations } from "./_components/use-editor-course-operations";
import { useEditorBlockOperations } from "./_components/use-editor-block-operations";

type SaveState = ReturnType<typeof useEditorDraft>["saveState"];
type CourseOperations = ReturnType<typeof useEditorCourseOperations>;
type BlockOperations = ReturnType<typeof useEditorBlockOperations>;

type EditorWorkspaceProps = {
  courseId: string;
  focusedLessonId?: string;
  initialPresentationBlockId?: string;
  authorName: string;
  userName?: string;
  permissions: Permission[];
  globalPermissions: Permission[];
  draft: Draft;
  activeLessonId: string | null;
  activeLesson: Draft["lessons"][number] | null;
  orderedSections: Draft["sections"];
  slides: Draft["lessons"];
  slideCourse: boolean;
  titleValid: boolean;
  titleValidRef: RefObject<boolean>;
  setTitleValid: Dispatch<SetStateAction<boolean>>;
  updateDraft: ReturnType<typeof useEditorDraft>["updateDraft"];
  clearSaveError: ReturnType<typeof useEditorDraft>["clearSaveError"];
  saveState: SaveState;
  saveMessage: string;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: ReturnType<typeof useEditorDraft>["undo"];
  redo: ReturnType<typeof useEditorDraft>["redo"];
  saveLatest: ReturnType<typeof useEditorDraft>["saveLatest"];
  courseOperations: CourseOperations;
  blockOperations: BlockOperations;
  blockManagerOpen: boolean;
  setBlockManagerOpen: Dispatch<SetStateAction<boolean>>;
  slideZoom: number | undefined;
  setSlideZoom: Dispatch<SetStateAction<number | undefined>>;
  slideSnapEnabled: boolean;
  setSlideSnapEnabled: Dispatch<SetStateAction<boolean>>;
  courseGenerationOpen: boolean;
  onGenerate: () => void;
  setCourseGenerationOpen: Dispatch<SetStateAction<boolean>>;
  navigateBack: () => void;
  backToCourse: () => void;
  setActiveLessonId: (id: string | null) => void;
  onForward: () => void;
  openPreview: () => void;
  runServerMutation: ReturnType<typeof useEditorDraft>["runServerMutation"];
  generationSession: GenerationSessionSnapshot | null;
  onGenerationStarted: (session: GenerationSessionSnapshot) => void;
  generationPanel: ReactNode;
};

export function EditorWorkspace({
  courseId,
  focusedLessonId,
  initialPresentationBlockId,
  authorName,
  userName,
  permissions,
  globalPermissions,
  draft,
  activeLessonId,
  activeLesson,
  orderedSections,
  slides,
  slideCourse,
  titleValid,
  titleValidRef,
  setTitleValid,
  updateDraft,
  clearSaveError,
  saveState,
  saveMessage,
  hasUnsavedChanges,
  canUndo,
  canRedo,
  undo,
  redo,
  saveLatest,
  courseOperations,
  blockOperations,
  blockManagerOpen,
  setBlockManagerOpen,
  slideZoom,
  setSlideZoom,
  slideSnapEnabled,
  setSlideSnapEnabled,
  courseGenerationOpen,
  onGenerate,
  setCourseGenerationOpen,
  navigateBack,
  backToCourse,
  setActiveLessonId,
  onForward,
  openPreview,
  runServerMutation,
  generationSession,
  onGenerationStarted,
  generationPanel,
}: EditorWorkspaceProps) {
  const {
    openLesson,
    addSlide,
    addQuizSlide,
    reorderSlides,
    duplicateSlide,
    deleteSlide,
    applyFirstSlideCover,
    addSection,
    renameSection,
    moveSection,
    duplicateSection,
    deleteSection,
    addLesson,
    duplicateLesson,
    moveLesson,
    deleteLesson,
    reorderLessons,
    changeLessonIcon,
    updateLesson,
  } = courseOperations;
  const {
    templatePicker,
    setTemplatePicker,
    updateBlock,
    openAddTemplatePicker,
    openReplaceTemplatePicker,
    applyTemplate,
    addSlideObject,
    reorderBlocks,
    reorderBlocksFromManager,
    moveBlock,
    duplicateBlock,
    pastePresentationObject,
    deleteBlock,
  } = blockOperations;

  const pendingLessonIds = new Set(
    generationSession?.status === "generating"
      ? generationSession.outline.sections.flatMap((section) => section.lessons)
          .filter((lesson) => !generationSession.completedLessonIds.includes(lesson.id))
          .map((lesson) => lesson.id)
      : [],
  );

  function renderOutline() {
    return (
      <CourseOutline
        currentCourseId={courseId}
        sections={draft.sections}
        lessons={draft.lessons}
        activeLessonId={activeLessonId}
        pendingLessonIds={pendingLessonIds}
        onSelectLesson={openLesson}
        onAddSection={addSection}
        onRenameSection={renameSection}
        onMoveSection={moveSection}
        onDuplicateSection={duplicateSection}
        onDeleteSection={deleteSection}
        onAddLesson={addLesson}
        onAddQuiz={(sectionId) => addLesson(sectionId, "quiz")}
        onDuplicateLesson={duplicateLesson}
        onMoveLesson={moveLesson}
        onDeleteLesson={deleteLesson}
        onChangeLessonIcon={changeLessonIcon}
        onReorderLessons={reorderLessons}
      />
    );
  }

  const isCourseOverview = !focusedLessonId && !activeLesson;
  const isPresentationWorkspace = slideCourse && Boolean(activeLesson);
  const saveStatus = (
    <EditorSaveStatus
      saveState={saveState}
      hasUnsavedChanges={hasUnsavedChanges}
      saveMessage={saveMessage}
      validationMessage={
        !titleValid
          ? isCourseOverview
            ? "Check course title"
            : "Check lesson title"
          : undefined
      }
    />
  );
  const isQuizLesson = activeLesson?.lessonType === "quiz";
  const isDraftSaved =
    saveState === "saved" && titleValid && !hasUnsavedChanges;
  const publishDisabledReason = generationSession?.status === "generating"
    ? "Finish or cancel lesson generation before publishing."
    : isDraftSaved ? undefined : "Save all course edits before publishing.";
  const courseStyle = {
    "--course-primary": draft.theme.primaryColor,
    "--course-accent": draft.theme.accentColor,
  } as CSSProperties;

  return (
    <main
      style={courseStyle}
      className={`${isPresentationWorkspace ? "fixed inset-0 flex h-dvh min-h-0 flex-col overflow-hidden" : "min-h-screen"} text-slate-900 ${isCourseOverview || isQuizLesson ? "bg-white" : "bg-slate-100"}`}
    >
      {isCourseOverview && (
        <CourseOverviewToolbar
          courseId={courseId}
          title={draft.title}
          theme={draft.theme}
          navigationMode={draft.navigationMode}
          globalPermissions={globalPermissions}
          userName={userName ?? authorName}
          saveStatus={saveStatus}
          canUndo={canUndo}
          canRedo={canRedo}
          slideCourse={slideCourse}
          canGenerate={permissions.includes("ai.generate")}
          canPublish={
            permissions.includes("courses.publish") &&
            permissions.includes("courses.export")
          }
          publishDisabledReason={publishDisabledReason}
          onBack={navigateBack}
          onForward={() => onForward()}
          onUndo={undo}
          onRedo={redo}
          onGenerate={onGenerate}
          onThemeChange={(theme) => updateDraft((current) => ({ ...current, theme }))}
          onNavigationModeChange={(navigationMode) =>
            updateDraft((current) => ({ ...current, navigationMode }))
          }
          onPreview={openPreview}
        />
      )}
      {!isCourseOverview && (
        <EditorTopbar
          slideCourse={slideCourse}
          isPresentationWorkspace={isPresentationWorkspace}
          focusedLessonId={focusedLessonId}
          courseId={courseId}
          lessonTitle={activeLesson?.title}
          courseTitle={draft.title}
          hasActiveLesson={Boolean(activeLesson)}
          canManageBlocks={Boolean(activeLesson && activeLesson.lessonType !== "quiz")}
          saveStatus={saveStatus}
          saveState={saveState}
          saveMessage={saveMessage}
          onRetrySave={() => void saveLatest()}
          blockManagerOpen={blockManagerOpen}
          onToggleBlockManager={() => setBlockManagerOpen((open) => !open)}
          theme={draft.theme}
          onThemeChange={(theme) => updateDraft((current) => ({ ...current, theme }))}
          navigationMode={draft.navigationMode}
          onNavigationModeChange={(navigationMode) => updateDraft((current) => ({ ...current, navigationMode }))}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onPreview={openPreview}
          onBackToOutline={() => setActiveLessonId(null)}
          onBackToCourse={backToCourse}
          onReloadCourse={() => window.location.reload()}
        />
      )}
      {isCourseOverview &&
        (saveState === "error" || saveState === "conflict") && (
          <div
            role="alert"
            className="fixed right-5 top-[108px] z-40 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-800 shadow-lg"
          >
            <span>{saveMessage}</span>
            {saveState === "conflict" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveLatest()}
              >
                Retry
              </Button>
            )}
          </div>
        )}

      {generationPanel}
      <div
        style={{ fontFamily: courseThemeFontFamilies[draft.theme.fontFamily] }}
        className={`mx-auto w-full ${isPresentationWorkspace ? "min-h-0 min-w-0 max-w-none flex-1 overflow-hidden px-2 py-2 sm:px-3" : isCourseOverview ? "max-w-[880px] px-5 pb-16 pt-7 sm:px-8 sm:pt-8" : focusedLessonId ? "max-w-none pb-40" : "max-w-none px-3 py-4 sm:px-5 lg:px-8"}`}
      >
        {!slideCourse && !focusedLessonId && activeLesson && (
          <details className="mb-3 rounded-xl border border-slate-200 bg-white p-3 lg:hidden">
            <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Course outline{" "}
              <span className="ml-1 text-xs font-normal text-slate-500">
                ({draft.lessons.length} content items)
              </span>
            </summary>
            <div className="mt-3 border-t border-slate-100 pt-3">
              {renderOutline()}
            </div>
          </details>
        )}
        <div
          className={
            isPresentationWorkspace
              ? "grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)] lg:grid-rows-1"
              : `grid gap-4 ${slideCourse || (!focusedLessonId && activeLesson) ? "lg:grid-cols-[270px_minmax(0,1fr)]" : "grid-cols-1"}`
          }
        >
          {slideCourse ? (
            <SlideEditorSidebar
              constrained={isPresentationWorkspace}
              slides={slides}
              pendingLessonIds={pendingLessonIds}
              activeId={activeLesson?.id ?? null}
              master={draft.slideMaster}
              courseTitle={draft.title}
              onSelect={openLesson}
              onAdd={() =>
                addSlide(activeLesson?.sectionId ?? orderedSections[0].id)
              }
              onAddBlank={() =>
                addSlide(activeLesson?.sectionId ?? orderedSections[0].id, true)
              }
              onAddQuiz={() =>
                addQuizSlide(activeLesson?.sectionId ?? orderedSections[0].id)
              }
              onDuplicate={duplicateSlide}
              onDelete={deleteSlide}
              onReorder={reorderSlides}
            />
          ) : (
            !focusedLessonId &&
            activeLesson && (
              <aside className="sticky top-[84px] hidden max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 lg:block">
                {renderOutline()}
              </aside>
            )
          )}

          <section
            className={`min-w-0 ${isPresentationWorkspace ? "min-h-0 overflow-hidden" : ""}`}
            aria-label={slideCourse ? "Slide canvas" : "Lesson canvas"}
          >
            <div
              className={`mx-auto w-full ${isPresentationWorkspace ? "flex h-full min-h-0 max-w-none flex-col" : isCourseOverview ? "max-w-[840px]" : "max-w-none"}`}
            >
              {isCourseOverview && (
                <CourseOverviewEditor
                  title={draft.title}
                  titleValid={titleValid}
                  authorVisible={draft.authorVisible}
                  description={draft.description}
                  descriptionHtml={draft.descriptionHtml}
                  authorName={authorName}
                  primaryColor={draft.theme.primaryColor}
                  accentColor={draft.theme.accentColor}
                  onTitleChange={(title) => {
                    const valid = title.trim().length > 0;
                    titleValidRef.current = valid;
                    setTitleValid(valid);
                    clearSaveError();
                    updateDraft((current) => ({ ...current, title }));
                  }}
                  onAuthorVisibilityChange={(authorVisible) =>
                    updateDraft((current) => ({ ...current, authorVisible }))
                  }
                  onDescriptionChange={(descriptionHtml, description) =>
                    updateDraft((current) => ({
                      ...current,
                      description,
                      descriptionHtml,
                    }))
                  }
                />
              )}
              {activeLesson && generationSession?.status === "generating" && generationSession.outline.sections.some((section) => section.lessons.some((lesson) => lesson.id === activeLesson.id)) && !generationSession.completedLessonIds.includes(activeLesson.id) ? (
                <div role="status" className="rounded-xl border border-dashed border-indigo-200 bg-white p-8 text-center text-sm text-slate-600">
                  <h2 className="font-semibold text-slate-900">Lesson draft</h2>
                  <p className="mt-2">{generationSession.currentLessonId === activeLesson.id ? "This lesson is being generated. Its content will appear after it is saved." : "This lesson is waiting to be generated."}</p>
                </div>
              ) : activeLesson ? (
                slideCourse && activeLesson.lessonType !== "quiz" ? (
                  <PresentationSlideWorkspace
                    lesson={activeLesson}
                    slides={slides}
                    courseId={courseId}
                    draft={draft}
                    initialSelectedId={initialPresentationBlockId}
                    zoom={slideZoom}
                    onZoomChange={setSlideZoom}
                    snapEnabled={slideSnapEnabled}
                    onSnapEnabledChange={setSlideSnapEnabled}
                    onSelectSlide={openLesson}
                    onUpdateLesson={(change) => updateLesson(activeLesson.id, change)}
                    onUpdateDraft={updateDraft}
                    onUpdateCourseTitle={(title) =>
                      updateDraft((current) => ({ ...current, title }))
                    }
                    onApplyCover={applyFirstSlideCover}
                    onBlockChange={(block, options) =>
                      updateBlock(block.id, block, options)
                    }
                    onAddTemplate={addSlideObject}
                    onMoreTemplates={() =>
                      openAddTemplatePicker(activeLesson.blocks.length)
                    }
                    onReplaceTemplate={openReplaceTemplatePicker}
                    onDuplicate={duplicateBlock}
                    onPasteObject={pastePresentationObject}
                    onDelete={deleteBlock}
                  />
                ) : activeLesson.lessonType === "quiz" && slideCourse ? (
                  <PresentationQuizWorkspace
                    lesson={activeLesson}
                    slides={slides}
                    master={draft.slideMaster}
                    courseId={courseId}
                    courseTitle={draft.title}
                    number={
                      slides.findIndex((slide) => slide.id === activeLesson.id) + 1
                    }
                    zoom={slideZoom}
                    onZoomChange={setSlideZoom}
                    onSelectSlide={openLesson}
                    onUpdateLesson={(change) => updateLesson(activeLesson.id, change)}
                    onUpdateMaster={(slideMaster) =>
                      updateDraft((current) => ({ ...current, slideMaster }))
                    }
                    onCourseTitleChange={(title) =>
                      updateDraft((current) => ({ ...current, title }))
                    }
                    onOpenCover={applyFirstSlideCover}
                  />
                ) : activeLesson.lessonType === "quiz" ? (
                  <QuizEditor
                    key={activeLesson.id}
                    title={activeLesson.title}
                    titleHtml={activeLesson.titleHtml}
                    onTitleChange={(title, titleHtml) =>
                      updateLesson(activeLesson.id, (lesson) => ({
                        ...lesson,
                        title,
                        titleHtml,
                      }))
                    }
                    onTitleValidityChange={(valid) => {
                      titleValidRef.current = valid;
                      setTitleValid(valid);
                    }}
                    passingScore={activeLesson.passingScore ?? 70}
                    onPassingScoreChange={(passingScore) =>
                      updateLesson(activeLesson.id, (lesson) => ({
                        ...lesson,
                        passingScore,
                      }))
                    }
                    questions={activeLesson.quizQuestions}
                    onChange={(quizQuestions) =>
                      updateLesson(activeLesson.id, (lesson) => ({
                        ...lesson,
                        quizQuestions,
                      }))
                    }
                  />
                ) : (
                  <StandardLessonEditor
                    lesson={activeLesson}
                    courseId={courseId}
                    sections={draft.sections}
                    lessons={draft.lessons}
                    saveState={saveState}
                    hasUnsavedChanges={hasUnsavedChanges}
                    saveMessage={saveMessage}
                    onRetrySave={() => {
                      if (saveState === "conflict") window.location.reload();
                      else void saveLatest();
                    }}
                    onTitleChange={(title, titleHtml) =>
                      updateLesson(activeLesson.id, (lesson) => ({
                        ...lesson,
                        title,
                        titleHtml,
                      }))
                    }
                    onTitleValidityChange={(valid) => {
                      titleValidRef.current = valid;
                      setTitleValid(valid);
                    }}
                    onReorderBlocks={reorderBlocks}
                    onAddBlock={openAddTemplatePicker}
                    onMoveBlock={moveBlock}
                    onDuplicateBlock={duplicateBlock}
                    onDeleteBlock={deleteBlock}
                    onChangeBlock={updateBlock}
                    onReplaceTemplate={openReplaceTemplatePicker}
                  />
                )
              ) : slideCourse ? (
                <div className="grid min-h-[340px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {slides.length
                        ? "Choose a slide to edit"
                        : "Your presentation has no slides"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {slides.length
                        ? "Choose a thumbnail in the slide panel to continue editing."
                        : "Choose Add slide in the slide panel to start building your presentation."}
                    </p>
                  </div>
                </div>
              ) : !focusedLessonId ? (
                <div className="mt-28">{renderOutline()}</div>
              ) : (
                <div className="grid min-h-[440px] place-items-center text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <FilePlus2 size={22} />
                    </span>
                    <h1 className="mt-4 text-xl font-semibold">
                      Your course outline is ready
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Add content from the course outline to start building this
                      course.
                    </p>
                    <Button
                      className="mt-5"
                      onClick={() => addLesson(orderedSections[0].id)}
                    >
                      <FilePlus2 size={16} />
                      Add content
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {templatePicker && (
        <BlockTemplatePicker
          open
          initialCategory={templatePicker.category}
          mode={templatePicker.mode}
          onClose={() => setTemplatePicker(null)}
          onSelect={applyTemplate}
        />
      )}
      {courseGenerationOpen && <CourseGenerationWizard
        open={courseGenerationOpen}
        onClose={() => setCourseGenerationOpen(false)}
        courseId={courseId}
        courseTitle={draft.title}
        courseDescription={draft.description}
        existingLessonCount={draft.lessons.length}
        runServerMutation={runServerMutation}
        savedSession={generationSession}
        onStarted={onGenerationStarted}
      />}
      {activeLesson && activeLesson.lessonType !== "quiz" && (
        <BlockManagerSidebar
          open={blockManagerOpen}
          blocks={activeLesson.blocks}
          onClose={() => setBlockManagerOpen(false)}
          onReorder={reorderBlocksFromManager}
        />
      )}
    </main>
  );
}
