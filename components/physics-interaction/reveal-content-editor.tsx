"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClientId } from "@/lib/client-id";
import { revealContentBlockSchema, type ContentBlock, type RevealContentBlock } from "@/lib/schemas/block";
import { peelContentTypes } from "@/lib/schemas/peel-to-reveal";
import { MediaLibraryDialog, type MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";

type ContentType = typeof peelContentTypes[number];
const names: Record<ContentType, string> = { richText: "Rich text", heading: "Heading", statement: "Statement", image: "Image", gallery: "Image gallery", video: "Video", audio: "Audio", link: "Link" };
function createContent(type: ContentType, id: string, asset?: MediaLibraryAsset): RevealContentBlock {
  const data = type === "richText" ? { html: "<p>Write your revealed content.</p>" } : type === "heading" ? { text: "Your discovery", level: 2 } : type === "statement" ? { style: "key", title: "Key idea", body: "Explain the idea here." } : type === "link" ? { url: "https://example.com", label: "Explore further" } : type === "gallery" ? { images: [{ src: asset!.fileUrl, alt: asset!.originalName }] } : type === "image" ? { src: asset!.fileUrl, alt: asset!.originalName } : type === "video" ? { src: asset!.fileUrl, mimeType: asset!.contentType } : { src: asset!.fileUrl, mimeType: asset!.contentType, fileName: asset!.originalName };
  return revealContentBlockSchema.parse({ id, version: 1, type, width: "full", blockPadding: 12, data });
}
/** One bounded content editor shared by physics interactions, reusing native block editors/media. */
export function RevealContentEditor({ blocks, courseId, onChange, renderContentEditor }: { blocks: RevealContentBlock[]; courseId: string; onChange: (blocks: RevealContentBlock[]) => void; renderContentEditor: (block: RevealContentBlock, change: (block: ContentBlock) => void) => ReactNode }) {
  const [newType, setNewType] = useState<ContentType>("richText"), [media, setMedia] = useState<{ type: ContentType; id?: string } | null>(null);
  function put(type: ContentType, id?: string, asset?: MediaLibraryAsset) {
    if (!asset && ["image", "gallery", "video", "audio"].includes(type)) { setMedia({ type, id }); return; }
    const content = createContent(type, id ?? createClientId(), asset);
    onChange(id ? blocks.map((item) => item.id === id ? content : item) : [...blocks, content]); setMedia(null);
  }
  function move(index: number, direction: number) { const next = [...blocks]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); }
  return <div className="space-y-3">
    {blocks.map((child, index) => <fieldset key={child.id} className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-medium">Revealed content {index + 1}</legend>
      <div className="flex items-center gap-1"><Select aria-label={`Revealed content ${index + 1} type`} value={child.type} onChange={(event) => put(event.target.value as ContentType, child.id)}>{peelContentTypes.map((type) => <option key={type} value={type}>{names[type]}</option>)}</Select>
        <Button variant="ghost" size="icon" aria-label={`Move revealed content ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} /></Button><Button variant="ghost" size="icon" aria-label={`Move revealed content ${index + 1} down`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></Button><Button variant="ghost" size="icon" aria-label={`Delete revealed content ${index + 1}`} disabled={blocks.length === 1} onClick={() => onChange(blocks.filter((item) => item.id !== child.id))}><Trash2 size={13} /></Button>
      </div>
      {renderContentEditor(child, (next) => { const parsed = revealContentBlockSchema.safeParse(next); if (parsed.success) onChange(blocks.map((item) => item.id === child.id ? parsed.data : item)); })}
    </fieldset>)}
    <div className="flex gap-2"><Select aria-label="New reveal content type" value={newType} onChange={(event) => setNewType(event.target.value as ContentType)}>{peelContentTypes.map((type) => <option key={type} value={type}>{names[type]}</option>)}</Select><Button variant="outline" size="sm" disabled={blocks.length >= 12} onClick={() => put(newType)}><Plus size={14} />Add content</Button></div>
    <MediaLibraryDialog courseId={courseId} kind={media?.type === "video" ? "video" : media?.type === "audio" ? "audio" : "image"} open={media !== null} onClose={() => setMedia(null)} onSelect={(asset) => { if (media) put(media.type, media.id, asset); }} />
  </div>;
}
