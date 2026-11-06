"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import type { Draft } from "./use-editor-draft";
import { defaultSlideCover } from "@/lib/editor/slide-design";
import { duplicateLessonBlocks, duplicateLessonContent, duplicatePresentationSlide, moveLessonToSection, reorderPresentationSlides } from "@/lib/editor/course-content";
import { createQuizQuestion } from "@/lib/editor/quiz-question";
import { lessonEditorHref } from "@/lib/editor/lesson-location";
import { previewModeHref } from "@/lib/editor/course-routes";

export function useEditorCourseOperations({
  draftRef,
  courseId,
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
  newId,
}: {
  draftRef: { current: Draft };
  courseId: string;
  slideCourse: boolean;
  activeLesson: Draft["lessons"][number] | null;
  activeLessonId: string | null;
  orderedSections: Draft["sections"];
  slides: Draft["lessons"];
  updateDraft: (update: (current: Draft) => Draft, options?: { recordHistory?: boolean }) => void;
  openRouteAfterSave: (path: string) => void;
  pendingRouteRef: { current: string | null };
  saveLatest: () => Promise<void>;
  setActiveLessonId: (id: string | null) => void;
  newId: () => string;
}) {
  function openLesson(id: string) {
    if (slideCourse) {
      setActiveLessonId(id);
      return;
    }
    openRouteAfterSave(lessonEditorHref(courseId, id, undefined, "standard"));
  }

  function addSlide(sectionId: string, blank = false) {
    setActiveLessonId(addLesson(sectionId, "content", blank));
  }

  function addQuizSlide(sectionId: string) {
    setActiveLessonId(addLesson(sectionId, "quiz"));
  }

  function reorderSlides(activeId: string, overId: string) {
    updateDraft((current) =>
      reorderPresentationSlides(current, activeId, overId),
    );
  }

  function duplicateSlide(id: string) {
    const { course, duplicateId } = duplicatePresentationSlide(
      draftRef.current,
      id,
      newId,
    );
    if (!duplicateId) return;
    pendingRouteRef.current = null;
    updateDraft(() => course);
    setActiveLessonId(duplicateId);
    void saveLatest();
  }

  function deleteSlide(id: string) {
    const index = slides.findIndex((slide) => slide.id === id);
    if (index < 0) return;
    pendingRouteRef.current = null;
    const next = slides[index + 1] ?? slides[index - 1];
    deleteLesson(id);
    if (activeLesson?.id === id) setActiveLessonId(next?.id ?? null);
    void saveLatest();
  }

  function applyFirstSlideCover() {
    const existing = slides.find((slide) => slide.slideCover);
    if (existing) {
      setActiveLessonId(existing.id);
      return;
    }
    const first = slides[0];
    if (!first) return;
    if (first.lessonType !== "quiz" && !first.blocks.length) {
      updateLesson(first.id, (lesson) => ({
        ...lesson,
        slideCover: { ...defaultSlideCover },
      }));
      setActiveLessonId(first.id);
      return;
    }
    const coverId = newId();
    updateDraft((current) => ({
      ...current,
      lessons: [
        ...current.lessons.map((lesson) =>
          lesson.sectionId === first.sectionId
            ? { ...lesson, order: lesson.order + 1 }
            : lesson,
        ),
        {
          id: coverId,
          sectionId: first.sectionId,
          title: "Cover",
          icon: "file" as const,
          lessonType: "content" as const,
          passingScore: 70,
          quizQuestions: [],
          order: 0,
          blocks: [] as ContentBlock[],
          slideCover: { ...defaultSlideCover },
        },
      ],
    }));
    setActiveLessonId(coverId);
  }

  function openPreview() {
    const lessonId = activeLessonId;
    const query = new URLSearchParams();
    if (lessonId) query.set("lessonId", lessonId);
    const queryString = query.toString();
    const previewPath = previewModeHref(
      courseId,
      slideCourse ? "presentation" : "standard",
    );
    openRouteAfterSave(
      `${previewPath}${queryString ? `?${queryString}` : ""}`,
    );
  }

  function addSection() {
    const id = newId();
    updateDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { id, title: "New section", order: current.sections.length },
      ],
    }));
  }

  function renameSection(id: string, title: string) {
    updateDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, title } : section,
      ),
    }));
  }

  function moveSection(id: string, direction: -1 | 1) {
    const sections = orderedSections;
    const index = sections.findIndex((section) => section.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    updateDraft((current) => ({
      ...current,
      sections: reordered.map((section, order) => ({ ...section, order })),
    }));
  }

  function duplicateSection(id: string) {
    const section = draftRef.current.sections.find((item) => item.id === id);
    if (!section) return;
    const copyId = newId();
    updateDraft((current) => {
      const sections = [
        ...current.sections,
        {
          ...section,
          id: copyId,
          title: `${section.title} copy`,
          order: current.sections.length,
        },
      ];
      const copies = current.lessons
        .filter((lesson) => lesson.sectionId === id)
        .map((lesson, index) => ({
          ...lesson,
          id: newId(),
          sectionId: copyId,
          order: index,
          blocks: duplicateLessonBlocks(lesson.blocks, newId),
          quizQuestions: lesson.quizQuestions.map((question) => ({
            ...question,
            id: newId(),
            choices: question.choices.map((choice) => ({
              ...choice,
              id: newId(),
            })),
          })),
        }));
      return { ...current, sections, lessons: [...current.lessons, ...copies] };
    });
  }

  function deleteSection(id: string) {
    if (draftRef.current.sections.length <= 1) return;
    const remaining = orderedSections.filter((section) => section.id !== id);
    const destinationId = remaining[0].id;
    updateDraft((current) => {
      const destinationLessons = current.lessons
        .filter(
          (lesson) =>
            lesson.sectionId === destinationId || lesson.sectionId === id,
        )
        .sort((a, b) => a.order - b.order)
        .map((lesson, order) => ({
          ...lesson,
          sectionId: destinationId,
          order,
        }));
      return {
        ...current,
        sections: remaining.map((section, order) => ({ ...section, order })),
        lessons: [
          ...current.lessons.filter(
            (lesson) =>
              lesson.sectionId !== id && lesson.sectionId !== destinationId,
          ),
          ...destinationLessons,
        ],
      };
    });
  }

  function addLesson(
    sectionId: string,
    lessonType: "content" | "quiz" = "content",
    blank = false,
  ) {
    const siblings = draftRef.current.lessons.filter(
      (item) => item.sectionId === sectionId,
    );
    const isQuiz = lessonType === "quiz";
    const lesson = {
      id: newId(),
      sectionId,
      title: isQuiz
        ? "New quiz"
        : slideCourse
          ? `Slide ${draftRef.current.lessons.length + 1}`
          : "New lesson",
      icon: isQuiz ? ("quiz" as const) : ("file" as const),
      lessonType,
      passingScore: 70,
      order: Math.max(-1, ...siblings.map((item) => item.order)) + 1,
      blocks: [] as ContentBlock[],
      quizQuestions: isQuiz && slideCourse ? [createQuizQuestion()] : [],
      ...(blank
        ? { slideAppearance: { hideHeader: true, hideFooter: true } }
        : {}),
    };
    pendingRouteRef.current = null;
    updateDraft((current) => ({
      ...current,
      lessons: [...current.lessons, lesson],
    }));
    void saveLatest();
    return lesson.id;
  }

  function duplicateLesson(id: string) {
    const source = draftRef.current.lessons.find((lesson) => lesson.id === id);
    if (!source) return;
    const siblings = draftRef.current.lessons.filter(
      (item) => item.sectionId === source.sectionId,
    );
    const lesson = {
      ...duplicateLessonContent(source, newId),
      order: Math.max(-1, ...siblings.map((item) => item.order)) + 1,
    };
    pendingRouteRef.current = null;
    updateDraft((current) => ({
      ...current,
      lessons: [...current.lessons, lesson],
    }));
    void saveLatest();
  }

  function moveLesson(id: string, sectionId: string) {
    pendingRouteRef.current = null;
    updateDraft((current) => moveLessonToSection(current, id, sectionId));
    void saveLatest();
  }

  function deleteLesson(id: string) {
    const removed = draftRef.current.lessons.find((lesson) => lesson.id === id);
    if (!removed) return;
    if (activeLessonId === id) {
      const next = draftRef.current.lessons.find((lesson) => lesson.id !== id);
      setActiveLessonId(next?.id ?? null);
    }
    updateDraft((current) => ({
      ...current,
      lessons: current.lessons
        .filter((lesson) => lesson.id !== id)
        .map((lesson) =>
          lesson.sectionId ===
            current.lessons.find((item) => item.id === id)?.sectionId &&
          lesson.order >
            (current.lessons.find((item) => item.id === id)?.order ?? 0)
            ? { ...lesson, order: lesson.order - 1 }
            : lesson,
        ),
    }));
  }

  function reorderLessons(sectionId: string, orderedIds: string[]) {
    const orderMap = new Map(orderedIds.map((id, order) => [id, order]));
    updateDraft((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) =>
        lesson.sectionId === sectionId
          ? { ...lesson, order: orderMap.get(lesson.id) ?? lesson.order }
          : lesson,
      ),
    }));
  }

  function changeLessonIcon(
    id: string,
    icon: NonNullable<Draft["lessons"][number]["icon"]>,
  ) {
    updateLesson(id, (lesson) => ({ ...lesson, icon }));
  }

  function updateLesson(
    id: string,
    change: (lesson: Draft["lessons"][number]) => Draft["lessons"][number],
  ) {
    updateDraft((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) =>
        lesson.id === id ? change(lesson) : lesson,
      ),
    }));
  }


  return {
    openLesson,
    addSlide,
    addQuizSlide,
    reorderSlides,
    duplicateSlide,
    deleteSlide,
    applyFirstSlideCover,
    openPreview,
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
  };
}
