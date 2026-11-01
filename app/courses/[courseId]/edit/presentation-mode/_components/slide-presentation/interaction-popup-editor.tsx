"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createClientId } from "@/lib/client-id";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { backgroundPaint, solidColor } from "@/lib/color";
import { defaultSlideFrame, slideMasterSchema } from "@/lib/editor/slide-design";
import { duplicateLessonBlocks, removeLessonBlock } from "@/lib/editor/course-content";
import { reorderSlideLayers } from "@/lib/editor/slide-layers";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { SlideObject } from "./slide-editable-object";
import { SlideObjectSettings } from "./slide-object-settings";
import { SlideObjectLayers } from "./slide-object-layers";
import { SlideInspectorSection, SlideInspectorSections } from "./slide-inspector-section";
import { SlideInsertToolbar } from "./slide-insert-toolbar";
import { BlockTemplatePicker } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/block-template-picker";
import { blockTemplates, type BlockTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { MediaLibraryDialog, type MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import { pasteSlideObject } from "@/lib/editor/slide-clipboard";
import { useSlideObjectClipboard } from "./use-slide-object-clipboard";
import type { SlideSnapGuide } from "@/lib/editor/slide-alignment";
import { SlideObjectSnapGuides } from "./slide-object-snap-guides";
import { SlideSnapControls } from "./slide-snap-controls";

type Popup = Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"];
export type PopupTargets = { sections: { id: string; title: string; order: number }[]; lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[] };
export function InteractionPopupEditor({ popup, courseId, sections, lessons, onApply, onClose }: PopupTargets & { popup: Popup; courseId: string; onApply: (popup: Popup) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(popup));
  const [selectedId, setSelectedId] = useState<string | null>(popup.blocks[0]?.id ?? null);
  const [focused, setFocused] = useState<{ id: string; editor: Editor } | null>(null);
  const [picker, setPicker] = useState<{ template: BlockTemplate; replace?: ContentBlock } | null>(null);
  const [templates, setTemplates] = useState<{ replace?: ContentBlock } | null>(null);
  const [error, setError] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<SlideSnapGuide[]>([]);
  const clipboardRef = useRef<HTMLDivElement>(null);
  const selected = draft.blocks.find((item) => item.id === selectedId);
  const master = slideMasterSchema.parse({ backgroundColor: draft.backgroundColor, textColor: draft.textColor });
  const reorder = (activeId: string, overId: string) => setDraft((current) => ({ ...current, blocks: reorderSlideLayers(current.blocks, activeId, overId, current) }));
  const clipboardNotice = useSlideObjectClipboard({ scopeRef: clipboardRef, courseId, blocks: draft.blocks, selectedId, area: draft, onSelect: (id) => { setSelectedId(id); setFocused(null); }, onPaste: (source) => {
    if (draft.blocks.length >= 20) throw new Error("A popup can contain up to 20 objects.");
    const copy = pasteSlideObject(source, draft.blocks, createClientId);
    const next = { ...draft, blocks: [...draft.blocks, copy] };
    const parsed = blockSchema.safeParse({ id: "popup-draft", version: 1, type: "interactionButton", data: { popup: next } });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "This object cannot be pasted into this popup.");
    setDraft(next);
    setError("");
    return copy.id;
  } });
  function change(next: ContentBlock) {
    const parsed = blockSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check this object's settings."); return; }
    setDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === next.id ? parsed.data : item) })); setError("");
  }
  function add(template: BlockTemplate, asset?: MediaLibraryAsset, replacing = templates?.replace) {
    if (!replacing && draft.blocks.length >= 20) { setError("A popup can contain up to 20 objects."); return; }
    if (!asset && replacing?.type !== template.type && ["image", "video", "audio"].includes(template.type)) { setPicker({ template, replace: replacing }); setTemplates(null); return; }
    const id = replacing?.id ?? createClientId();
    const created = createSlideBlocksFromTemplate(template, id, { sections, lessons }).map((block, offset) => {
      let next: ContentBlock = { ...block, slideAnimation: replacing?.slideAnimation, blockPadding: Math.min(block.blockPadding, 12), slideFrame: replacing?.slideFrame ?? defaultSlideFrame(draft.blocks.length + offset, block.type) };
      if (!asset && replacing?.type === "image" && next.type === "image") next = { ...next, slideMedia: replacing.slideMedia, slideCrop: replacing.slideCrop, data: { ...next.data, src: replacing.data.src, alt: replacing.data.alt } };
      if (!asset && replacing?.type === "video" && next.type === "video") next = { ...next, slideMedia: replacing.slideMedia, slideCrop: replacing.slideCrop, data: { ...next.data, ...replacing.data } };
      if (!asset && replacing?.type === "audio" && next.type === "audio") next = { ...next, data: { ...next.data, ...replacing.data } };
      if (asset && next.type === "image") next = { ...next, data: { ...next.data, src: asset.fileUrl, alt: asset.originalName } };
      if (asset && next.type === "video") next = { ...next, data: { ...next.data, src: asset.fileUrl, mimeType: asset.contentType as "video/mp4" | "video/webm" } };
      if (asset && next.type === "audio") next = { ...next, data: { ...next.data, src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType as "audio/mpeg" } };
      return next;
    });
    const parsed = blockSchema.array().safeParse(created);
    if (!parsed.success) { setError("Choose a supported image, MP4/WebM video, or audio file."); return; }
    if (replacing) change(parsed.data[0]); else setDraft((current) => ({ ...current, blocks: [...current.blocks, ...parsed.data] }));
    setSelectedId(id); setFocused(null); setPicker(null); setTemplates(null); setError("");
  }
  function duplicate(id: string) {
    if (draft.blocks.length >= 20) { setError("A popup can contain up to 20 objects."); return; }
    const source = draft.blocks.find((block) => block.id === id);
    if (!source) return;
    let copy = duplicateLessonBlocks([source], createClientId)[0];
    if (copy.type === "interactionButton" && source.type === "interactionButton") copy = { ...copy, data: { ...copy.data, targetBlockId: source.data.targetBlockId } };
    setDraft((current) => ({ ...current, blocks: [...current.blocks, { ...copy, slideFrame: { ...(copy.slideFrame ?? defaultSlideFrame(current.blocks.length, copy.type)), z: Math.min(500, Math.max(0, ...current.blocks.map((block) => block.slideFrame?.z ?? 0)) + 1) } }] })); setSelectedId(copy.id); setFocused(null);
  }
  function apply() {
    const parsed = blockSchema.safeParse({ id: "popup-draft", version: 1, type: "interactionButton", data: { popup: draft } });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the popup objects before applying."); return; }
    if (parsed.data.type === "interactionButton") onApply(parsed.data.data.popup);
  }
  return <Dialog open onClose={onClose} title="Edit popup mini slide" className="max-w-7xl" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={apply}>Apply popup</Button></>}>
    <fieldset disabled={draft.blocks.length >= 20} className="mb-3 min-w-0"><SlideInsertToolbar onInsert={(id) => { const template = blockTemplates.find((item) => item.id === id); if (template) add(template); }} onCover={() => {}} onMore={() => setTemplates({})} /></fieldset>
    <div ref={clipboardRef} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <section className="overflow-hidden border border-slate-200 bg-slate-100">
        <div data-slide-editor-toolbar role="group" aria-label="Popup canvas toolbar" className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><span className="font-medium">Popup canvas</span><SlideSnapControls enabled={snapEnabled} onChange={setSnapEnabled} compact /></div>
        <SlideStage size={draft} fillWidth className="h-[min(52dvh,460px)] w-full bg-slate-100" canvasProps={{ "data-popup-editor-canvas": true }}>
          <div data-slide-objects className="relative h-full w-full" style={{ ...backgroundPaint(draft.backgroundColor), color: solidColor(draft.textColor) }}>{draft.blocks.map((item, index) => <SlideObject key={item.id} block={item} lessonBlocks={draft.blocks} index={index} total={draft.blocks.length} master={master} area={draft} snapEnabled={snapEnabled} selected={selectedId === item.id} onSelect={() => setSelectedId(item.id)} onFrame={(slideFrame) => change({ ...item, slideFrame })} onChange={change} onEditorFocus={(editor) => { setSelectedId(item.id); setFocused({ id: item.id, editor }); }} onSnapGuides={setSnapGuides} />)}{selected && <SlideObjectSnapGuides guides={snapGuides} />}</div>
        </SlideStage>
        </section>
        <p className="text-xs text-slate-500">Click text to edit. Use the move handle, eight resize points, or circular rotation handle. Hold Shift while rotating to snap to 15°.</p>
      </div>
      <aside aria-label="Popup object settings" className="max-h-[52dvh] min-w-0 space-y-3 overflow-y-auto">
        <SlideInspectorSections label="Popup object">
          <SlideInspectorSection title="Objects & layers" icon={Layers}><SlideObjectLayers blocks={draft.blocks} selectedId={selectedId} onSelect={setSelectedId} onReorder={reorder} /></SlideInspectorSection>
          {selected && <SlideObjectSettings selected={selected} blocks={draft.blocks} courseId={courseId} sections={sections} lessons={lessons} area={draft} activeTextEditor={focused?.id === selectedId && !focused.editor.isDestroyed ? focused.editor : null} onBlockChange={change} onReorderLayer={reorder} onDuplicate={duplicate} onDelete={(id) => { const blocks = removeLessonBlock(draft.blocks, id); setDraft({ ...draft, blocks }); setSelectedId(blocks[0]?.id ?? null); setFocused(null); }} onReplaceTemplate={(block) => setTemplates({ replace: block })} />}
        </SlideInspectorSections>
      </aside>
    </div>
    {clipboardNotice && <p role={clipboardNotice.error ? "alert" : "status"} className={`mt-3 text-xs ${clipboardNotice.error ? "text-rose-700" : "text-slate-500"}`}>{clipboardNotice.message}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    <MediaLibraryDialog courseId={courseId} kind={picker?.template.type === "video" ? "video" : picker?.template.type === "audio" ? "audio" : "image"} open={picker !== null} onClose={() => setPicker(null)} onSelect={(asset) => { if (picker) add(picker.template, asset, picker.replace); }} />
    <BlockTemplatePicker open={templates !== null} nativeDialog mode={templates?.replace ? "replace" : "add"} onClose={() => setTemplates(null)} onSelect={(template) => add(template)} />
  </Dialog>;
}
