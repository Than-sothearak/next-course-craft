"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Flag,
  Leaf,
  LockKeyhole,
  MapPin,
  Monitor,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ContentBlock, LessonMapCheckpointIcon, LessonMapTemplate } from "@/lib/schemas/block";
import { LessonMapArtwork, lessonMapTemplates } from "@/components/lesson-map-artwork";
import { createClientId } from "@/lib/client-id";

type LessonMapBlock = Extract<ContentBlock, { type: "lessonMap" }>;
type LessonMapData = LessonMapBlock["data"];
type LessonMapCheckpoint = LessonMapData["checkpoints"][number];
type CourseSectionOption = { id: string; title: string; order: number };
type CourseLessonOption = { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" };
type SaveStatus = "saved" | "saving" | "error" | "conflict";
type PreviewDevice = "desktop" | "mobile";
type CheckpointStatus = "completed" | "available" | "locked";

const checkpointPositions: Record<LessonMapTemplate, { x: number; y: number }[]> = {
  modernCity: [{ x: 14, y: 69 }, { x: 35, y: 50 }, { x: 61, y: 39 }, { x: 84, y: 62 }, { x: 69, y: 80 }, { x: 45, y: 69 }, { x: 24, y: 31 }, { x: 79, y: 27 }],
  farmFields: [{ x: 13, y: 54 }, { x: 35, y: 46 }, { x: 58, y: 59 }, { x: 81, y: 49 }, { x: 65, y: 27 }, { x: 46, y: 75 }, { x: 22, y: 78 }, { x: 84, y: 78 }],
  cityProvince: [{ x: 13, y: 51 }, { x: 35, y: 48 }, { x: 57, y: 58 }, { x: 83, y: 50 }, { x: 70, y: 78 }, { x: 44, y: 78 }, { x: 27, y: 27 }, { x: 80, y: 26 }],
  learningRoad: [{ x: 12, y: 68 }, { x: 31, y: 49 }, { x: 53, y: 58 }, { x: 76, y: 41 }, { x: 89, y: 47 }, { x: 61, y: 77 }, { x: 39, y: 78 }, { x: 17, y: 33 }],
};

const checkpointIcons: { value: LessonMapCheckpointIcon; label: string; Icon: typeof Flag }[] = [
  { value: "flag", label: "Flag", Icon: Flag },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "star", label: "Star", Icon: Star },
  { value: "leaf", label: "Leaf", Icon: Leaf },
  { value: "pin", label: "Map pin", Icon: MapPin },
  { value: "sparkles", label: "Sparkles", Icon: Sparkles },
];

function checkpointIcon(icon: LessonMapCheckpointIcon) {
  return checkpointIcons.find((item) => item.value === icon) ?? checkpointIcons[0];
}

function checkpointForeground(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return "#ffffff";
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#0f172a" : "#ffffff";
}

function checkpointPosition(template: LessonMapTemplate, index: number) {
  const positions = checkpointPositions[template];
  const point = positions[index % positions.length];
  if (index < positions.length) return point;
  const round = Math.floor(index / positions.length);
  return {
    x: Math.min(92, Math.max(8, point.x + (round % 2 ? -2 : 2) * round)),
    y: Math.min(90, Math.max(10, point.y + (round % 2 ? 2 : -2) * round)),
  };
}

