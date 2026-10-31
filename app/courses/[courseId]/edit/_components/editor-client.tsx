"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence } from "framer-motion";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  LoaderCircle,
  List,
  Plus,
  Redo2,
  Presentation,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { applyListTemplateToHtml } from "@/lib/editor/list-template";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import { Textarea } from "@/components/ui/textarea";
import { DashboardNavbar } from "@/app/dashboard/_components/dashboard-navbar";
import { CourseOutline } from "./(editor_client_components)/course-outline";
import { ContentBlockEditor } from "./(editor_client_components)/content-block-editor";
import { LessonTitleEditor } from "./(editor_client_components)/(text_editing_components)/lesson-title-editor";
import { StatementTextEditor } from "./(editor_client_components)/(text_editing_components)/statement-text-editor";
import { SortableItem } from "./(editor_client_components)/sortable-item";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import { BlockFormatMenu } from "./(editor_client_components)/block-format-menu";
import { BlockManagerSidebar } from "./(editor_client_components)/block-manager-sidebar";
import { BlockTemplatePicker } from "./(editor_client_components)/block-template-picker";
import { createBlocksFromTemplate } from "./(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import type { BlockCategory, BlockTemplate } from "./(editor_client_components)/(block_template_picker_components)/block-template-data";
import { QuizEditor } from "./(editor_client_components)/quiz-editor";
import { CourseThemeSettings } from "./(editor_client_components)/course-theme-settings";
import { CourseNavigationSettings } from "./(editor_client_components)/course-navigation-settings";
import { courseThemeFontFamilies } from "@/lib/editor/theme";
import type { GeneratedCourseDraft } from "@/lib/ai/course-generation-schemas";
import { CourseGenerationDialog } from "./(editor_client_components)/course-generation-dialog";
import { editorBlockElementId } from "@/lib/editor/lesson-location";
import { applyProcessStepsPreset } from "@/lib/editor/process-steps";
import { useFocusedContentBlock } from "./(editor_client_components)/use-focused-content-block";
import { duplicateLessonBlocks, duplicateLessonContent, moveLessonToSection, removeLessonBlock, reorderPresentationSlides } from "@/lib/editor/course-content";
import type { Permission } from "@/lib/auth/policy";
import { createClientId } from "@/lib/client-id";
import { SlideEditorStage } from "./slide-presentation/slide-editor-stage";
import { SlideEditorSidebar } from "./slide-presentation/slide-editor-sidebar";
import { SlideInspectorTabs } from "./slide-presentation/slide-inspector-tabs";
import { SlideMasterPanel } from "./slide-presentation/slide-master-panel";
import { SlideCoverPanel } from "./slide-presentation/slide-cover-panel";
import { SlideObjectWorkspace } from "./slide-presentation/slide-object-workspace";
import { SlideEditorNavigation } from "./slide-presentation/slide-editor-navigation";
import { blockTemplates } from "./(editor_client_components)/(block_template_picker_components)/block-template-data";
import { migrateCoverAudio } from "@/lib/editor/audio-instruction";
import { defaultSlideCover, defaultSlideFrame } from "@/lib/editor/slide-design";

import { useEditorDraft, type Draft } from "./_components/use-editor-draft";

type InitialData = { courseId: string } & EditorSnapshotInput;
type TemplatePickerState =
  | { mode: "add"; index: number; category: BlockCategory }
  | { mode: "replace"; blockId: string; category: BlockCategory };

function newId() {
  return createClientId();
}

function contrastTextColor(hex: string) {
  const channels = hex
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return "#111827";
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.06;
  return whiteContrast > darkContrast ? "#ffffff" : "#111827";
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
  if (block.type === "video" || block.type === "audio" || block.type === "audioInstruction") return "Multimedia";
  if (block.type === "attachment") return "Attachment";
  if (block.type === "divider") return "Divider";
  if (block.type === "flipCard" || block.type === "accordion" || block.type === "labeledGraphic" || block.type === "processSteps" || block.type === "lessonMap") return "Interactive";
  if (block.type === "chart") return "Chart";
  if (block.type === "knowledgeCheck") return "Knowledge check";
  return "Survey";
}

