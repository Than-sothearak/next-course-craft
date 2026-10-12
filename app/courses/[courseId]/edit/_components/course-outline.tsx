"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useId } from "react";
import { ChevronDown, ChevronUp, Copy, FilePlus2, FolderPlus, MoreHorizontal, Trash2 } from "lucide-react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { Button } from "@/components/ui/button";
import { SectionTitleInput } from "./section-title-input";
import { SortableItem } from "./sortable-item";

type Section = EditorSnapshotInput["sections"][number];
type Lesson = EditorSnapshotInput["lessons"][number];

type Props = {
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
  onDuplicateLesson: (id: string) => void;
  onDeleteLesson: (id: string) => void;
  onReorderLessons: (sectionId: string, orderedIds: string[]) => void;
};

export function CourseOutline(props: Props) {
  const dndPrefix = `course-outline-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sections = [...props.sections].sort((a, b) => a.order - b.order);
  return <div>
    <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Course outline</p><p className="mt-1 text-xs text-slate-500">{props.lessons.length} lessons</p></div><Button variant="ghost" size="icon" onClick={props.onAddSection} aria-label="Add section"><FolderPlus size={16} /></Button></div>
    <div className="space-y-4">
      {sections.map((section, index) => {
        const lessons = props.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order);
        return <section key={section.id} className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="flex items-center gap-1">
            <SectionTitleInput key={`${section.id}-${section.title}`} title={section.title} onCommit={(title) => props.onRenameSection(section.id, title)} />
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => props.onMoveSection(section.id, -1)} aria-label="Move section up" className="size-7"><ChevronUp size={14} /></Button>
            <Button variant="ghost" size="icon" disabled={index === sections.length - 1} onClick={() => props.onMoveSection(section.id, 1)} aria-label="Move section down" className="size-7"><ChevronDown size={14} /></Button>
            <details className="relative"><summary aria-label={`Section actions for ${section.title}`} className="grid size-7 cursor-pointer list-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={15} /></summary><div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button type="button" onClick={() => props.onDuplicateSection(section.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"><Copy size={13} />Duplicate section</button><button type="button" disabled={sections.length === 1} onClick={() => props.onDeleteSection(section.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={13} />Delete section</button></div></details>
          </div>
          <DndContext id={`${dndPrefix}-section-${section.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event: DragEndEvent) => {
            if (!event.over || event.active.id === event.over.id) return;
            const from = lessons.findIndex((lesson) => `lesson-${lesson.id}` === event.active.id);
            const to = lessons.findIndex((lesson) => `lesson-${lesson.id}` === event.over?.id);
            if (from >= 0 && to >= 0) props.onReorderLessons(section.id, arrayMove(lessons.map((lesson) => lesson.id), from, to));
          }}>
            <SortableContext items={lessons.map((lesson) => `lesson-${lesson.id}`)} strategy={verticalListSortingStrategy}>
              <div className="mt-1 space-y-1">{lessons.map((lesson) => <SortableItem key={lesson.id} id={`lesson-${lesson.id}`} className="rounded-lg">
                <div className={`flex min-w-0 flex-1 items-center rounded-md ${props.activeLessonId === lesson.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                  <button type="button" onClick={() => props.onSelectLesson(lesson.id)} className={`min-w-0 flex-1 truncate px-2 py-2 text-left text-xs ${props.activeLessonId === lesson.id ? "font-semibold text-indigo-800" : "text-slate-600"}`}>{lesson.title}</button>
                  <details className="relative"><summary aria-label={`Lesson actions for ${lesson.title}`} className="grid size-7 cursor-pointer list-none place-items-center rounded text-slate-400 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={14} /></summary><div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button type="button" onClick={() => props.onDuplicateLesson(lesson.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"><Copy size={13} />Duplicate</button><button type="button" onClick={() => props.onDeleteLesson(lesson.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={13} />Delete</button></div></details>
                </div>
              </SortableItem>)}</div>
            </SortableContext>
          </DndContext>
          <Button variant="ghost" size="sm" onClick={() => props.onAddLesson(section.id)} className="mt-1 h-8 w-full justify-start px-2 text-xs text-slate-500"><FilePlus2 size={14} />Add lesson</Button>
        </section>;
      })}
    </div>
  </div>;
}
