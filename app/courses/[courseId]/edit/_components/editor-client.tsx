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
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  defaultBlockPadding,
  defaultBlockWidth,
  type ContentBlock,
} from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { applyListTemplateToHtml } from "@/lib/editor/list-template";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import { Textarea } from "@/components/ui/textarea";
import { DashboardNavbar } from "@/app/dashboard/_components/dashboard-navbar";
import { CourseOutline } from "./course-outline";
import { ContentBlockEditor } from "./content-block-editor";
import { LessonTitleEditor } from "./lesson-title-editor";
import { StatementTextEditor } from "./statement-text-editor";
import { SortableItem } from "./sortable-item";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import { BlockFormatMenu } from "./block-format-menu";
import { BlockManagerSidebar } from "./block-manager-sidebar";
import {
  BlockTemplatePicker,
  createBlocksFromTemplate,
  type BlockCategory,
  type BlockTemplate,
} from "./block-template-picker";
import { QuizEditor } from "./quiz-editor";
import { CourseThemeSettings } from "./course-theme-settings";
import { courseThemeFontFamilies } from "@/lib/editor/theme";

type InitialData = { courseId: string } & EditorSnapshotInput;
type Draft = Omit<EditorSnapshotInput, "revision">;
type TemplatePickerState =
  | { mode: "add"; index: number; category: BlockCategory }
  | { mode: "replace"; blockId: string; category: BlockCategory };

function newId() {
  return crypto.randomUUID();
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
  if (block.type === "richText") {
    if (block.data.html.includes("<pre")) return "Code";
    if (block.data.html.includes("<blockquote")) return "Quote";
    if (block.data.html.includes("<ul") || block.data.html.includes("<ol"))
      return "List";
    return "Text";
  }
  if (block.type === "image") return "Image";
  if (block.type === "gallery") return "Gallery";
  if (block.type === "video") return "Multimedia";
  if (block.type === "divider") return "Divider";
  if (block.type === "flipCard" || block.type === "accordion" || block.type === "labeledGraphic" || block.type === "processSteps") return "Interactive";
  if (block.type === "chart") return "Chart";
  if (block.type === "knowledgeCheck") return "Knowledge check";
  return "Survey";
}