export function EditorClient({
  initialData,
  focusedLessonId,
  focusedBlockId,
  authorName,
  userName,
  permissions = [],
  globalPermissions = [],
}: {
  initialData: InitialData;
  focusedLessonId?: string;
  focusedBlockId?: string;
  authorName: string;
  userName?: string;
  permissions?: Permission[];
  globalPermissions?: Permission[];
}) {
  useDismissDetailsOnOutsideClick();
  const router = useRouter();
  const blockDndId = `lesson-blocks-${useId().replaceAll(":", "")}`;
  const initialDraft: Draft = {
    title: initialData.title,
    description: initialData.description,
    descriptionHtml: initialData.descriptionHtml,
    authorVisible: initialData.authorVisible,
    theme: initialData.theme,
    navigationMode: initialData.navigationMode ?? defaultCourseNavigationMode,
    courseLayout: initialData.courseLayout,
    slideMaster: initialData.slideMaster,
    sections: initialData.sections,
    lessons: initialData.lessons.map(migrateCoverAudio),
  };
  const [activeLessonId, setSelectedLessonId] = useState<string | null>(
    focusedLessonId ?? (initialData.courseLayout === "slides" ? initialData.lessons[0]?.id ?? null : null),
  );
  const [blockManagerOpen, setBlockManagerOpen] = useState(false);
  const [slideZoom, setSlideZoom] = useState<number | undefined>(undefined);
  const [titleValid, setTitleValid] = useState(true);
  const titleValidRef = useRef(true);
  const { draft, draftRef, pendingRouteRef, canUndo, canRedo, saveState, saveMessage, hasUnsavedChanges, updateDraft, openRouteAfterSave, undo, redo, saveLatest, clearSaveError } = useEditorDraft({ initialDraft, initialRevision: initialData.revision, courseId: initialData.courseId, titleValid, titleValidRef, onNavigate: router.push });
  const courseTitleRef = useRef<HTMLTextAreaElement>(null);
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
  const slides = orderedSections.flatMap((section) => draft.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order));
  const blockSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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

  useEffect(() => {
    const textarea = courseTitleRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "0px";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draft.title]);

  function openLesson(id: string) {
    if (slideCourse) { setActiveLessonId(id); return; }
    openRouteAfterSave(`/courses/${initialData.courseId}/edit/lessons/${id}`);
  }

  function addSlide(sectionId: string) {
    setActiveLessonId(addLesson(sectionId));
  }

  function reorderSlides(activeId: string, overId: string) {
    updateDraft((current) => reorderPresentationSlides(current, activeId, overId));
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
    if (existing) { setActiveLessonId(existing.id); return; }
    const first = slides[0];
    if (!first) return;
    if (first.lessonType !== "quiz" && !first.blocks.length) {
      updateLesson(first.id, (lesson) => ({ ...lesson, slideCover: { ...defaultSlideCover } }));
      setActiveLessonId(first.id);
      return;
    }
    const coverId = newId();
    updateDraft((current) => ({
      ...current,
      lessons: [
        ...current.lessons.map((lesson) => lesson.sectionId === first.sectionId ? { ...lesson, order: lesson.order + 1 } : lesson),
        { id: coverId, sectionId: first.sectionId, title: "Cover", icon: "file" as const, lessonType: "content" as const, passingScore: 70, quizQuestions: [], order: 0, blocks: [] as ContentBlock[], slideCover: { ...defaultSlideCover } },
      ],
    }));
    setActiveLessonId(coverId);
  }

  function openPreview() {
    const lessonId = slideCourse ? activeLessonId : null;
    const lessonQuery = lessonId ? `?lessonId=${encodeURIComponent(lessonId)}` : "";
    openRouteAfterSave(`/courses/${initialData.courseId}/preview${lessonQuery}`);
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
  ) {
    const siblings = draftRef.current.lessons.filter(
      (item) => item.sectionId === sectionId,
    );
    const isQuiz = lessonType === "quiz";
    const lesson = {
      id: newId(),
      sectionId,
      title: isQuiz ? "New quiz" : slideCourse ? `Slide ${draftRef.current.lessons.length + 1}` : "New lesson",
      icon: isQuiz ? ("quiz" as const) : ("file" as const),
      lessonType,
      passingScore: 70,
      order: Math.max(-1, ...siblings.map((item) => item.order)) + 1,
      blocks: [] as ContentBlock[],
      quizQuestions: [],
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

  function updateBlock(blockId: string, nextBlock: ContentBlock) {
    if (!activeLesson) return;
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
      const insertedBlocks = createBlocksFromTemplate(template, newId(), {
        sections: draft.sections,
        lessons: draft.lessons,
      }).map((block, offset) => slideCourse ? { ...block, blockPadding: Math.min(block.blockPadding, 12), slideFrame: defaultSlideFrame(activeLesson.blocks.length + offset, block.type) } : block);
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
        existing && createBlocksFromTemplate(template, existing.id, {
          sections: draft.sections,
          lessons: draft.lessons,
        })[0];
      if (!existing || !replacement) return;
      if (existing.type === "processSteps" && replacement.type === "processSteps")
        replacement.data = applyProcessStepsPreset(existing.data, replacement.data);
      if (
        existing.type === "richText" &&
        replacement.type === "richText" &&
        template.category === "List"
      ) {
        replacement.data.html = applyListTemplateToHtml(
          existing.data.html,
          template.html ?? "",
        );
      }
      updateBlock(existing.id, {
        ...replacement,
        slideFrame: existing.slideFrame,
        requiredForProgress: existing.requiredForProgress ?? replacement.requiredForProgress ?? true,
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
    const blocks = createBlocksFromTemplate(template, newId(), { sections: draft.sections, lessons: draft.lessons });
    updateLesson(activeLesson.id, (lesson) => ({
      ...lesson,
      blocks: [...lesson.blocks, ...blocks.map((block, offset) => ({ ...block, blockPadding: Math.min(block.blockPadding, 12), slideFrame: defaultSlideFrame(lesson.blocks.length + offset, block.type) }))],
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
    const copy = { ...source, id: newId(), ...(slideCourse && source.slideFrame ? { slideFrame: { ...source.slideFrame, x: Math.min(100 - source.slideFrame.width, source.slideFrame.x + 3), y: Math.min(100 - source.slideFrame.height, source.slideFrame.y + 3), z: Math.min(500, source.slideFrame.z + 1) } } : {}) } as ContentBlock;
    updateLesson(activeLesson.id, (lesson) => {
      const index = lesson.blocks.findIndex((block) => block.id === blockId);
      const blocks = [...lesson.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...lesson, blocks };
    });
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

  const stateIcon =
    saveState === "saving" ? (
      <LoaderCircle size={15} className="animate-spin" />
    ) : saveState === "error" || saveState === "conflict" ? (
      <CircleAlert size={15} />
    ) : (
      <Check size={15} />
    );
  const isCourseOverview = !focusedLessonId && !activeLesson;
  const stateLabel = !titleValid
    ? isCourseOverview
      ? "Check course title"
      : "Check lesson title"
    : saveState === "saving"
      ? "Saving changes"
      : saveState === "error"
        ? "Save failed"
        : saveState === "conflict"
          ? "Conflict"
          : "All changes saved";
  const isQuizLesson = activeLesson?.lessonType === "quiz";
  const isDraftSaved =
    saveState === "saved" && titleValid && !hasUnsavedChanges;
  const publishDisabledReason = isDraftSaved
    ? undefined
    : "Save all course edits before publishing.";
  const authorInitials =
    authorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA";
  const courseStyle = {
    "--course-primary": draft.theme.primaryColor,
    "--course-accent": draft.theme.accentColor,
  } as CSSProperties;

  return (
    <main
      style={courseStyle}
      className={`min-h-screen text-slate-900 ${isCourseOverview || isQuizLesson ? "bg-white" : "bg-slate-100"}`}
    >
      {isCourseOverview && (
        <DashboardNavbar
          permissions={globalPermissions}
          userName={userName ?? authorName}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={navigateBack}
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft size={17} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => router.forward()}
                aria-label="Forward"
                title="Forward"
              >
                <ArrowRight size={17} />
              </Button>
            </>
          }
          primaryAction={
            <div className="flex items-center gap-2">
              {slideCourse && <>
                <Button type="button" variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></Button>
              </>}
              {permissions.includes("ai.generate") && <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Generate content"
                title="Generate content"
                onClick={() => setCourseGenerationOpen(true)}
              >
                <Sparkles size={15} />
                <span className="hidden sm:inline">Generate content</span>
                <span className="sm:hidden">Generate</span>
              </Button>}
              <CourseThemeSettings
                courseId={initialData.courseId}
                courseTitle={draft.title}
                theme={draft.theme}
                onChange={(theme) =>
                  updateDraft((current) => ({ ...current, theme }))
                }
              />
              <CourseNavigationSettings
                navigationMode={draft.navigationMode}
                onChange={(navigationMode) =>
                  updateDraft((current) => ({ ...current, navigationMode }))
                }
              />
              {permissions.includes("courses.publish") && permissions.includes("courses.export") && <PublishMenu
                courseId={initialData.courseId}
                title={draft.title}
                disabled={!isDraftSaved}
                disabledReason={publishDisabledReason}
              />}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openPreview}
              >
                <Eye size={15} />
                Preview
              </Button>
            </div>
          }
        />
      )}
      {!isCourseOverview && (
        <header data-presentation-editor-header={slideCourse || undefined} className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className={slideCourse ? "flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-5" : "flex min-h-[68px] flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6 sm:py-0"}>
            <div className={slideCourse ? "flex min-w-0 flex-1 basis-40 items-center gap-2" : "flex min-w-0 items-center gap-3"}>
              {activeLesson && !focusedLessonId ? (
                <button
                  type="button"
                  onClick={() => setActiveLessonId(null)}
                  aria-label={slideCourse ? "Presentation settings" : "Back to course outline"}
                  className="cursor-pointer grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <Link
                  href={
                    focusedLessonId
                      ? `/courses/${initialData.courseId}/edit`
                      : "/dashboard"
                  }
                  aria-label={
                    focusedLessonId ? "Back to course" : "Back to dashboard"
                  }
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowLeft size={18} />
                </Link>
              )}
              {slideCourse && <span className="hidden size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 sm:grid"><Presentation size={17} strokeWidth={1.75} aria-hidden="true" /></span>}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                  {slideCourse ? "Presentation editor" : "Coursecraft authoring"}
                </p>
                <p className="truncate text-sm font-semibold">
                  {activeLesson?.title ?? draft.title}
                </p>
              </div>
            </div>
            <div aria-label={slideCourse ? "Presentation editor actions" : undefined} className={slideCourse ? "flex max-w-full shrink-0 items-center gap-1" : "flex max-w-full flex-wrap items-center gap-1 sm:gap-2"}>
              {activeLesson && activeLesson.lessonType !== "quiz" && (
                <Button
                  type="button"
                  variant={blockManagerOpen ? "secondary" : slideCourse ? "ghost" : "outline"}
                  size="sm"
                  aria-label="Manage blocks"
                  aria-expanded={blockManagerOpen}
                  aria-controls="lesson-block-manager"
                  onClick={() => setBlockManagerOpen((open) => !open)}
                  className={slideCourse ? "size-8 min-h-0 rounded-md p-0 text-slate-600" : "h-9 px-2 sm:px-3"}
                >
                  <List size={16} aria-hidden="true" />
                  <span className={slideCourse ? "sr-only" : "hidden sm:inline"}>Manage blocks</span>
                </Button>
              )}
              <CourseThemeSettings
                courseId={initialData.courseId}
                courseTitle={draft.title}
                theme={draft.theme}
                compact={slideCourse}
                onChange={(theme) =>
                  updateDraft((current) => ({ ...current, theme }))
                }
              />
              <CourseNavigationSettings
                navigationMode={draft.navigationMode}
                compact={slideCourse}
                onChange={(navigationMode) =>
                  updateDraft((current) => ({ ...current, navigationMode }))
                }
              />
              <div role="group" aria-label="Edit history" className={slideCourse ? "mx-1 flex items-center border-x border-slate-200 px-1" : "flex items-center"}>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo"
                title="Undo"
                className={slideCourse ? "size-8 rounded-md text-slate-500" : undefined}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Redo"
                title="Redo"
                className={slideCourse ? "size-8 rounded-md text-slate-500" : undefined}
              >
                <Redo2 size={16} />
              </Button>
              </div>
              <Button
                type="button"
                variant={slideCourse ? "default" : "outline"}
                size="sm"
                aria-label="Preview"
                title={slideCourse ? "Preview presentation" : "Preview course"}
                className={slideCourse ? "size-8 min-h-0 rounded-md p-0 shadow-none" : undefined}
                onClick={openPreview}
              >
                <Eye size={16} aria-hidden="true" />
                <span className={slideCourse ? "sr-only" : undefined}>Preview</span>
              </Button>
            </div>
          </div>
          {(saveState === "error" || saveState === "conflict") && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800 sm:px-6"
            >
              <span>{saveMessage}</span>
              {saveState === "conflict" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload course
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void saveLatest()}
                >
                  Retry save
                </Button>
              )}
            </div>
          )}
        </header>
      )}
      {isCourseOverview && (
        <div
          role="status"
          aria-live="polite"
          title={stateLabel}
          className={`fixed right-5 top-[76px] z-30 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs shadow-sm ${saveState === "error" || saveState === "conflict" || !titleValid ? "text-rose-700" : "text-slate-500"}`}
        >
          {stateIcon}
          <span className="sr-only">{stateLabel}</span>
        </div>
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
        className={`mx-auto w-full ${isCourseOverview ? "max-w-[880px] px-5 pb-16 pt-7 sm:px-8 sm:pt-8" : focusedLessonId ? "max-w-none pb-40" : "max-w-none px-3 py-4 sm:px-5 lg:px-8"}`}
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
          className={`grid gap-4 ${slideCourse || (!focusedLessonId && activeLesson) ? "lg:grid-cols-[270px_minmax(0,1fr)]" : "grid-cols-1"}`}
        >
          {slideCourse ? (
            <SlideEditorSidebar slides={slides} activeId={activeLesson?.id ?? null} master={draft.slideMaster} courseTitle={draft.title} onSelect={openLesson} onAdd={() => addSlide(activeLesson?.sectionId ?? orderedSections[0].id)} onDelete={deleteSlide} onReorder={reorderSlides} />
          ) : !focusedLessonId && activeLesson && (
            <aside className="sticky top-[84px] hidden max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 lg:block">
              {renderOutline()}
            </aside>
          )}

          <section className="min-w-0" aria-label={slideCourse ? "Slide canvas" : "Lesson canvas"}>
            <div
              className={`mx-auto w-full ${isCourseOverview ? "max-w-[840px]" : "max-w-none"}`}
            >
              {isCourseOverview && (
                <div className="mb-0">
                  <label className="block">
                    <span className="sr-only">Course title</span>
                    <Textarea
                      ref={courseTitleRef}
                      aria-label="Course title"
                      aria-invalid={!titleValid}
                      aria-describedby={
                        !titleValid ? "course-title-error" : undefined
                      }
                      rows={1}
                      value={draft.title}
                      onChange={(event) => {
                        const title = event.target.value;
                        const valid = title.trim().length > 0;
                        titleValidRef.current = valid;
                        setTitleValid(valid);
                        clearSaveError();
                        updateDraft((current) => ({
                          ...current,
                          title,
                        }));
                      }}
                      placeholder="Enter your course title"
                      maxLength={160}
                      className="h-auto min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-none border-0 bg-transparent px-0 py-0 text-[36px] font-bold leading-[1.08] tracking-[-0.035em] text-black shadow-none outline-none placeholder:text-slate-300 focus-visible:ring-0 [overflow-wrap:anywhere] sm:text-[44px]"
                    />
                  </label>
                  {!titleValid && (
                    <p
                      id="course-title-error"
                      role="alert"
                      className="mt-2 text-sm text-rose-700"
                    >
                      Enter a course title before saving.
                    </p>
                  )}
                  <div className="mt-6 flex min-h-11 items-center gap-2.5">
                    {draft.authorVisible ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium text-white"
                          style={{ backgroundColor: "var(--course-accent)" }}
                        >
                          {authorInitials}
                        </span>
                        <span className="max-w-[240px] truncate text-sm font-medium text-slate-500">
                          {authorName}
                        </span>
                        <details className="relative">
                          <summary
                            aria-label="Author options"
                            className="grid size-7 cursor-pointer list-none place-items-center rounded-md text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                          >
                            <ChevronDown size={15} />
                          </summary>
                          <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              aria-pressed="true"
                              onClick={() =>
                                updateDraft((current) => ({
                                  ...current,
                                  authorVisible: false,
                                }))
                              }
                              className="cursor-pointer flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <EyeOff size={13} />
                              Hide author
                            </button>
                          </div>
                        </details>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            authorVisible: true,
                          }))
                        }
                      >
                        <Eye size={15} />
                        Show author
                      </Button>
                    )}
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-14 h-[5px] w-44"
                    style={{ backgroundColor: "var(--course-primary)" }}
                  />
                  <div className="mt-[4.5rem] text-[16px] leading-[2.2] text-[#202124]">
                    <StatementTextEditor
                      id="course-description"
                      label="Edit course description"
                      tag="p"
                      placeholder="Describe what learners will learn and who this course is for…"
                      html={draft.descriptionHtml}
                      text={draft.description}
                      className="text-[16px] leading-[2.2]"
                      onChange={(descriptionHtml, description) =>
                        updateDraft((current) => ({
                          ...current,
                          description,
                          descriptionHtml,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
              {activeLesson ? (
                slideCourse && activeLesson.lessonType !== "quiz" ? (
                  <SlideObjectWorkspace
                    controls={<SlideEditorNavigation key={activeLesson.id} slides={slides} selectedId={activeLesson.id} onSelect={openLesson} guide={draft.slideMaster?.navigationGuide} />}
                    key={activeLesson.id}
                    title={activeLesson.title}
                    courseTitle={draft.title}
                    slideNumber={slides.findIndex((slide) => slide.id === activeLesson.id) + 1}
                    slideCount={slides.length}
                    blocks={activeLesson.blocks}
                    sections={draft.sections}
                    lessons={draft.lessons}
                    master={draft.slideMaster}
                    cover={activeLesson.slideCover}
                    hasCover={slides.some((slide) => Boolean(slide.slideCover))}
                    courseId={initialData.courseId}
                    zoom={slideZoom}
                    onZoomChange={setSlideZoom}
                    onTitleChange={(title) => updateLesson(activeLesson.id, (lesson) => ({ ...lesson, title }))}
                    onMasterChange={(slideMaster) => updateDraft((current) => ({ ...current, slideMaster }))}
                    onCoverChange={(slideCover) => updateLesson(activeLesson.id, (lesson) => ({ ...lesson, slideCover }))}
                    onApplyCover={applyFirstSlideCover}
                    onCourseTitleChange={(title) => updateDraft((current) => ({ ...current, title }))}
                    onStart={slides.findIndex((slide) => slide.id === activeLesson.id) < slides.length - 1 ? () => openLesson(slides[slides.findIndex((slide) => slide.id === activeLesson.id) + 1].id) : undefined}
                    onBlockChange={(block) => updateBlock(block.id, block)}
                    onApplyBorderRadiusToAll={(slideBorderRadius) => updateDraft((current) => ({ ...current, lessons: current.lessons.map((lesson) => ({ ...lesson, blocks: lesson.blocks.map((block) => ({ ...block, slideBorderRadius })) })) }))}
                    onAddTemplate={addSlideObject}
                    onMoreTemplates={() => openAddTemplatePicker(activeLesson.blocks.length)}
                    onReplaceTemplate={openReplaceTemplatePicker}
                    onDuplicate={duplicateBlock}
                    onDelete={deleteBlock}
                  />
                ) : activeLesson.lessonType === "quiz" ? (
                  <>
                  <SlideEditorStage active={slideCourse} master={draft.slideMaster} number={slides.findIndex((slide) => slide.id === activeLesson.id) + 1} total={slides.length} controls={slideCourse ? <SlideEditorNavigation key={activeLesson.id} slides={slides} selectedId={activeLesson.id} onSelect={openLesson} guide={draft.slideMaster?.navigationGuide} /> : undefined} size={draft.slideMaster?.size} title={activeLesson.title} zoom={slideZoom} onZoomChange={setSlideZoom} inspector={slideCourse ? <SlideInspectorTabs master={<SlideMasterPanel value={draft.slideMaster} courseId={initialData.courseId} onChange={(slideMaster) => updateDraft((current) => ({ ...current, slideMaster }))} />} cover={<SlideCoverPanel hasCover={slides.some((slide) => Boolean(slide.slideCover))} courseId={initialData.courseId} courseTitle={draft.title} onTitleChange={(title) => updateDraft((current) => ({ ...current, title }))} onChange={() => {}} onOpenCover={applyFirstSlideCover} />}>
                    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Select a question on the quiz canvas to edit its prompt, choices, and feedback.</section>
                  </SlideInspectorTabs> : undefined}>
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
                  </SlideEditorStage>
                  </>
                ) : (
                  <>
                    <SlideEditorStage active={slideCourse} master={draft.slideMaster} number={slides.findIndex((slide) => slide.id === activeLesson.id) + 1} total={slides.length} controls={slideCourse ? <SlideEditorNavigation key={activeLesson.id} slides={slides} selectedId={activeLesson.id} onSelect={openLesson} guide={draft.slideMaster?.navigationGuide} /> : undefined} size={draft.slideMaster?.size} title={activeLesson.title} zoom={slideZoom} onZoomChange={setSlideZoom}>
                    <LessonTitleEditor
                      key={activeLesson.id}
                      compact={slideCourse}
                      title={activeLesson.title}
                      html={activeLesson.titleHtml}
                      onChange={(title, titleHtml) =>
                        updateLesson(activeLesson.id, (lesson) => ({
                          ...lesson,
                          title,
                          titleHtml,
                        }))
                      }
                      onValidityChange={(valid) => {
                        titleValidRef.current = valid;
                        setTitleValid(valid);
                      }}
                    />
                    <DndContext
                      id={blockDndId}
                      sensors={blockSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={reorderBlocks}
                    >
                      <SortableContext
                        items={activeLesson.blocks.map(
                          (block) => `block-${block.id}`,
                        )}
                        strategy={verticalListSortingStrategy}
                      >
                        <div>
                          <AnimatePresence initial={false}>
                            {activeLesson.blocks.map((block, index) => {
                              const contentWidth = block.widthCustom
                                ? block.width
                                : defaultBlockWidthForBlock(block);
                              const widthClass =
                                contentWidth === "small"
                                  ? "max-w-[520px]"
                                  : contentWidth === "medium"
                                    ? "max-w-[720px]"
                                    : "max-w-[920px]";
                              const blockPadding =
                                block.blockPadding ??
                                defaultBlockPaddingForBlock(block);
                              const headingPaddingClass = {
                                none: "",
                                small: "px-2 py-1",
                                medium: "px-4 py-2",
                                large: "px-8 py-4",
                              }[block.headingPadding ?? "none"];
                              return (
                                <SortableItem
                                  key={block.id}
                                  id={`block-${block.id}`}
                                  className="relative w-full"
                                  overlayHandle
                                  animateLayout
                                  exit
                                >
                                  <div className="group/boundary absolute -top-1.5 inset-x-0 z-40 h-3">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      aria-label="Add block"
                                      title="Add block"
                                      onClick={() =>
                                        openAddTemplatePicker(index)
                                      }
                                      className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0 opacity-0 shadow-sm transition-opacity group-hover/boundary:opacity-100 group-focus-within/boundary:opacity-100"
                                    >
                                      <Plus size={14} />
                                    </Button>
                                  </div>
                                  <div
                                    id={editorBlockElementId(block.id)}
                                    data-editor-block-id={block.id}
                                    tabIndex={-1}
                                    className="group/block-content relative min-w-0 flex-1 scroll-mt-24 outline-none focus-within:ring-2 focus-within:ring-indigo-200"
                                  >
                                    <div
                                      aria-hidden="true"
                                      className="pointer-events-none absolute inset-0 z-10 border border-dashed border-slate-400 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100"
                                    />
                                    <div className="absolute right-4 top-3 z-40 flex items-center gap-1 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => moveBlock(block.id, -1)}
                                        disabled={index === 0}
                                        aria-label="Move block up"
                                        title="Move block up"
                                        className="size-8"
                                      >
                                        <ArrowUp size={14} />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => moveBlock(block.id, 1)}
                                        disabled={
                                          index ===
                                          activeLesson.blocks.length - 1
                                        }
                                        aria-label="Move block down"
                                        title="Move block down"
                                        className="size-8"
                                      >
                                        <ArrowDown size={14} />
                                      </Button>
                                      <BlockFormatMenu
                                        block={block}
                                        onChange={(next) =>
                                          updateBlock(block.id, next)
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => duplicateBlock(block.id)}
                                        aria-label="Duplicate block"
                                        className="size-8"
                                      >
                                        <Copy size={14} />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteBlock(block.id)}
                                        aria-label="Delete block"
                                        className="size-8 text-slate-400 hover:text-rose-700"
                                      >
                                        <Trash2 size={15} />
                                      </Button>
                                    </div>
                                    <div
                                      className="w-full"
                                      style={{
                                        backgroundColor: block.backgroundColor,
                                        color: contrastTextColor(
                                          block.backgroundColor,
                                        ),
                                        paddingTop: `${slideCourse ? Math.min(blockPadding, 14) : blockPadding}px`,
                                        paddingBottom: `${slideCourse ? Math.min(blockPadding, 14) : blockPadding}px`,
                                      }}
                                    >
                                      <div
                                        className={`mx-auto w-full ${widthClass} px-4 transition-all duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
                                      >
                                        <div
                                          className={
                                            block.type === "heading"
                                              ? headingPaddingClass
                                              : ""
                                          }
                                        >
                                          <ContentBlockEditor
                                            block={block}
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
                                            onChange={(next) =>
                                              updateBlock(block.id, next)
                                            }
                                            onReplaceTemplate={() =>
                                              openReplaceTemplatePicker(block)
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {index === activeLesson.blocks.length - 1 && (
                                    <div className="group/boundary absolute -bottom-1.5 inset-x-0 z-40 h-3">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Add block"
                                        title="Add block"
                                        onClick={() =>
                                          openAddTemplatePicker(
                                            activeLesson.blocks.length,
                                          )
                                        }
                                        className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0 opacity-0 shadow-sm transition-opacity group-hover/boundary:opacity-100 group-focus-within/boundary:opacity-100"
                                      >
                                        <Plus size={14} />
                                      </Button>
                                    </div>
                                  )}
                                </SortableItem>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </SortableContext>
                    </DndContext>
                    {!activeLesson.blocks.length && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                        <p className="font-medium text-slate-800">
                          {slideCourse ? "Build this slide one block at a time" : "Build this lesson one block at a time"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Add a text block, heading, or media link to begin.
                        </p>
                      </div>
                    )}
                    <div className="mt-5 flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() =>
                          openAddTemplatePicker(activeLesson.blocks.length)
                        }
                      >
                        <Plus size={16} />
                        Add block
                      </Button>
                    </div>
                    </SlideEditorStage>
                  </>
                )
              ) : slideCourse ? (
                <div className="grid min-h-[340px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <div><h2 className="text-lg font-semibold">{slides.length ? "Choose a slide to edit" : "Your presentation has no slides"}</h2><p className="mt-2 text-sm text-slate-500">{slides.length ? "Choose a thumbnail in the slide panel to continue editing." : "Choose Add slide in the slide panel to start building your presentation."}</p></div>
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
