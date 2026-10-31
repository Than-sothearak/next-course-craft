"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { AudioLines, Image as ImageIcon, Plus, Trash2, Type, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createClientId } from "@/lib/client-id";
import { popupContentBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { backgroundPaint, solidColor } from "@/lib/color";
import { slideMasterSchema } from "@/lib/editor/slide-design";
import { SlideStage } from "../../../_components/slide-presentation/slide-stage";
import { SlideObject } from "./slide-editable-object";
import { SlideObjectSizeControls } from "./slide-object-size-controls";
import { SlideObjectBackgroundControls } from "./slide-object-background-controls";
import { SlidePlaybackControls } from "./slide-playback-controls";
import { SlideMediaPicker } from "./slide-media-picker";
import { MediaLibraryDialog, type MediaLibraryAsset } from "../media-library-dialog";
import { TextFormattingToolbar } from "../(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

type Popup = Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"];
export function InteractionPopupEditor({ popup, courseId, onApply, onClose }: { popup: Popup; courseId: string; onApply: (popup: Popup) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(popup));
  const [selectedId, setSelectedId] = useState<string | null>(popup.blocks[0]?.id ?? null);
  const [focused, setFocused] = useState<{ id: string; editor: Editor } | null>(null);
  const [picker, setPicker] = useState<"image" | "video" | "audio" | null>(null);
  const [error, setError] = useState("");
  const selected = draft.blocks.find((item) => item.id === selectedId);
  const master = slideMasterSchema.parse({ backgroundColor: draft.backgroundColor, textColor: draft.textColor });
  function change(next: ContentBlock) { const parsed = popupContentBlockSchema.safeParse(next); if (parsed.success) setDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === next.id ? parsed.data : item) })); }
  function add(type: "richText" | "image" | "video" | "audio", asset?: MediaLibraryAsset) {
    if (draft.blocks.length >= 20) return;
    const id = createClientId(), index = draft.blocks.length;
    const data = type === "richText" ? { html: "<p>Add your text here.</p>" } : type === "image" ? { src: asset?.fileUrl, alt: asset?.originalName ?? "" } : { src: asset?.fileUrl, fileName: asset?.originalName ?? "", mimeType: asset?.contentType };
    const parsed = popupContentBlockSchema.safeParse({ id, version: 1, type, data, slideFrame: { x: 8 + index % 3 * 3, y: Math.min(8 + index * 9, 55), width: type === "richText" ? 80 : type === "audio" ? 70 : 55, height: type === "richText" ? 45 : type === "audio" ? 25 : 60, z: index } });
    if (!parsed.success) { setError("Choose a supported image, MP4/WebM video, or audio file."); return; }
    setDraft((current) => ({ ...current, blocks: [...current.blocks, parsed.data] })); setSelectedId(id); setPicker(null); setError("");
  }
  return <Dialog open onClose={onClose} title="Edit popup mini slide" className="max-w-6xl" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => onApply(draft)}>Apply popup</Button></>}>
    <div className="mb-3 flex flex-wrap gap-2">{([{ type: "richText", label: "Text", Icon: Type }, { type: "image", label: "Image", Icon: ImageIcon }, { type: "video", label: "Video", Icon: Video }, { type: "audio", label: "Audio", Icon: AudioLines }] as const).map(({ type, label, Icon }) => <Button key={type} size="sm" variant="outline" disabled={draft.blocks.length >= 20} onClick={() => type === "richText" ? add(type) : setPicker(type)}><Plus size={12} /><Icon size={14} />{label}</Button>)}</div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-3">
        <SlideStage size={draft} fillWidth className="h-[min(52dvh,460px)] w-full bg-slate-100" canvasProps={{ "data-popup-editor-canvas": true }}>
          <div data-slide-objects className="relative h-full w-full" style={{ ...backgroundPaint(draft.backgroundColor), color: solidColor(draft.textColor) }}>{draft.blocks.map((item, index) => <SlideObject key={item.id} block={item} index={index} total={draft.blocks.length} master={master} area={draft} selected={selectedId === item.id} onSelect={() => setSelectedId(item.id)} onFrame={(slideFrame) => change({ ...item, slideFrame })} onChange={change} onEditorFocus={(editor) => { setSelectedId(item.id); setFocused({ id: item.id, editor }); }} onFooterSnap={() => {}} />)}</div>
        </SlideStage>
        {focused?.id === selectedId && !focused.editor.isDestroyed && <div className="rounded-lg border border-slate-200 bg-white p-2"><TextFormattingToolbar editor={focused.editor} /></div>}
        <p className="text-xs text-slate-500">Click text to edit. Use an object’s move handle or corner to position and resize it.</p>
      </div>
      <aside aria-label="Popup object settings" className="max-h-[52dvh] min-w-0 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-2">{draft.blocks.map((item, index) => <Button key={item.id} variant={selectedId === item.id ? "secondary" : "outline"} size="sm" className="min-w-0 truncate px-1 text-xs" aria-label={`Select popup object ${index + 1}`} onClick={() => setSelectedId(item.id)}>{index + 1}. {item.type === "richText" ? "Text" : item.type}</Button>)}</div>
        {selected && <>
          <SlideMediaPicker key={selected.id} block={selected} courseId={courseId} onChange={change} />
          <SlideObjectSizeControls block={selected} index={draft.blocks.indexOf(selected)} total={draft.blocks.length} area={draft} onChange={change} />
          <SlideObjectBackgroundControls block={selected} onChange={change} />
          {(selected.type === "audio" || selected.type === "video") && <SlidePlaybackControls block={selected} onChange={change} />}
          <Button variant="ghost" size="sm" className="w-full text-rose-600" onClick={() => { const blocks = draft.blocks.filter((item) => item.id !== selectedId); setDraft({ ...draft, blocks }); setSelectedId(blocks[0]?.id ?? null); setFocused(null); }}><Trash2 size={14} />Remove popup object</Button>
        </>}
      </aside>
    </div>
    {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    <MediaLibraryDialog courseId={courseId} kind={picker ?? "image"} open={picker !== null} onClose={() => setPicker(null)} onSelect={(asset) => { if (picker) add(picker, asset); }} />
  </Dialog>;
}