export function LessonMapTemplateThumbnail({ template, className = "" }: { template: LessonMapTemplate; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-emerald-100 ${className}`}>
      <LessonMapArtwork template={template} className="absolute inset-0 size-full" />
      <span className="absolute left-[20%] top-[56%] size-2.5 rounded-full border-2 border-white bg-[#e27d55] shadow-sm" />
      <span className="absolute left-[48%] top-[39%] size-2.5 rounded-full border-2 border-white bg-[#e27d55] shadow-sm" />
      <span className="absolute left-[77%] top-[55%] size-2.5 rounded-full border-2 border-white bg-[#e27d55] shadow-sm" />
    </span>
  );
}

function LessonMapBoard({
  data,
  activeCheckpointId,
  checkpointStates,
  onCheckpointSelect,
  onOpenLesson,
  onReposition,
  editable = false,
  previewOnly = false,
}: {
  data: LessonMapData;
  activeCheckpointId: string | null;
  checkpointStates: ReadonlyMap<string, CheckpointStatus>;
  onCheckpointSelect: (checkpointId: string) => void;
  onOpenLesson?: (checkpoint: LessonMapCheckpoint) => void;
  onReposition?: (checkpointId: string, x: number, y: number) => void;
  editable?: boolean;
  previewOnly?: boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ checkpointId: string; pointerId: number } | null>(null);
  const activeCheckpoint = data.checkpoints.find((checkpoint) => checkpoint.id === activeCheckpointId) ?? null;
  const path = data.checkpoints.map((checkpoint) => `${checkpoint.x},${checkpoint.y}`).join(" ");

  function moveCheckpoint(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !boardRef.current || !onReposition) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - bounds.top) / bounds.height) * 100));
    onReposition(dragRef.current.checkpointId, x, y);
  }

  return (
    <div
      ref={boardRef}
      data-testid="lesson-map-canvas"
      onPointerMove={moveCheckpoint}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
      className="relative aspect-[18/11] w-full overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#e9eddc] shadow-inner"
    >
      <LessonMapArtwork template={data.template} className="absolute inset-0 size-full" />
      {path && (
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
          <polyline points={path} fill="none" stroke="#fff8e6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".88" />
          <polyline points={path} fill="none" stroke="#a36b46" strokeWidth=".9" strokeDasharray="1.2 1.7" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
        </svg>
      )}
      {data.checkpoints.map((checkpoint, index) => {
        const state = checkpointStates.get(checkpoint.id) ?? "available";
        const selected = checkpoint.id === activeCheckpointId;
        const icon = checkpointIcon(checkpoint.icon);
        const Icon = state === "completed" ? Check : icon.Icon;
        const stateLabel = state === "completed" ? "completed" : state === "locked" ? "locked" : "available";
        return (
          <button
            key={checkpoint.id}
            type="button"
            aria-label={`Checkpoint ${index + 1}: ${checkpoint.title || "Untitled checkpoint"}, ${stateLabel}${editable ? ". Drag to reposition." : ". Open details."}`}
            aria-pressed={selected}
            title={`${index + 1}. ${checkpoint.title || "Checkpoint"} · ${stateLabel}`}
            onPointerDown={(event) => {
              if (!editable || !onReposition) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { checkpointId: checkpoint.id, pointerId: event.pointerId };
              onCheckpointSelect(checkpoint.id);
            }}
            onClick={() => onCheckpointSelect(checkpoint.id)}
            className={`absolute z-10 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[17px] border-[3px] border-white text-white shadow-[0_5px_0_rgba(28,52,43,.18),0_8px_18px_rgba(30,45,35,.25)] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2 hover:-translate-y-[55%] ${editable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"} ${selected ? "scale-110 ring-4 ring-amber-200" : state === "completed" ? "outline outline-2 outline-emerald-700" : ""} ${state === "locked" ? "saturate-50 opacity-80" : ""}`}
            style={{ left: `${checkpoint.x}%`, top: `${checkpoint.y}%`, backgroundColor: checkpoint.color, color: checkpointForeground(checkpoint.color) }}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={2.8} />
            <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-extrabold leading-none text-white shadow">{index + 1}</span>
            {state === "locked" && <LockKeyhole aria-hidden="true" className="absolute -bottom-1.5 -left-1.5 size-4 rounded-full bg-white p-0.5 text-slate-700 shadow" />}
          </button>
        );
      })}
      {activeCheckpoint && (
        <div role="dialog" aria-label={`${activeCheckpoint.title || "Checkpoint"} details`} className="absolute bottom-2.5 left-1/2 z-20 w-[min(400px,calc(100%-1.25rem))] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-[0_10px_35px_rgba(31,47,34,.25)] backdrop-blur-sm sm:bottom-4 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl shadow-sm" style={{ backgroundColor: activeCheckpoint.color, color: checkpointForeground(activeCheckpoint.color) }}>
              {(() => { const Icon = checkpointIcon(activeCheckpoint.icon).Icon; return <Icon aria-hidden="true" size={19} />; })()}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="m-0 text-sm font-bold leading-tight text-slate-900">{activeCheckpoint.title || "Checkpoint"}</h3>
              <p className="mb-0 mt-1 text-xs leading-relaxed text-slate-600">{activeCheckpoint.description || "Explore this stop on the learning map."}</p>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${checkpointStates.get(activeCheckpoint.id) === "completed" ? "text-emerald-700" : checkpointStates.get(activeCheckpoint.id) === "locked" ? "text-slate-600" : "text-sky-800"}`}>
                  {checkpointStates.get(activeCheckpoint.id) === "completed" ? <Check aria-hidden="true" size={13} /> : checkpointStates.get(activeCheckpoint.id) === "locked" ? <LockKeyhole aria-hidden="true" size={12} /> : null}
                  {checkpointStates.get(activeCheckpoint.id) === "completed" ? "Completed" : checkpointStates.get(activeCheckpoint.id) === "locked" ? "Locked" : "Ready to explore"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={checkpointStates.get(activeCheckpoint.id) === "locked" || previewOnly || !onOpenLesson}
                  onClick={() => onOpenLesson?.(activeCheckpoint)}
                  className="h-8 cursor-pointer rounded-full px-3 text-xs"
                  title={checkpointStates.get(activeCheckpoint.id) === "locked" ? "Complete earlier course content to unlock this lesson." : previewOnly ? "Preview only" : undefined}
                >
                  Open lesson
                </Button>
              </div>
              {previewOnly && <p className="mb-0 mt-1.5 text-right text-[10px] text-slate-500">Author preview</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LessonMapEditor({
  block,
  sections,
  lessons,
  saveState,
  hasUnsavedChanges,
  saveMessage,
  onRetrySave,
  onChange,
}: {
  block: LessonMapBlock;
  sections: CourseSectionOption[];
  lessons: CourseLessonOption[];
  saveState: SaveStatus;
  hasUnsavedChanges: boolean;
  saveMessage: string;
  onRetrySave: () => void;
  onChange: (block: LessonMapBlock) => void;
}) {
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(block.data.checkpoints[0]?.id ?? null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const activeCheckpoint = block.data.checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? null;
  const authorStates = useMemo(() => new Map(block.data.checkpoints.map((checkpoint) => [checkpoint.id, "available" as const])), [block.data.checkpoints]);
  const orderedLessons = useMemo(() => [...lessons].sort((a, b) => {
    const sectionOrder = sections.findIndex((section) => section.id === a.sectionId) - sections.findIndex((section) => section.id === b.sectionId);
    return sectionOrder || a.order - b.order;
  }), [lessons, sections]);
  const saveLabel = saveState === "error" || saveState === "conflict"
    ? saveState === "conflict" ? "Save conflict" : "Save error"
    : saveState === "saving" || hasUnsavedChanges
      ? "Saving changes"
      : "Changes saved";

  function updateData(change: (data: LessonMapData) => LessonMapData) {
    onChange({ ...block, data: change(block.data) });
  }

  function updateCheckpoint(checkpointId: string, change: (checkpoint: LessonMapCheckpoint) => LessonMapCheckpoint) {
    updateData((data) => ({ ...data, checkpoints: data.checkpoints.map((checkpoint) => checkpoint.id === checkpointId ? change(checkpoint) : checkpoint) }));
  }

  function selectTemplate(template: LessonMapTemplate) {
    updateData((data) => ({ ...data, template }));
  }

  function addCheckpoint() {
    if (block.data.checkpoints.length >= 30) return;
    const index = block.data.checkpoints.length;
    const position = checkpointPosition(block.data.template, index);
    const targetLesson = orderedLessons[Math.min(index, orderedLessons.length - 1)];
    const checkpoint: LessonMapCheckpoint = {
      id: createClientId(),
      title: `Checkpoint ${index + 1}`,
      description: "Add a short description to guide learners at this stop.",
      color: "#e27d55",
      icon: "flag",
      targetType: "lesson",
      targetId: targetLesson?.id ?? "",
      x: position.x,
      y: position.y,
    };
    updateData((data) => ({ ...data, checkpoints: [...data.checkpoints, checkpoint] }));
    setSelectedCheckpointId(checkpoint.id);
  }

  function deleteCheckpoint(checkpointId: string) {
    const next = block.data.checkpoints.filter((checkpoint) => checkpoint.id !== checkpointId);
    updateData((data) => ({ ...data, checkpoints: next }));
    if (selectedCheckpointId === checkpointId) setSelectedCheckpointId(next[0]?.id ?? null);
  }

  function reorderCheckpoint(checkpointId: string, direction: -1 | 1) {
    const index = block.data.checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= block.data.checkpoints.length) return;
    updateData((data) => {
      const checkpoints = [...data.checkpoints];
      [checkpoints[index], checkpoints[nextIndex]] = [checkpoints[nextIndex], checkpoints[index]];
      return { ...data, checkpoints };
    });
  }

  function repositionCheckpoint(checkpointId: string, x: number, y: number) {
    updateCheckpoint(checkpointId, (checkpoint) => ({ ...checkpoint, x, y }));
  }

  function updateDestinationType(targetType: "lesson" | "section") {
    if (!activeCheckpoint) return;
    const targetId = targetType === "lesson" ? orderedLessons[0]?.id ?? "" : sections[0]?.id ?? "";
    updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, targetType, targetId }));
  }

  function updateDestination(targetId: string) {
    if (!activeCheckpoint) return;
    updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, targetId }));
  }

  const destinations = activeCheckpoint?.targetType === "section" ? sections : orderedLessons;
  const destinationLabel = activeCheckpoint?.targetType === "section" ? "Course section" : "Lesson";

  return (
    <section aria-label="Lesson Map authoring" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div>
          <p className="m-0 text-sm font-bold text-slate-900">Lesson Map</p>
          <p className="mb-0 mt-0.5 text-xs text-slate-500">Build a visual path through your course.</p>
        </div>
        <div role={saveState === "error" || saveState === "conflict" ? "alert" : "status"} aria-live="polite" className={`flex items-center gap-2 text-xs font-semibold ${saveState === "error" || saveState === "conflict" ? "text-rose-700" : saveState === "saving" || hasUnsavedChanges ? "text-amber-700" : "text-emerald-700"}`}>
          <span className={`size-2 rounded-full ${saveState === "error" || saveState === "conflict" ? "bg-rose-500" : saveState === "saving" || hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"}`} />
          {saveLabel}
          {saveState === "error" && <Button type="button" variant="outline" size="sm" onClick={onRetrySave} className="h-7 cursor-pointer px-2 text-[11px]">Retry save</Button>}
          {saveState === "conflict" && <Button type="button" variant="outline" size="sm" onClick={onRetrySave} className="h-7 cursor-pointer px-2 text-[11px]">Reload course</Button>}
        </div>
      </div>
      {(saveState === "error" || saveState === "conflict") && <p role="alert" className="m-0 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800">{saveMessage || (saveState === "conflict" ? "Reload the course to resolve this save conflict." : "The map changes could not be saved. Try again.")}</p>}

      <div className="space-y-4 p-3 sm:p-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Choose a map template</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {lessonMapTemplates.map((template) => (
              <Button key={template.id} type="button" variant="outline" aria-pressed={block.data.template === template.id} onClick={() => selectTemplate(template.id)} className={`h-auto cursor-pointer flex-col items-stretch gap-1.5 overflow-hidden p-1.5 text-left ${block.data.template === template.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 bg-white"}`}>
                <LessonMapTemplateThumbnail template={template.id} className="aspect-[18/10] w-full" />
                <span className="px-1 pb-0.5">
                  <span className="block text-xs font-bold text-slate-800">{template.title}</span>
                  <span className="mt-0.5 block line-clamp-1 text-[10px] font-normal text-slate-500">{template.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="m-0 text-sm font-bold text-slate-800">Map preview</p>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">Select a checkpoint to edit it or preview its learner popup.</p>
              </div>
              <div role="group" aria-label="Map preview size" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                <Button type="button" variant={previewDevice === "desktop" ? "secondary" : "ghost"} size="sm" aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")} className="h-8 cursor-pointer gap-1.5 px-2.5 text-xs"><Monitor aria-hidden="true" size={14} />Desktop</Button>
                <Button type="button" variant={previewDevice === "mobile" ? "secondary" : "ghost"} size="sm" aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")} className="h-8 cursor-pointer gap-1.5 px-2.5 text-xs"><Smartphone aria-hidden="true" size={14} />Mobile</Button>
              </div>
            </div>
            <div className={`mx-auto transition-[max-width] duration-200 ${previewDevice === "mobile" ? "max-w-[390px] rounded-[28px] border-[7px] border-slate-800 bg-slate-800 p-1.5 shadow-xl" : "w-full max-w-[900px]"}`}>
              <LessonMapBoard data={block.data} activeCheckpointId={selectedCheckpointId} checkpointStates={authorStates} onCheckpointSelect={setSelectedCheckpointId} onReposition={repositionCheckpoint} editable previewOnly />
            </div>
            <p className="mb-0 mt-2 text-center text-[11px] text-slate-500">Drag a map pin to reposition it. The popup stays inside the map on small screens.</p>
          </div>

          <aside aria-label="Checkpoint settings" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="m-0 text-sm font-bold text-slate-900">Checkpoints</p>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">{block.data.checkpoints.length} on this map</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={block.data.checkpoints.length >= 30} onClick={addCheckpoint} className="h-8 cursor-pointer px-2.5 text-xs">+ Add</Button>
            </div>
            {block.data.checkpoints.length ? (
              <ol className="mt-3 max-h-44 space-y-1 overflow-y-auto p-0">
                {block.data.checkpoints.map((checkpoint, index) => (
                  <li key={checkpoint.id} className="flex min-w-0 list-none items-center gap-1">
                    <Button type="button" variant={selectedCheckpointId === checkpoint.id ? "secondary" : "ghost"} onClick={() => setSelectedCheckpointId(checkpoint.id)} aria-pressed={selectedCheckpointId === checkpoint.id} className="h-9 min-w-0 flex-1 cursor-pointer justify-start gap-2 px-2 text-xs">
                      <span className="grid size-5 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: checkpoint.color }}>{index + 1}</span>
                      <span className="truncate">{checkpoint.title || `Checkpoint ${index + 1}`}</span>
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => reorderCheckpoint(checkpoint.id, -1)} disabled={index === 0} aria-label={`Move ${checkpoint.title || `checkpoint ${index + 1}`} earlier`} className="size-8 shrink-0 cursor-pointer"><ArrowUp aria-hidden="true" size={14} /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => reorderCheckpoint(checkpoint.id, 1)} disabled={index === block.data.checkpoints.length - 1} aria-label={`Move ${checkpoint.title || `checkpoint ${index + 1}`} later`} className="size-8 shrink-0 cursor-pointer"><ArrowDown aria-hidden="true" size={14} /></Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mb-0 mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">Add a checkpoint to start building the learning path.</p>
            )}

            {activeCheckpoint ? (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">Selected checkpoint</p>
                  <Button type="button" variant="ghost" size="icon" onClick={() => deleteCheckpoint(activeCheckpoint.id)} aria-label={`Delete ${activeCheckpoint.title || "checkpoint"}`} className="size-8 cursor-pointer text-rose-700 hover:bg-rose-50"><Trash2 aria-hidden="true" size={15} /></Button>
                </div>
                <label className="block text-xs font-semibold text-slate-600">Title
                  <Input aria-label="Checkpoint title" maxLength={160} value={activeCheckpoint.title} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, title: event.target.value }))} className="mt-1 h-9" />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Short description
                  <Textarea aria-label="Checkpoint description" maxLength={1000} value={activeCheckpoint.description} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, description: event.target.value }))} className="mt-1 min-h-20 resize-y" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-600">Color
                    <Input aria-label="Checkpoint color" type="color" value={activeCheckpoint.color} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, color: event.target.value }))} className="mt-1 h-9 cursor-pointer p-1" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">Icon
                    <Select aria-label="Checkpoint icon" value={activeCheckpoint.icon} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, icon: event.target.value as LessonMapCheckpointIcon }))} className="mt-1 h-9 w-full">
                      {checkpointIcons.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
                    </Select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-600">Horizontal position
                    <Input aria-label="Checkpoint horizontal position" type="number" min={6} max={94} step={1} value={Math.round(activeCheckpoint.x)} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, x: Math.max(6, Math.min(94, Number(event.target.value) || 6)) }))} className="mt-1 h-9" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">Vertical position
                    <Input aria-label="Checkpoint vertical position" type="number" min={8} max={92} step={1} value={Math.round(activeCheckpoint.y)} onChange={(event) => updateCheckpoint(activeCheckpoint.id, (checkpoint) => ({ ...checkpoint, y: Math.max(8, Math.min(92, Number(event.target.value) || 8)) }))} className="mt-1 h-9" />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">Destination type
                  <Select aria-label="Checkpoint destination type" value={activeCheckpoint.targetType} onChange={(event) => updateDestinationType(event.target.value as "lesson" | "section")} className="mt-1 h-9 w-full">
                    <option value="lesson">Lesson</option>
                    <option value="section">Course section</option>
                  </Select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">{destinationLabel}
                  <Select aria-label="Checkpoint destination" value={activeCheckpoint.targetId} onChange={(event) => updateDestination(event.target.value)} className="mt-1 h-9 w-full">
                    <option value="">Choose a {activeCheckpoint.targetType === "section" ? "section" : "lesson"}</option>
                    {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.title}</option>)}
                  </Select>
                  {activeCheckpoint.targetType === "section" && <span className="mt-1 block text-[10px] font-normal text-slate-500">The checkpoint opens the first lesson in this section.</span>}
                  {!destinations.length && <span className="mt-1 block text-[10px] font-normal text-amber-700">Add a course {activeCheckpoint.targetType === "section" ? "section" : "lesson"} to link this checkpoint.</span>}
                </label>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

