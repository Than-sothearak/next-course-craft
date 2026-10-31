"use client";
import { useState } from "react";
import { AudioLines, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { audioInstructionBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { MediaLibraryDialog } from "../media-library-dialog";

type Instruction = Extract<ContentBlock, { type: "audioInstruction" }>;
export function AudioInstructionSettings({ block, courseId, onChange }: { block: Instruction; courseId: string; onChange: (block: ContentBlock) => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const update = (change: Partial<Instruction["data"]>) => onChange({ ...block, data: { ...block.data, ...change } });
  return <div className="space-y-3" aria-label="Audio instruction settings">
    <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}><AudioLines size={14} />{block.data.src ? "Replace instruction audio" : "Choose or upload instruction audio"}</Button>
    {block.data.src && <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs text-slate-500">{block.data.fileName || "Instruction audio"}</p><Button variant="ghost" size="icon" className="size-7 text-rose-600" aria-label="Remove instruction audio file" onClick={() => update({ src: "", fileName: "", mimeType: undefined })}><Trash2 size={14} /></Button></div>}
    <label className="block space-y-1 text-xs text-slate-600">Instruction text<Input aria-label="Audio instruction text" maxLength={120} value={block.data.label} onChange={(event) => { if (event.target.value.trim()) update({ label: event.target.value }); }} /></label>
    <div className="grid grid-cols-2 gap-2">{([{ field: "autoPlay", label: "Autoplay on slide" }, { field: "showIcon", label: "Show icon" }, { field: "showText", label: "Show text" }] as const).map(({ field, label }) => <label key={field} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label={`Audio instruction ${label.toLowerCase()}`} checked={block.data[field]} onChange={(event) => update({ [field]: event.target.checked })} />{label}</label>)}</div>
    <div className="grid grid-cols-2 gap-2">{(["color", "textColor"] as const).map((field) => <div key={field} className="space-y-1 text-xs text-slate-600">{field === "color" ? "Button fill" : "Icon & text"}<ColorPicker aria-label={`Audio instruction ${field}`} value={block.data[field]} onChange={(value) => update({ [field]: value })} /></div>)}</div>
    <p className="text-[11px] leading-4 text-slate-500">Choose icon, text, both, or hide both for background audio. Keep a visible control if learners need to start audio when their browser blocks autoplay.</p>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <MediaLibraryDialog courseId={courseId} kind="audio" open={open} onClose={() => setOpen(false)} onSelect={(asset) => { const parsed = audioInstructionBlockSchema.safeParse({ ...block, data: { ...block.data, src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType } }); if (parsed.success) { onChange(parsed.data); setError(""); setOpen(false); } else setError("Choose a supported audio file."); }} />
  </div>;
}
