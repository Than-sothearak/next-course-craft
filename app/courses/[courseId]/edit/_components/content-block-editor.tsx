"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Play, Plus, Settings2, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HeadingBlockEditor } from "./heading-block-editor";
import { RichTextBlockEditor } from "./rich-text-block-editor";
import { InputBlockPreview } from "./input-block-preview";
import { StatementContentEditor } from "./statement-content-editor";

export function ContentBlockEditor({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const [editing, setEditing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  function keepDetailsOpen() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setEditing(true);
  }
  function delayCloseDetails() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setEditing(false), 300);
  }
  if (block.type === "heading") return <HeadingBlockEditor block={block} onChange={onChange} />;
  if (block.type === "richText") return <RichTextBlockEditor block={block} onChange={(html) => onChange({ ...block, data: { html } })} />;

  if (block.type === "statement") return <StatementContentEditor block={block} onChange={onChange} />;

  const preview = block.type === "image" ? (
    <figure className="overflow-hidden rounded-lg">
      <Image src={block.data.src} alt={block.data.alt} width={1200} height={675} unoptimized className="max-h-[520px] w-full object-contain" />
      {block.data.caption && <figcaption className="mt-2 text-center text-sm">{block.data.caption}</figcaption>}
    </figure>
  ) : block.type === "gallery" ? (
    <div className={`grid gap-3 ${block.data.images.length === 1 ? "grid-cols-1" : block.data.images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {block.data.images.map((image, index) => <figure key={`${block.id}-image-${index}`} className="min-w-0 overflow-hidden rounded-lg">
        <Image src={image.src} alt={image.alt} width={480} height={360} unoptimized className="aspect-[4/3] w-full object-cover" />
      </figure>)}
    </div>
  ) : block.type === "video" ? (
    <a href={block.data.src} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900">
      <span className="grid size-12 place-items-center rounded-full bg-white/15"><Play size={22} fill="currentColor" /></span>
      <span className="text-sm font-medium">Open video</span>
    </a>
  ) : block.type === "divider" ? (
    <div>
      {block.data.style === "line" ? <hr className="border-0 border-t border-slate-300" /> : <div aria-hidden="true" className="h-8" />}
    </div>
  ) : block.type === "knowledgeCheck" ? (
    <InputBlockPreview type="knowledgeCheck" question={block.data.question} options={block.data.options} />
  ) : (
    <InputBlockPreview type="survey" question={block.data.question} minLabel={block.data.minLabel} maxLabel={block.data.maxLabel} />
  );

  return <div className="group/preview relative" onMouseEnter={keepDetailsOpen} onMouseLeave={delayCloseDetails} onFocus={keepDetailsOpen}>
    <div role="button" tabIndex={0} onClick={() => setEditing(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setEditing(true); }} aria-label="Edit this block" className="block w-full cursor-text rounded-md text-left">{preview}</div>
    <div onMouseEnter={keepDetailsOpen} className={`absolute left-0 right-0 top-full z-30 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl transition-opacity ${editing ? "visible opacity-100" : "invisible opacity-0"}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit content</div>
      {block.type === "image" && <div className="space-y-2">
        <Input aria-label="Image URL" type="url" value={block.data.src} onChange={(event) => onChange({ ...block, data: { ...block.data, src: event.target.value } })} placeholder="Image URL" className="h-9" />
        <Input aria-label="Alternative text" value={block.data.alt} maxLength={500} onChange={(event) => onChange({ ...block, data: { ...block.data, alt: event.target.value } })} placeholder="Alternative text" className="h-9" />
        <Input aria-label="Caption" value={block.data.caption ?? ""} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, caption: event.target.value } })} placeholder="Caption (optional)" className="h-9" />
      </div>}
      {block.type === "gallery" && <div className="space-y-3">
        {block.data.images.map((image, index) => <div key={`${block.id}-image-settings-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Input aria-label={`Gallery image ${index + 1} URL`} type="url" value={image.src} onChange={(event) => onChange({ ...block, data: { images: block.data.images.map((item, itemIndex) => itemIndex === index ? { ...item, src: event.target.value } : item) } })} placeholder="Image URL" className="h-9" />
            <Input aria-label={`Gallery image ${index + 1} alternative text`} value={image.alt} maxLength={500} onChange={(event) => onChange({ ...block, data: { images: block.data.images.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) } })} placeholder="Alternative text" className="h-9" />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove gallery image ${index + 1}`} disabled={block.data.images.length <= 1} onClick={() => onChange({ ...block, data: { images: block.data.images.filter((_, itemIndex) => itemIndex !== index) } })} className="size-8 text-slate-400 hover:text-rose-700"><Trash2 size={14} /></Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" disabled={block.data.images.length >= 8} onClick={() => onChange({ ...block, data: { images: [...block.data.images, { src: "https://placehold.co/480x360?text=Add+image", alt: "" }] } })}><Plus size={14} />Add image</Button>
      </div>}
      {block.type === "video" && <div className="space-y-2">
        <Input aria-label="Video URL" type="url" value={block.data.src} onChange={(event) => onChange({ ...block, data: { ...block.data, src: event.target.value } })} placeholder="Video URL" className="h-9" />
        <Input aria-label="Captions URL (optional)" type="url" value={block.data.captions ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, captions: event.target.value } })} placeholder="Captions URL (optional)" className="h-9" />
      </div>}
      {block.type === "divider" && <Select aria-label="Divider style" value={block.data.style} onChange={(event) => onChange({ ...block, data: { style: event.target.value as "line" | "space" } })} className="h-9 w-28"><option value="line">Line</option><option value="space">Space</option></Select>}
      {block.type === "knowledgeCheck" && <div className="space-y-2">
        <Input aria-label="Question" value={block.data.question} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, question: event.target.value } })} placeholder="Question" className="h-9" />
        {block.data.options.map((option, index) => <Input key={index} aria-label={`Answer option ${index + 1}`} value={option} maxLength={500} onChange={(event) => onChange({ ...block, data: { ...block.data, options: block.data.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })} placeholder={`Answer option ${index + 1}`} className="h-9" />)}
      </div>}
      {block.type === "survey" && <div className="space-y-2">
        <Input aria-label="Survey question" value={block.data.question} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, question: event.target.value } })} placeholder="Survey question" className="h-9" />
        <div className="grid grid-cols-2 gap-2"><Input aria-label="Lowest rating label" value={block.data.minLabel} maxLength={100} onChange={(event) => onChange({ ...block, data: { ...block.data, minLabel: event.target.value } })} placeholder="Lowest label" className="h-9" /><Input aria-label="Highest rating label" value={block.data.maxLabel} maxLength={100} onChange={(event) => onChange({ ...block, data: { ...block.data, maxLabel: event.target.value } })} placeholder="Highest label" className="h-9" /></div>
      </div>}
    </div>
  </div>;
}
