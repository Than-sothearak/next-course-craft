"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { FilePlus2 } from "lucide-react";
import {
  type ContentBlock,
} from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { applyListTemplateToHtml } from "@/lib/editor/list-template";
import { Button } from "@/components/ui/button";
import { CourseOutline } from "../standard-mode/_components/course-outline";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import { BlockTemplatePicker } from "./(editor_client_components)/block-template-picker";
import { BlockManagerSidebar } from "../standard-mode/_components/block-manager-sidebar";
import {
  createBlocksFromTemplate,
  createSlideBlocksFromTemplate,
} from "./(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import type {
  BlockCategory,
  BlockTemplate,
} from "./(editor_client_components)/(block_template_picker_components)/block-template-data";
import { QuizEditor } from "../standard-mode/_components/quiz-editor";
import { PresentationQuizWorkspace } from "../presentation-mode/_components/presentation-quiz-workspace";
import { createQuizQuestion } from "@/lib/editor/quiz-question";
import { courseThemeFontFamilies } from "@/lib/editor/theme";
import type { GeneratedCourseDraft } from "@/lib/ai/course-generation-schemas";
import { CourseGenerationDialog } from "./(editor_client_components)/course-generation-dialog";
import { lessonEditorHref } from "@/lib/editor/lesson-location";
import { previewModeHref } from "@/lib/editor/course-routes";
import { applyProcessStepsPreset } from "@/lib/editor/process-steps";
import { useFocusedContentBlock } from "./(editor_client_components)/use-focused-content-block";
import {
  duplicateLessonBlocks,
  duplicateLessonContent,
  duplicatePresentationSlide,
  moveLessonToSection,
  removeLessonBlock,
  reorderPresentationSlides,
} from "@/lib/editor/course-content";
import type { Permission } from "@/lib/auth/policy";
import { createClientId } from "@/lib/client-id";
import { SlideEditorSidebar } from "../presentation-mode/_components/slide-presentation/slide-editor-sidebar";
import { EditorTopbar } from "../presentation-mode/_components/slide-presentation/editor-topbar";
import { PresentationSlideWorkspace } from "../presentation-mode/_components/presentation-slide-workspace";
import { blockTemplates } from "./(editor_client_components)/(block_template_picker_components)/block-template-data";
import { StandardLessonEditor } from "../standard-mode/_components/standard-lesson-editor";
import { CourseOverviewEditor } from "../standard-mode/_components/course-overview-editor";
import { CourseOverviewToolbar } from "./course-overview-toolbar";
import { migrateCoverAudio } from "@/lib/editor/audio-instruction";
import {
  defaultCanvasSlideFrame,
  defaultSlideCover,
  defaultSlideMaster,
  normalizeSlideLessonFrames,
  resolveSlideTextLayout,
} from "@/lib/editor/slide-design";
import { pasteSlideObject } from "@/lib/editor/slide-clipboard";

import { useEditorDraft, type Draft } from "./_components/use-editor-draft";
import { EditorSaveStatus } from "./_components/editor-save-status";

export type InitialData = { courseId: string } & EditorSnapshotInput;
type TemplatePickerState =
  | { mode: "add"; index: number; category: BlockCategory }
  | { mode: "replace"; blockId: string; category: BlockCategory };

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

function newId() {
  return createClientId();
}

function enableSlideTextFit(block: ContentBlock): ContentBlock {
  if (
    block.type !== "heading" &&
    block.type !== "richText" &&
    block.type !== "statement"
  )
    return block;
  return {
    ...block,
    slideTextLayout: {
      ...resolveSlideTextLayout(block.slideTextLayout),
      fitToText: true,
    },
  };
}

