"use client";

import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useId } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, CirclePlay, ClipboardList, Copy, FilePlus2, FileText, FolderPlus, Lightbulb, LoaderCircle, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SectionTitleInput } from "./section-title-input";
import { SortableItem } from "./sortable-item";

type Section = EditorSnapshotInput["sections"][number];
type Lesson = EditorSnapshotInput["lessons"][number];
type LessonIcon = NonNullable<Lesson["icon"]>;
type CourseOption = { id: string; title: string; folderId: string | null };
const contentIcons: Array<{ id: LessonIcon; label: string; Icon: typeof FileText }> = [
  { id: "file", label: "Document", Icon: FileText },
  { id: "book", label: "Book", Icon: BookOpen },
  { id: "video", label: "Video", Icon: CirclePlay },
  { id: "quiz", label: "Quiz", Icon: ClipboardList },
  { id: "idea", label: "Idea", Icon: Lightbulb },
];

type Props = {
  currentCourseId: string;
  sections: Section[];
  lessons: Lesson[];
  activeLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onAddSection: () => void;
  onRenameSection: (id: string, title: string) => void;
  onMoveSection: (id: string, direction: -1 | 1) => void;
  onDuplicateSection: (id: string) => void;
  onDeleteSection: (id: string) => void;
  onAddLesson: (sectionId: string) => void;
  onAddQuiz: (sectionId: string) => void;
  onDuplicateLesson: (id: string) => void;
  onDeleteLesson: (id: string) => void;
  onChangeLessonIcon: (id: string, icon: LessonIcon) => void;
  onReorderLessons: (sectionId: string, orderedIds: string[]) => void;
};

