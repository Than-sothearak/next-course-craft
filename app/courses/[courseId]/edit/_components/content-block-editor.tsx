"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Play, Plus, Settings2, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HeadingBlockEditor } from "./heading-block-editor";
import { RichTextBlockEditor } from "./rich-text-block-editor";
import { InputBlockPreview } from "./input-block-preview";
import { StatementContentEditor } from "./statement-content-editor";
import { MediaLibraryDialog, type MediaLibraryAsset } from "./media-library-dialog";

export function ContentBlockEditor({ block, courseId, onChange }: { block: ContentBlock; courseId: string; onChange: (block: ContentBlock) => void }) {
  const [editing, setEditing] = useState(false);
  const [mediaLibraryTarget, setMediaLibraryTarget] = useState<"image" | "gallery" | "video" | null>(null);
  const [selectedGalleryImageIndex, setSelectedGalleryImageIndex] = useState<number | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsButtonRef.current?.contains(target) || settingsPanelRef.current?.contains(target)) return;
      setEditing(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [editing]);

  function selectMedia(asset: MediaLibraryAsset) {
    if (block.type === "image") onChange({ ...block, data: { ...block.data, src: asset.fileUrl } });
    if (block.type === "video") onChange({ ...block, data: { ...block.data, src: asset.fileUrl, mimeType: asset.contentType as "video/mp4" | "video/webm" } });
    if (block.type === "gallery" && selectedGalleryImageIndex !== null) {
      onChange({ ...block, data: { images: block.data.images.map((image, index) => index === selectedGalleryImageIndex ? { ...image, src: asset.fileUrl } : image) } });
    }
    setMediaLibraryTarget(null);
    setSelectedGalleryImageIndex(null);
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
  ) : block.type === "video" ? block.data.mimeType || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src) ? (
    <video controls className="aspect-video w-full rounded-xl bg-black" src={block.data.src} />
  ) : (
    <a href={block.data.src} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900">
      <span className="grid size-12 place-items-center rounded-full bg-white/15"><Play size={22} fill="currentColor" /></span>
      <span className="text-sm font-medium">Open video</span>
    </a>
  ) : block.type === "divider" ? (
    block.data.style === "line" ? <hr className="border-0 border-t border-slate-300" /> : block.data.style === "space" ? <div aria-hidden="true" className="h-8" /> : <div className="flex justify-center"><span className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">{block.data.label}</span></div>
  ) : block.type === "knowledgeCheck" ? (
    <InputBlockPreview type="knowledgeCheck" question={block.data.question} options={block.data.options} />
  ) : (
    <InputBlockPreview type="survey" question={block.data.question} minLabel={block.data.minLabel} maxLabel={block.data.maxLabel} />
  );

  return <div>
    <Button ref={settingsButtonRef} type="button" variant="ghost" size="icon" aria-label={editing ? "Close content settings" : "Open content settings"} title="Content settings" aria-expanded={editing} aria-controls={`content-settings-${block.id}`} onClick={() => setEditing((current) => !current)} style={{ left: "4px", top: "4px" }} className="absolute z-40 size-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
      <Settings2 size={16} />
    </Button>
    <div className="block w-full rounded-md text-left">{preview}</div>
    {editing && <div ref={settingsPanelRef} id={`content-settings-${block.id}`} style={{ left: "44px", top: "4px" }} className="absolute z-50 w-[min(380px,calc(100vw-4rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit content</div>
      {block.type === "image" && <div className="space-y-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMediaLibraryTarget("image")}>Choose from media library</Button>
        <Input aria-label="Image URL" type="url" value={block.data.src} onChange={(event) => onChange({ ...block, data: { ...block.data, src: event.target.value } })} placeholder="Image URL" className="h-9" />
        <Input aria-label="Alternative text" value={block.data.alt} maxLength={500} onChange={(event) => onChange({ ...block, data: { ...block.data, alt: event.target.value } })} placeholder="Alternative text" className="h-9" />
        <Input aria-label="Caption" value={block.data.caption ?? ""} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, caption: event.target.value } })} placeholder="Caption (optional)" className="h-9" />
      </div>}
      {block.type === "gallery" && <div className="space-y-3">
        {block.data.images.map((image, index) => <div key={`${block.id}-image-settings-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedGalleryImageIndex(index); setMediaLibraryTarget("gallery"); }}>Choose from media library</Button>
            <Input aria-label={`Gallery image ${index + 1} URL`} type="url" value={image.src} onChange={(event) => onChange({ ...block, data: { images: block.data.images.map((item, itemIndex) => itemIndex === index ? { ...item, src: event.target.value } : item) } })} placeholder="Image URL" className="h-9" />
            <Input aria-label={`Gallery image ${index + 1} alternative text`} value={image.alt} maxLength={500} onChange={(event) => onChange({ ...block, data: { images: block.data.images.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) } })} placeholder="Alternative text" className="h-9" />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove gallery image ${index + 1}`} disabled={block.data.images.length <= 1} onClick={() => onChange({ ...block, data: { images: block.data.images.filter((_, itemIndex) => itemIndex !== index) } })} className="size-8 text-slate-400 hover:text-rose-700"><Trash2 size={14} /></Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" disabled={block.data.images.length >= 8} onClick={() => onChange({ ...block, data: { images: [...block.data.images, { src: "https://placehold.co/480x360?text=Add+image", alt: "" }] } })}><Plus size={14} />Add image</Button>
      </div>}
      {block.type === "video" && <div className="space-y-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMediaLibraryTarget("video")}>Choose from media library</Button>
        <Input aria-label="Video URL" type="url" value={block.data.src} onChange={(event) => { const data = { ...block.data, src: event.target.value }; delete data.mimeType; onChange({ ...block, data }); }} placeholder="Video URL" className="h-9" />
        <Input aria-label="Captions URL (optional)" type="url" value={block.data.captions ?? ""} onChange={(event) => onChange({ ...block, data: { ...block.data, captions: event.target.value } })} placeholder="Captions URL (optional)" className="h-9" />
      </div>}
      {block.type === "divider" && <div className="space-y-2">
        <Select aria-label="Divider style" value={block.data.style} onChange={(event) => onChange({ ...block, data: { ...block.data, style: event.target.value as "line" | "space" | "continue" } })} className="h-9 w-full"><option value="line">Line</option><option value="space">Space</option><option value="continue">Continue button</option></Select>
        {block.data.style === "continue" && <>
          <Input aria-label="Continue button label" value={block.data.label} maxLength={100} onChange={(event) => onChange({ ...block, data: { ...block.data, label: event.target.value } })} placeholder="Continue" className="h-9" />
          <Select aria-label="Continue button completion type" value={block.data.completionType} onChange={(event) => onChange({ ...block, data: { ...block.data, completionType: event.target.value as "none" | "completeAbove" } })} className="h-9 w-full"><option value="none">None</option><option value="completeAbove">Complete the content above before moving on</option></Select>
        </>}
      </div>}
      {block.type === "knowledgeCheck" && <div className="space-y-2">
        <Input aria-label="Question" value={block.data.question} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, question: event.target.value } })} placeholder="Question" className="h-9" />
        {block.data.options.map((option, index) => <Input key={index} aria-label={`Answer option ${index + 1}`} value={option} maxLength={500} onChange={(event) => onChange({ ...block, data: { ...block.data, options: block.data.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })} placeholder={`Answer option ${index + 1}`} className="h-9" />)}
      </div>}
      {block.type === "survey" && <div className="space-y-2">
        <Input aria-label="Survey question" value={block.data.question} maxLength={1000} onChange={(event) => onChange({ ...block, data: { ...block.data, question: event.target.value } })} placeholder="Survey question" className="h-9" />
        <div className="grid grid-cols-2 gap-2"><Input aria-label="Lowest rating label" value={block.data.minLabel} maxLength={100} onChange={(event) => onChange({ ...block, data: { ...block.data, minLabel: event.target.value } })} placeholder="Lowest label" className="h-9" /><Input aria-label="Highest rating label" value={block.data.maxLabel} maxLength={100} onChange={(event) => onChange({ ...block, data: { ...block.data, maxLabel: event.target.value } })} placeholder="Highest label" className="h-9" /></div>
      </div>}
    </div>}
    <MediaLibraryDialog
      courseId={courseId}
      kind={mediaLibraryTarget === "video" ? "video" : "image"}
      open={mediaLibraryTarget !== null}
      onClose={() => { setMediaLibraryTarget(null); setSelectedGalleryImageIndex(null); }}
      onSelect={selectMedia}
    />
  </div>;
}
