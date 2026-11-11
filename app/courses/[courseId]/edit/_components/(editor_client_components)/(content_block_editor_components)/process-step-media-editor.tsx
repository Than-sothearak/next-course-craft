"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processStepMediaSchema, type ContentBlock } from "@/lib/schemas/block";
import { MediaLibraryDialog } from "../../media-library-dialog";

type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

export function ProcessStepMediaEditor({ step, index, courseId, onChange }: { step: Step; index: number; courseId: string; onChange: (media: Step["media"]) => void }) {
  const [open, setOpen] = useState(false);
  const [libraryHost, setLibraryHost] = useState<Element | null>(null);
  return <div className="space-y-2">
    {step.media && <p className="truncate text-xs text-slate-500" title={step.media.fileName}>{step.media.fileName}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" aria-label={`${step.media ? "Replace" : "Add"} process step ${index + 1} media`} onClick={(event) => { setLibraryHost(event.currentTarget.closest("dialog[open]") ?? document.fullscreenElement ?? document.body); setOpen(true); }}><Paperclip size={14} />{step.media ? "Replace media" : "Add media or file"}</Button>
      {step.media && <Button variant="ghost" size="icon" aria-label={`Remove process step ${index + 1} media`} onClick={() => onChange(undefined)}><Trash2 size={14} /></Button>}
    </div>
    {open && libraryHost && createPortal(<div className="relative z-[10020]" onPointerDown={(event) => event.stopPropagation()}><MediaLibraryDialog courseId={courseId} kind="attachment" open onClose={() => setOpen(false)} onSelect={(asset) => {
      const media = processStepMediaSchema.safeParse({ src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType, size: asset.size });
      if (media.success) { onChange(media.data); setOpen(false); }
    }} /></div>, libraryHost)}
  </div>;
}