export function CourseOutline(props: Props) {
  const dndPrefix = `course-outline-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sections = [...props.sections].sort((a, b) => a.order - b.order);
  const [copyLessonId, setCopyLessonId] = useState<string | null>(null);
  const [copyDestinations, setCopyDestinations] = useState<CourseOption[]>([]);
  const [copyDestinationId, setCopyDestinationId] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copyPending, setCopyPending] = useState(false);
  const [copySucceeded, setCopySucceeded] = useState(false);

  async function openCopyDialog(lessonId: string) {
    setCopyLessonId(lessonId);
    setCopyDestinations([]);
    setCopyDestinationId("");
    setCopyError("");
    setCopySucceeded(false);
    try {
      const response = await fetch(`/api/courses/${props.currentCourseId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load courses.");
      setCopyDestinations(result as CourseOption[]);
    } catch (cause) {
      setCopyError(cause instanceof Error ? cause.message : "Could not load courses.");
    }
  }

  async function copyContent() {
    const lesson = props.lessons.find((item) => item.id === copyLessonId);
    if (!lesson || !copyDestinationId) return;
    setCopyPending(true);
    setCopyError("");
    try {
      const response = await fetch(`/api/courses/${props.currentCourseId}/lessons/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationCourseId: copyDestinationId, lesson }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not copy content.");
      setCopySucceeded(true);
    } catch (cause) {
      setCopyError(cause instanceof Error ? cause.message : "Could not copy content.");
    } finally {
      setCopyPending(false);
    }
  }

  return <div>
    <div className="space-y-14">
      {sections.map((section, index) => {
        const lessons = props.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order);
        return <section key={section.id} className="group/section">
          <div className="flex items-center gap-1">
            <SectionTitleInput key={`${section.id}-${section.title}`} title={section.title} onCommit={(title) => props.onRenameSection(section.id, title)} className="text-black" />
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => props.onMoveSection(section.id, -1)} aria-label="Move section up" className="size-7 opacity-0 transition-opacity group-hover/section:opacity-100 group-focus-within/section:opacity-100"><ChevronUp size={14} /></Button>
            <Button variant="ghost" size="icon" disabled={index === sections.length - 1} onClick={() => props.onMoveSection(section.id, 1)} aria-label="Move section down" className="size-7 opacity-0 transition-opacity group-hover/section:opacity-100 group-focus-within/section:opacity-100"><ChevronDown size={14} /></Button>
            <details className="relative opacity-0 transition-opacity group-hover/section:opacity-100 group-focus-within/section:opacity-100"><summary aria-label={`Section actions for ${section.title}`} className="grid size-7 cursor-pointer list-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={15} /></summary><div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button type="button" onClick={() => props.onDuplicateSection(section.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"><Copy size={13} />Duplicate section</button><button type="button" disabled={sections.length === 1} onClick={() => props.onDeleteSection(section.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={13} />Delete section</button></div></details>
          </div>
          <DndContext id={`${dndPrefix}-section-${section.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event: DragEndEvent) => {
            if (!event.over || event.active.id === event.over.id) return;
            const from = lessons.findIndex((lesson) => `lesson-${lesson.id}` === event.active.id);
            const to = lessons.findIndex((lesson) => `lesson-${lesson.id}` === event.over?.id);
            if (from >= 0 && to >= 0) props.onReorderLessons(section.id, arrayMove(lessons.map((lesson) => lesson.id), from, to));
          }}>
            <SortableContext items={lessons.map((lesson) => `lesson-${lesson.id}`)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-slate-200">{lessons.map((lesson) => {
                const icon = contentIcons.find((item) => item.id === (lesson.icon ?? "file")) ?? contentIcons[0];
                const Icon = icon.Icon;
                return <SortableItem key={lesson.id} id={`lesson-${lesson.id}`} className="group/content-row" alwaysShowHandle>
                  <div className={`flex min-h-[88px] min-w-0 flex-1 items-center gap-3 px-2 py-4 ${props.activeLessonId === lesson.id ? "bg-blue-50/50" : "bg-white"}`}>
                    <span className="grid size-8 shrink-0 place-items-center text-slate-700"><Icon size={17} /></span>
                    <button type="button" onClick={() => props.onSelectLesson(lesson.id)} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-[#171717]">{lesson.title}<span className="mt-2 block text-sm font-normal text-[#858585]">{lesson.lessonType === "quiz" ? "Quiz" : "Lesson"}</span></button>
                    <Button type="button" variant="outline" size="sm" onClick={() => props.onSelectLesson(lesson.id)} className="min-h-9 rounded-full border-[#333] px-4 text-sm text-black">Edit Content</Button>
                    <details className="relative opacity-40 transition-opacity group-hover/content-row:opacity-100 group-focus-within/content-row:opacity-100"><summary aria-label={`Content actions for ${lesson.title}`} className="grid size-8 cursor-pointer list-none place-items-center rounded text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={15} /></summary><div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                      <button type="button" onClick={() => props.onDuplicateLesson(lesson.id)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-slate-50"><Copy size={13} />Duplicate content</button>
                      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Change content icon</div>
                      <div className="flex gap-1 px-1 pb-1">{contentIcons.map(({ id, label, Icon: ContentIcon }) => <button key={id} type="button" onClick={() => props.onChangeLessonIcon(lesson.id, id)} aria-label={`Use ${label} icon`} title={label} className={`grid size-8 place-items-center rounded-md ${lesson.icon === id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}><ContentIcon size={15} /></button>)}</div>
                      <button type="button" onClick={() => void openCopyDialog(lesson.id)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-slate-50"><Copy size={13} />Copy to another course</button>
                      <button type="button" onClick={() => props.onDeleteLesson(lesson.id)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={13} />Delete content</button>
                    </div></details>
                  </div>
                </SortableItem>;
              })}</div>
            </SortableContext>
          </DndContext>
          <details className="group/add-content relative mt-1 w-fit">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><FilePlus2 size={15} />Add content</summary>
            <div role="group" aria-label="Add course content" className="absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <button type="button" onClick={(event) => { props.onAddLesson(section.id); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><FileText size={15} />Add lesson</button>
              <button type="button" onClick={(event) => { props.onAddQuiz(section.id); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><ClipboardList size={15} />Add quiz</button>
              <button type="button" onClick={(event) => { props.onAddSection(); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><FolderPlus size={15} />Add section</button>
            </div>
          </details>
        </section>;
      })}
    </div>
    <Button variant="ghost" size="sm" onClick={props.onAddSection} aria-label="Add section" className="mt-14 h-10 px-2 text-sm text-slate-500"><Plus size={15} />Add section</Button>

    {copyLessonId && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !copyPending) setCopyLessonId(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="copy-content-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="copy-content-title" className="text-lg font-semibold">Copy content</h2><p className="mt-1 text-sm text-slate-500">Choose one of your courses as the destination.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setCopyLessonId(null)} disabled={copyPending} aria-label="Close copy dialog"><X size={17} /></Button></div>
        {copySucceeded ? <p role="status" className="mt-5 flex items-center gap-2 text-sm text-emerald-700"><Check size={16} />Content copied successfully.</p> : <>
          <Select aria-label="Destination course" value={copyDestinationId} onChange={(event) => setCopyDestinationId(event.target.value)} className="mt-5" disabled={copyDestinations.length === 0}>
            <option value="">{copyDestinations.length ? "Choose a course" : "No other courses available"}</option>
            {copyDestinations.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </Select>
          {copyError && <p role="alert" className="mt-3 text-sm text-rose-700">{copyError}</p>}
        </>}
        <div className="mt-5 flex justify-end gap-2">{copySucceeded ? <Button onClick={() => setCopyLessonId(null)}>Done</Button> : <><Button type="button" variant="ghost" onClick={() => setCopyLessonId(null)} disabled={copyPending}>Cancel</Button><Button type="button" onClick={() => void copyContent()} disabled={!copyDestinationId || copyPending}>{copyPending && <LoaderCircle size={15} className="animate-spin" />}Copy content</Button></>}</div>
      </section>
    </div>}
  </div>;
}