export function InteractiveLessonMap({
  block,
  lessons,
  visitedLessonIds,
  passedQuizIds,
  getLessonNavigationLockMessage,
  onOpenLesson,
}: {
  block: LessonMapBlock;
  lessons: CourseLessonOption[];
  visitedLessonIds: ReadonlySet<string>;
  passedQuizIds: ReadonlySet<string>;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
  onOpenLesson: (lessonId: string) => void;
}) {
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const checkpointDetails = useMemo(() => new Map(block.data.checkpoints.map((checkpoint) => {
    const linkedLessons = checkpoint.targetType === "section"
      ? lessons.filter((lesson) => lesson.sectionId === checkpoint.targetId).sort((a, b) => a.order - b.order)
      : lessons.filter((lesson) => lesson.id === checkpoint.targetId);
    const lesson = linkedLessons[0] ?? null;
    const complete = checkpoint.targetType === "section"
      ? linkedLessons.length > 0 && linkedLessons.every((item) => item.lessonType === "quiz" ? passedQuizIds.has(item.id) : visitedLessonIds.has(item.id))
      : Boolean(lesson && (lesson.lessonType === "quiz" ? passedQuizIds.has(lesson.id) : visitedLessonIds.has(lesson.id)));
    const locked = !lesson || Boolean(getLessonNavigationLockMessage(lesson.id));
    const status: CheckpointStatus = complete ? "completed" : locked ? "locked" : "available";
    return [checkpoint.id, { status, lessonId: lesson?.id ?? null }];
  })), [block.data.checkpoints, getLessonNavigationLockMessage, lessons, passedQuizIds, visitedLessonIds]);
  const checkpointStates = useMemo(() => new Map([...checkpointDetails].map(([id, detail]) => [id, detail.status])), [checkpointDetails]);

  return (
    <div aria-label="Course lesson map" className="mx-auto w-full max-w-[860px]">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <p className="m-0 text-sm font-bold text-slate-800">Choose a checkpoint</p>
          <p className="mb-0 mt-0.5 text-xs text-slate-500">Follow the path through this course.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{block.data.checkpoints.length} {block.data.checkpoints.length === 1 ? "stop" : "stops"}</span>
      </div>
      <LessonMapBoard
        data={block.data}
        activeCheckpointId={activeCheckpointId}
        checkpointStates={checkpointStates}
        onCheckpointSelect={(checkpointId) => setActiveCheckpointId((current) => current === checkpointId ? null : checkpointId)}
        onOpenLesson={(checkpoint) => {
          const detail = checkpointDetails.get(checkpoint.id);
          if (detail?.status !== "locked" && detail?.lessonId) onOpenLesson(detail.lessonId);
        }}
      />
      <div aria-label="Checkpoint status legend" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-600" />Completed</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sky-600" />Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-500" />Locked</span>
      </div>
    </div>
  );
}

