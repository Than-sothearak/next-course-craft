"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { processStepMediaSchema, type ContentBlock } from "@/lib/schemas/block";
import { resolveProcessStepAssets } from "@/lib/editor/process-steps";
import { MediaLibraryDialog } from "../../media-library-dialog";

type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

export function ProcessStepMediaEditor({ step, index, courseId, onChange }: { step: Step; index: number; courseId: string; onChange: (patch: Pick<Partial<Step>, "media" | "attachment">) => void }) {
  const { media, attachment } = resolveProcessStepAssets(step);
  const [kind, setKind] = useState<"image" | "video" | "audio">(() => media?.mimeType.startsWith("video/") ? "video" : media?.mimeType.startsWith("audio/") ? "audio" : "image");
  const [picker, setPicker] = useState<"image" | "video" | "audio" | "attachment" | null>(null);
  const [libraryHost, setLibraryHost] = useState<Element | null>(null);
  const legacyFile = step.media && !media ? step.media : undefined;
  return <div className="space-y-2">
    <p className="text-xs font-medium text-slate-600">Media</p>
    {media && <p className="truncate text-xs text-slate-500" title={media.fileName}>{media.fileName}</p>}
    <div className="flex flex-wrap gap-2">
      <Select aria-label={`Process step ${index + 1} media type`} value={kind} className="h-9 w-auto" onChange={(event) => { if (event.target.value === "image" || event.target.value === "video" || event.target.value === "audio") setKind(event.target.value); }}><option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option></Select>
      <Button variant="outline" size="sm" aria-label={`${media ? "Replace" : "Add"} process step ${index + 1} media`} onClick={(event) => { setLibraryHost(event.currentTarget.closest("dialog[open]") ?? document.fullscreenElement ?? document.body); setPicker(kind); }}><ImagePlus size={14} />{media ? "Replace media" : "Add media"}</Button>
      {media && <Button variant="ghost" size="icon" aria-label={`Remove process step ${index + 1} media`} onClick={() => onChange({ media: undefined })}><Trash2 size={14} /></Button>}
    </div>
    <p className="text-xs font-medium text-slate-600">Downloadable file</p>
    {attachment && <p className="truncate text-xs text-slate-500" title={attachment.fileName}>{attachment.fileName}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" aria-label={`${attachment ? "Replace" : "Add"} process step ${index + 1} file`} onClick={(event) => { setLibraryHost(event.currentTarget.closest("dialog[open]") ?? document.fullscreenElement ?? document.body); setPicker("attachment"); }}><Paperclip size={14} />{attachment ? "Replace file" : "Add file"}</Button>
      {attachment && <Button variant="ghost" size="icon" aria-label={`Remove process step ${index + 1} file`} onClick={() => onChange({ attachment: undefined, ...(legacyFile ? { media: undefined } : {}) })}><Trash2 size={14} /></Button>}
    </div>
    {picker && libraryHost && createPortal(<div className="relative z-[10020]" onPointerDown={(event) => event.stopPropagation()}><MediaLibraryDialog courseId={courseId} kind={picker} open onClose={() => setPicker(null)} onSelect={(asset) => {
      const selected = processStepMediaSchema.safeParse({ src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType, size: asset.size });
      if (!selected.success) return;
      if (picker === "attachment") onChange({ attachment: selected.data, ...(legacyFile ? { media: undefined } : {}) });
      else if (selected.data.mimeType.startsWith(`${picker}/`)) onChange({ media: selected.data, ...(legacyFile && !step.attachment ? { attachment: legacyFile } : {}) });
      setPicker(null);
    }} /></div>, libraryHost)}
  </div>;
}