export function EditorClient({
  initialData,
  focusedLessonId,
  authorName,
}: {
  initialData: InitialData;
  focusedLessonId?: string;
  authorName: string;
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
    sections: initialData.sections,
    lessons: initialData.lessons,
  };
  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(draft);
  const revisionRef = useRef(initialData.revision);
  const lastSavedRef = useRef(JSON.stringify(initialDraft));
  const saveInFlight = useRef(false);
  const savePending = useRef(false);
  const pendingRouteRef = useRef<string | null>(null);
  const conflictRef = useRef(false);
  const historyRef = useRef<Draft[]>([]);
  const redoRef = useRef<Draft[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeLessonId, setSelectedLessonId] = useState<string | null>(
    focusedLessonId ?? null,
  );
  const [blockManagerOpen, setBlockManagerOpen] = useState(false);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [titleValid, setTitleValid] = useState(true);
  const titleValidRef = useRef(true);
  const courseTitleRef = useRef<HTMLTextAreaElement>(null);
  const [templatePicker, setTemplatePicker] =
    useState<TemplatePickerState | null>(null);
  const activeLesson =
    draft.lessons.find((lesson) => lesson.id === activeLessonId) ?? null;
  const orderedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.order - b.order),
    [draft.sections],
  );
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

  function commit(next: Draft) {
    if (JSON.stringify(next) === JSON.stringify(draftRef.current)) return;
    historyRef.current = [...historyRef.current.slice(-79), draftRef.current];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    draftRef.current = next;
    setDraft(next);
    setHasUnsavedChanges(JSON.stringify(next) !== lastSavedRef.current);
  }

  function updateDraft(update: (current: Draft) => Draft) {
    commit(update(draftRef.current));
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

  function openRouteAfterSave(path: string) {
    if (
      JSON.stringify(draftRef.current) === lastSavedRef.current &&
      !saveInFlight.current
    ) {
      router.push(path);
      return;
    }
    pendingRouteRef.current = path;
    void saveLatest();
  }

  function openLesson(id: string) {
    openRouteAfterSave(`/courses/${initialData.courseId}/edit/lessons/${id}`);
  }

  function openPreview() {
    openRouteAfterSave(`/courses/${initialData.courseId}/preview`);
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    redoRef.current.push(draftRef.current);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    draftRef.current = previous;
    setDraft(previous);
    setHasUnsavedChanges(JSON.stringify(previous) !== lastSavedRef.current);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(draftRef.current);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    draftRef.current = next;
    setDraft(next);
    setHasUnsavedChanges(JSON.stringify(next) !== lastSavedRef.current);
  }

  async function saveLatest() {
    if (conflictRef.current || !titleValidRef.current) return;
    if (saveInFlight.current) {
      savePending.current = true;
      return;
    }
    const snapshot = draftRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedRef.current) return;
    saveInFlight.current = true;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch(
        `/api/courses/${initialData.courseId}/editor`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...snapshot, revision: revisionRef.current }),
        },
      );
      const result = await response.json();
      if (response.status === 409) {
        conflictRef.current = true;
        setSaveState("conflict");
        setSaveMessage(
          result.error ?? "This course changed elsewhere. Reload to continue.",
        );
        return;
      }
      if (!response.ok)
        throw new Error(result.error ?? "Your changes could not be saved.");
      revisionRef.current = result.revision;
      lastSavedRef.current = serialized;
      setHasUnsavedChanges(JSON.stringify(draftRef.current) !== serialized);
      setSaveState("saved");
      const pendingRoute = pendingRouteRef.current;
      if (pendingRoute && JSON.stringify(draftRef.current) === serialized) {
        pendingRouteRef.current = null;
        router.push(pendingRoute);
      }
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Your changes could not be saved.",
      );
    } finally {
      saveInFlight.current = false;
      const saveAgain = savePending.current;
      savePending.current = false;
      // A draft may have changed after this request captured its snapshot. Do
      // not rely on a second debounce timer having fired while the request was
      // in flight; immediately queue the latest version after this save ends.
      const hasUnsavedChanges =
        JSON.stringify(draftRef.current) !== lastSavedRef.current;
      if ((saveAgain || hasUnsavedChanges) && !conflictRef.current) {
        window.setTimeout(
          () => void saveLatest(),
          hasUnsavedChanges ? 250 : 500,
        );
      }
    }
  }

  useEffect(() => {
    if (
      JSON.stringify(draft) === lastSavedRef.current ||
      saveState === "conflict"
    )
      return;
    const timer = window.setTimeout(() => void saveLatest(), 700);
    return () => window.clearTimeout(timer);
    // saveLatest reads the current draft from a ref so saves stay serialized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saveState, titleValid]);

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
          blocks: lesson.blocks.map((block) => ({ ...block, id: newId() })),
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
      title: isQuiz ? "New quiz" : "New lesson",
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
  }

  function duplicateLesson(id: string) {
    const source = draftRef.current.lessons.find((lesson) => lesson.id === id);
    if (!source) return;
    const siblings = draftRef.current.lessons.filter(
      (item) => item.sectionId === source.sectionId,
    );
    const suffix = source.title.length <= 155 ? " copy" : "";
    const titleHtml = source.titleHtml?.replace(
      /((?:<\/[^>]+>\s*)+)$/,
      `${suffix}$1`,
    );
    const lesson = {
      ...source,
      id: newId(),
      title: `${source.title}${suffix}`,
      titleHtml,
      order: Math.max(-1, ...siblings.map((item) => item.order)) + 1,
      blocks: source.blocks.map((block) => ({ ...block, id: newId() })),
      quizQuestions: source.quizQuestions.map((question) => ({
        ...question,
        id: newId(),
        choices: question.choices.map((choice) => ({ ...choice, id: newId() })),
      })),
    };
    pendingRouteRef.current = `/courses/${initialData.courseId}/edit/lessons/${lesson.id}`;
    updateDraft((current) => ({
      ...current,
      lessons: [...current.lessons, lesson],
    }));
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
      const insertedBlocks = createBlocksFromTemplate(template, newId());
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
        existing && createBlocksFromTemplate(template, existing.id)[0];
      if (!existing || !replacement) return;
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
        width: existing.width,
        widthCustom: existing.widthCustom,
        backgroundColor: existing.backgroundColor,
        blockPadding: existing.blockPadding,
        headingPadding: existing.headingPadding,
      });
    }
    setTemplatePicker(null);
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
    const copy = { ...source, id: newId() } as ContentBlock;
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
      blocks: lesson.blocks.filter((block) => block.id !== blockId),
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
  const stateLabel = !titleValid
    ? "Check lesson title"
    : saveState === "saving"
      ? "Saving changes"
      : saveState === "error"
        ? "Save failed"
        : saveState === "conflict"
          ? "Conflict"
          : "All changes saved";
  const isCourseOverview = !focusedLessonId && !activeLesson;
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
          userName={authorName}
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
              <CourseThemeSettings
                theme={draft.theme}
                onChange={(theme) =>
                  updateDraft((current) => ({ ...current, theme }))
                }
              />
              <PublishMenu
                courseId={initialData.courseId}
                title={draft.title}
                disabled={!isDraftSaved}
                disabledReason={publishDisabledReason}
              />
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
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {activeLesson && !focusedLessonId ? (
                <button
                  type="button"
                  onClick={() => setActiveLessonId(null)}
                  aria-label="Back to course outline"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                  Coursecraft authoring
                </p>
                <p className="truncate text-sm font-semibold">
                  {activeLesson?.title ?? draft.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {activeLesson && activeLesson.lessonType !== "quiz" && (
                <Button
                  type="button"
                  variant={blockManagerOpen ? "secondary" : "outline"}
                  size="sm"
                  aria-label="Manage blocks"
                  aria-expanded={blockManagerOpen}
                  aria-controls="lesson-block-manager"
                  onClick={() => setBlockManagerOpen((open) => !open)}
                  className="h-9 px-2 sm:px-3"
                >
                  <List size={15} />
                  <span className="hidden sm:inline">Manage blocks</span>
                </Button>
              )}
              <CourseThemeSettings
                theme={draft.theme}
                onChange={(theme) =>
                  updateDraft((current) => ({ ...current, theme }))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo"
              >
                <Undo2 size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Redo"
              >
                <Redo2 size={16} />
              </Button>
              <span
                className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${saveState === "error" || saveState === "conflict" ? "text-rose-700" : "text-slate-500"}`}
              >
                {stateIcon}
                {stateLabel}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveLatest()}
                disabled={saveState === "saving"}
              >
                <Save size={15} />
                Save now
              </Button>
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
        {!focusedLessonId && activeLesson && (
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
          className={`grid gap-4 ${focusedLessonId || !activeLesson ? "grid-cols-1" : "lg:grid-cols-[270px_minmax(0,1fr)]"}`}
        >
          {!focusedLessonId && activeLesson && (
            <aside className="sticky top-[84px] hidden max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 lg:block">
              {renderOutline()}
            </aside>
          )}

          <section className="min-w-0" aria-label="Lesson canvas">
            <div
              className={`mx-auto ${isCourseOverview ? "max-w-[840px]" : focusedLessonId ? "max-w-none" : "max-w-3xl"}`}
            >
              {isCourseOverview && (
                <div className="mb-0">
                  <label className="block">
                    <span className="sr-only">Course title</span>
                    <Textarea
                      ref={courseTitleRef}
                      aria-label="Course title"
                      rows={1}
                      value={draft.title}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      maxLength={160}
                      className="h-auto min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-none border-0 bg-transparent px-0 py-0 text-[36px] font-bold leading-[1.08] tracking-[-0.035em] text-black shadow-none outline-none placeholder:text-slate-300 focus-visible:ring-0 [overflow-wrap:anywhere] sm:text-[44px]"
                    />
                  </label>
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
                              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
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
                activeLesson.lessonType === "quiz" ? (
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
                  <>
                    <LessonTitleEditor
                      key={activeLesson.id}
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
                                : defaultBlockWidth(block.type);
                              const widthClass =
                                contentWidth === "small"
                                  ? "max-w-[520px]"
                                  : contentWidth === "medium"
                                    ? "max-w-[720px]"
                                    : "max-w-[920px]";
                              const blockPadding =
                                block.blockPadding ??
                                defaultBlockPadding(block.type);
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
                                  <div className="group/block-content relative min-w-0 flex-1">
                                    <div
                                      aria-hidden="true"
                                      className="pointer-events-none absolute inset-0 z-10 border border-dashed border-slate-400 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100"
                                    />
                                    <div className="absolute right-4 top-3 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/block-content:opacity-100 group-focus-within/block-content:opacity-100">
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
                                        paddingTop: `${blockPadding}px`,
                                        paddingBottom: `${blockPadding}px`,
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
                          Build this lesson one block at a time
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
                  </>
                )
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