function getTemplateCategory(block: ContentBlock): BlockCategory {
  if (block.type === "statement") return "Statement";
  if (block.type === "heading") return "Text";
  if (block.type === "link") return "Link";
  if (block.type === "richText") {
    if (block.data.html.includes("<pre")) return "Code";
    if (block.data.html.includes("<blockquote")) return "Quote";
    if (block.data.html.includes("<ul") || block.data.html.includes("<ol"))
      return "List";
    return "Text";
  }
  if (block.type === "image") return "Image";
  if (block.type === "gallery") return "Gallery";
  if (
    block.type === "video" ||
    block.type === "audio" ||
    block.type === "audioInstruction"
  )
    return "Multimedia";
  if (block.type === "attachment") return "Attachment";
  if (block.type === "divider") return "Divider";
  if (
    block.type === "flipCard" ||
    block.type === "accordion" ||
    block.type === "labeledGraphic" ||
    block.type === "processSteps" ||
    block.type === "lessonMap" ||
    block.type === "balloonArcher" ||
    block.type === "peelToReveal" ||
    block.type === "hangingRopeCards"
  )
    return "Interactive";
  if (block.type === "chart") return "Chart";
  if (block.type === "knowledgeCheck") return "Knowledge check";
  return "Survey";
}

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
    onNavigate: router.push,
  });
  const [templatePicker, setTemplatePicker] =
    useState<TemplatePickerState | null>(null);
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

  function openLesson(id: string) {
    if (slideCourse) {
      setActiveLessonId(id);
      return;
    }
    openRouteAfterSave(lessonEditorHref(initialData.courseId, id, undefined, "standard"));
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
    const lessonId = slideCourse ? activeLessonId : null;
    const query = new URLSearchParams();
    if (lessonId) query.set("lessonId", lessonId);
    const queryString = query.toString();
    const previewPath = previewModeHref(
      initialData.courseId,
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

  function updateBlock(
    blockId: string,
    nextBlock: ContentBlock,
    options?: { recordHistory?: boolean },
  ) {
    if (!activeLesson) return;
    if (options?.recordHistory === false) {
      updateDraft(
        (current) => ({
          ...current,
          lessons: current.lessons.map((lesson) =>
            lesson.id === activeLesson.id
              ? {
                  ...lesson,
                  blocks: lesson.blocks.map((block) =>
                    block.id === blockId ? nextBlock : block,
                  ),
                }
              : lesson,
          ),
        }),
        options,
      );
      return;
    }
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: lesson.blocks.map((block) =>
        block.id === blockId ? nextBlock : block,
      ),
    }));
  }

  function openAddTemplatePicker(index: number) {
    setTemplatePicker({ mode: "add", index, category: "Text" });
  }

  function openReplaceTemplatePicker(block: ContentBlock) {
    setTemplatePicker({
      mode: "replace",
      blockId: block.id,
      category: getTemplateCategory(block),
    });
  }

  function applyTemplate(template: BlockTemplate) {
    const picker = templatePicker;
    if (!activeLesson || !picker) return;
    if (picker.mode === "add") {
      const insertedBlocks = (
        slideCourse ? createSlideBlocksFromTemplate : createBlocksFromTemplate
      )(template, newId(), {
        sections: draft.sections,
        lessons: draft.lessons,
      }).map((block, offset) =>
        slideCourse
          ? {
              ...enableSlideTextFit(block),
              blockPadding: Math.min(block.blockPadding, 12),
              slideFrame: defaultCanvasSlideFrame(
                activeLesson.blocks.length + offset,
                block.type,
                draft.slideMaster,
                Boolean(activeLesson.slideCover),
              ),
            }
          : block,
      );
      updateLesson(activeLesson.id, (lesson) => {
        const blocks = [...lesson.blocks];
        blocks.splice(
          Math.max(0, Math.min(picker.index, blocks.length)),
          0,
          ...insertedBlocks,
        );
        return { ...lesson, blocks };
      });
    } else {
      const existing = activeLesson.blocks.find(
        (block) => block.id === picker.blockId,
      );
      const replacement =
        existing &&
        createBlocksFromTemplate(template, existing.id, {
          sections: draft.sections,
          lessons: draft.lessons,
        })[0];
      if (!existing || !replacement) return;
      const slideReplacement = slideCourse
        ? enableSlideTextFit(replacement)
        : replacement;
      if (
        existing.type === "processSteps" &&
        slideReplacement.type === "processSteps"
      )
        slideReplacement.data = applyProcessStepsPreset(
          existing.data,
          slideReplacement.data,
        );
      if (
        existing.type === "richText" &&
        slideReplacement.type === "richText" &&
        template.category === "List"
      ) {
        slideReplacement.data.html = applyListTemplateToHtml(
          existing.data.html,
          template.html ?? "",
        );
      }
      updateBlock(existing.id, {
        ...slideReplacement,
        slideFrame: existing.slideFrame,
        slideAnimation: existing.slideAnimation,
        requiredForProgress:
          existing.requiredForProgress ??
          slideReplacement.requiredForProgress ??
          true,
        width: existing.width,
        widthCustom: existing.widthCustom,
        backgroundColor: existing.backgroundColor,
        blockPadding: existing.blockPadding,
        headingPadding: existing.headingPadding,
      });
    }
    setTemplatePicker(null);
  }

  function addSlideObject(templateId: string) {
    if (!activeLesson) return null;
    const template = blockTemplates.find((item) => item.id === templateId);
    if (!template) return null;
    const blocks = createSlideBlocksFromTemplate(template, newId(), {
      sections: draft.sections,
      lessons: draft.lessons,
    });
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: [
        ...lesson.blocks,
        ...blocks.map((block, offset) => ({
          ...enableSlideTextFit(block),
          blockPadding: Math.min(block.blockPadding, 12),
          slideFrame: defaultCanvasSlideFrame(
            lesson.blocks.length + offset,
            block.type,
            draft.slideMaster,
            Boolean(lesson.slideCover),
          ),
        })),
      ],
    }));
    return blocks[0]?.id ?? null;
  }

  function reorderBlocks(event: DragEndEvent) {
    if (!activeLesson || !event.over || event.active.id === event.over.id)
      return;
    const from = activeLesson.blocks.findIndex(
      (block) => `block-${block.id}` === event.active.id,
    );
    const to = activeLesson.blocks.findIndex(
      (block) => `block-${block.id}` === event.over?.id,
    );
    if (from < 0 || to < 0) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: arrayMove(lesson.blocks, from, to),
    }));
  }

  function reorderBlocksFromManager(fromIndex: number, toIndex: number) {
    if (!activeLesson || fromIndex === toIndex) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: arrayMove(lesson.blocks, fromIndex, toIndex),
    }));
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    if (!activeLesson) return;
    updateLesson(activeLesson.id, (lesson) => {
      const from = lesson.blocks.findIndex((block) => block.id === blockId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= lesson.blocks.length) return lesson;
      return { ...lesson, blocks: arrayMove(lesson.blocks, from, to) };
    });
  }

  function duplicateBlock(blockId: string) {
    if (!activeLesson) return;
    const source = activeLesson.blocks.find((block) => block.id === blockId);
    if (!source) return;
    const copy = {
      ...source,
      id: newId(),
      ...(slideCourse && source.slideFrame
        ? {
            slideFrame: {
              ...source.slideFrame,
              x: Math.min(
                100 - source.slideFrame.width,
                source.slideFrame.x + 3,
              ),
              y: Math.min(
                100 - source.slideFrame.height,
                source.slideFrame.y + 3,
              ),
              z: Math.min(500, source.slideFrame.z + 1),
            },
          }
        : {}),
    } as ContentBlock;
    updateLesson(activeLesson.id, (lesson) => {
      const index = lesson.blocks.findIndex((block) => block.id === blockId);
      const blocks = [...lesson.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...lesson, blocks };
    });
  }

  function pastePresentationObject(source: ContentBlock): string {
    const lesson = draftRef.current.lessons.find(
      (item) => item.id === activeLessonId,
    );
    if (!slideCourse || !lesson || lesson.lessonType === "quiz")
      throw new Error("Choose a content slide before pasting an object.");
    if (lesson.slideCover && source.type !== "audioInstruction")
      throw new Error(
        "A cover slide can contain only audio instruction objects.",
      );
    if (lesson.blocks.length >= 500)
      throw new Error("A slide can contain up to 500 objects.");
    const copy = pasteSlideObject(source, lesson.blocks, newId);
    updateDraft((current) => ({
      ...current,
      lessons: current.lessons.map((item) =>
        item.id === lesson.id
          ? { ...item, blocks: [...item.blocks, copy] }
          : item,
      ),
    }));
    return copy.id;
  }

  function deleteBlock(blockId: string) {
    if (!activeLesson) return;
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: removeLessonBlock(lesson.blocks, blockId),
    }));
  }

  function renderOutline() {
    return (
      <CourseOutline
        currentCourseId={initialData.courseId}
        sections={draft.sections}
        lessons={draft.lessons}
        activeLessonId={activeLessonId}
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
  const publishDisabledReason = isDraftSaved
    ? undefined
    : "Save all course edits before publishing.";
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
          courseId={initialData.courseId}
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
          onForward={() => router.forward()}
          onUndo={undo}
          onRedo={redo}
          onGenerate={() => setCourseGenerationOpen(true)}
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
          courseId={initialData.courseId}
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
              {activeLesson ? (
                slideCourse && activeLesson.lessonType !== "quiz" ? (
                  <PresentationSlideWorkspace
                    lesson={activeLesson}
                    slides={slides}
                    courseId={initialData.courseId}
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
                    courseId={initialData.courseId}
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
                    courseId={initialData.courseId}
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
      <CourseGenerationDialog
        open={courseGenerationOpen}
        onClose={() => setCourseGenerationOpen(false)}
        courseId={initialData.courseId}
        courseTitle={draft.title}
        courseDescription={draft.description}
        existingLessonCount={draft.lessons.length}
        onApply={applyGeneratedCourse}
      />
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
