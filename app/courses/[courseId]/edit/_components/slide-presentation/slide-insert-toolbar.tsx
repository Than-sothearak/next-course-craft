"use client";

import { AlignLeft, AudioLines, ChartColumn, Heading2, Image as ImageIcon, Images, Layers, LayoutGrid, MousePointer2, MousePointerClick, PanelTop, Paperclip, Video, Volume2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type InsertTool = { id: string; label: string; icon: LucideIcon };
const groups: { label: string; tools: InsertTool[] }[] = [
  { label: "Text", tools: [
    { id: "text-subheading", label: "Heading", icon: Heading2 },
    { id: "text-paragraph", label: "Text", icon: AlignLeft },
  ] },
  { label: "Media", tools: [
    { id: "image-single", label: "Image", icon: ImageIcon },
    { id: "gallery-three", label: "Gallery", icon: Images },
    { id: "media-video", label: "Video", icon: Video },
    { id: "media-audio", label: "Audio", icon: Volume2 },
    { id: "media-audio-instruction", label: "Audio instruction", icon: AudioLines },
    { id: "media-attachment", label: "File", icon: Paperclip },
  ] },
  { label: "Interactive", tools: [
    { id: "interactive-reveal", label: "Flip cards", icon: Layers },
    { id: "interactive-labeled-graphic", label: "Interactive image", icon: MousePointer2 },
    { id: "interactive-button", label: "Interaction button", icon: MousePointerClick },
  ] },
  { label: "Data", tools: [{ id: "chart-bars", label: "Chart", icon: ChartColumn }] },
];

function InsertButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return <Button variant="ghost" size="icon" aria-label={label} title={`Insert ${label.toLowerCase()}`} onClick={onClick} className="size-9 rounded-md text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
    <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
    <span className="sr-only">{label}</span>
  </Button>;
}

export function SlideInsertToolbar({ cover = false, showCover = false, onInsert, onCover, onMore }: { cover?: boolean; showCover?: boolean; onInsert: (id: string) => void; onCover: () => void; onMore: () => void }) {
  const visibleGroups = cover ? groups.filter((group) => group.label === "Media").map((group) => ({ ...group, tools: group.tools.filter((tool) => tool.id === "media-audio-instruction") })) : groups;
  return <div role="group" aria-label="Slide object templates" data-slide-insert-toolbar className="mt-2 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div data-slide-insert-scroll className="flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain p-1">
      {showCover && !cover && <div className="shrink-0 border-r border-slate-200 px-1" role="group" aria-label="Slide layout tools"><InsertButton label="Image cover slide" icon={PanelTop} onClick={onCover} /></div>}
      {visibleGroups.map((group) => <div key={group.label} role="group" aria-label={`Insert ${group.label.toLowerCase()}`} className="shrink-0 border-r border-slate-200 px-1">
        <div className="flex items-center gap-0.5">{group.tools.map((tool) => <InsertButton key={tool.id} label={tool.label} icon={tool.icon} onClick={() => onInsert(tool.id)} />)}</div>
      </div>)}
      {!cover && <div className="shrink-0 px-1"><InsertButton label="More blocks" icon={LayoutGrid} onClick={onMore} /></div>}
    </div>
  </div>;
}
