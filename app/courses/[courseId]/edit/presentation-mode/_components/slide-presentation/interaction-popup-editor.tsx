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
import { useSlideSelection } from "./use-slide-selection";
import { SlideSelectionOverlay } from "./slide-selection-overlay";
import { SlideSelectionControls } from "./slide-selection-controls";
import { SlideCanvasMediaReplace } from "./slide-canvas-media-replace";

type Popup = Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"];
export type PopupTargets = { sections: { id: string; title: string; order: number }[]; lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[] };
export function InteractionPopupEditor({ popup, courseId, sections, lessons, onApply, onClose }: PopupTargets & { popup: Popup; courseId: string; onApply: (popup: Popup) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(popup));
  const [focused, setFocused] = useState<{ id: string; editor: Editor } | null>(null);
  const [picker, setPicker] = useState<{ template: BlockTemplate; replace?: ContentBlock } | null>(null);
  const [templates, setTemplates] = useState<{ replace?: ContentBlock } | null>(null);
  const [error, setError] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<SlideSnapGuide[]>([]);
  const clipboardRef = useRef<HTMLDivElement>(null);
  function replaceBlocks(blocks: ContentBlock[]) {
    const next = { ...draft, blocks };
    const parsed = blockSchema.safeParse({ id: "popup-draft", version: 1, type: "interactionButton", data: { popup: next } });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the popup objects.");
    setDraft(next); setError("");
  }
  const selection = useSlideSelection({ blocks: draft.blocks, area: draft, scopeRef: clipboardRef, onBlocksChange: replaceBlocks, initialSelectedId: popup.blocks[0]?.id, maximum: 20 });
  const selectedId = selection.selectedId;
  const setSelectedId = (id: string | null) => id ? selection.selectIds([id]) : selection.clear();
  const selected = selection.selectedIds.length === 1 ? draft.blocks.find((item) => item.id === selectedId) : undefined;
  const master = slideMasterSchema.parse({ backgroundColor: draft.backgroundColor, textColor: draft.textColor });
  const reorder = (activeId: string, overId: string) => setDraft((current) => ({ ...current, blocks: reorderSlideLayers(current.blocks, activeId, overId, current) }));
  const clipboardNotice = useSlideObjectClipboard({ scopeRef: clipboardRef, courseId, blocks: draft.blocks, selectedId, selectedIds: selection.selectedIds, onPasteMany: selection.paste, area: draft, onSelect: (id) => { setSelectedId(id); setFocused(null); }, onPaste: (source) => {
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
    if (selection.lockedIds.has(next.id)) return;
    const parsed = blockSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check this object's settings."); return; }
    setDraft((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === next.id ? parsed.data : item) })); setError("");
  }
  function add(template: BlockTemplate, asset?: MediaLibraryAsset, replacing = templates?.replace) {
    if (!replacing && draft.blocks.length >= 20) { setError("A popup can contain up to 20 objects."); return; }
    if (!asset && replacing?.type !== template.type && ["image", "video", "audio"].includes(template.type)) { setPicker({ template, replace: replacing }); setTemplates(null); return; }
    const id = replacing?.id ?? createClientId();
    const created = createSlideBlocksFromTemplate(template, id, { sections, lessons }).map((block, offset) => {
      let next: ContentBlock = { ...block, slideGroupId: replacing?.slideGroupId, slideLocked: replacing?.slideLocked, slideHiddenInEditor: replacing?.slideHiddenInEditor, slideAnimation: replacing?.slideAnimation, blockPadding: Math.min(block.blockPadding, 12), slideFrame: replacing?.slideFrame ?? defaultSlideFrame(draft.blocks.length + offset, block.type) };
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
  function apply() {
    const parsed = blockSchema.safeParse({ id: "popup-draft", version: 1, type: "interactionButton", data: { popup: draft } });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the popup objects before applying."); return; }
    if (parsed.data.type === "interactionButton") onApply(parsed.data.data.popup);
  }
  return <Dialog open onClose={onClose} title="Edit popup mini slide" className="max-w-7xl" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={apply}>Apply popup</Button></>}>
    <fieldset disabled={draft.blocks.length >= 20} className="mb-3 min-w-0"><SlideInsertToolbar onInsert={(id) => { const template = blockTemplates.find((item) => item.id === id); if (template) add(template); }} onCover={() => {}} onMore={() => setTemplates({})} /></fieldset>
    <div ref={clipboardRef} tabIndex={-1} onPointerDownCapture={selection.backgroundPointerDown} onPointerMoveCapture={selection.pointerMove} onPointerUpCapture={selection.pointerUp} onPointerCancelCapture={selection.cancel} onLostPointerCapture={selection.cancel} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <section className="overflow-hidden border border-slate-200 bg-slate-100">
        <div data-slide-editor-toolbar role="group" aria-label="Popup canvas toolbar" className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><span className="font-medium">Popup canvas</span><SlideSnapControls enabled={snapEnabled} onChange={setSnapEnabled} compact /></div>
        <SlideStage size={draft} fillWidth className="h-[min(52dvh,460px)] w-full bg-slate-100" canvasProps={{ "data-popup-editor-canvas": true }} overlay={<SlideCanvasMediaReplace block={selection.editable ? selected : null} courseId={courseId} onChange={change} />}>
          <div data-slide-objects className="relative h-full w-full" style={{ ...backgroundPaint(draft.backgroundColor), color: solidColor(draft.textColor) }}>{selection.renderBlocks.map((item, index) => !selection.hiddenIds.has(item.id) && <SlideObject key={item.id} courseId={courseId} block={item} lessonBlocks={draft.blocks} index={index} total={draft.blocks.length} master={master} area={draft} snapEnabled={snapEnabled} selected={selection.selectedIds.includes(item.id)} readOnly={selection.lockedIds.has(item.id)} suspendAutoFit={selection.transforming} suppressTransforms={selection.selectedIds.length > 1 || Boolean(item.slideGroupId && selection.memberGroupId !== item.slideGroupId)} onPointerSelect={(event) => selection.objectPointerDown(item.id, event)} onEnterMember={() => selection.enterMember(item.id)} onSelect={() => selection.selectObject(item.id)} onFrame={(slideFrame) => change({ ...item, slideFrame })} onChange={change} onEditorFocus={(editor) => { setSelectedId(item.id); setFocused({ id: item.id, editor }); }} onSnapGuides={setSnapGuides} />)}{selected && <SlideObjectSnapGuides guides={snapGuides} />}<SlideSelectionOverlay selection={selection} /></div>
        </SlideStage>
        </section>
        <p className="text-xs text-slate-500">Click text to edit. Use the move handle, eight resize points, or circular rotation handle. Hold Shift while rotating to snap to 15°.</p>
      </div>
      <aside aria-label="Popup object settings" className="max-h-[52dvh] min-w-0 space-y-3 overflow-y-auto">
        <SlideInspectorSections label="Popup object">
          <SlideSelectionControls selection={selection} blocks={draft.blocks} />
          <SlideInspectorSection title="Objects & layers" icon={Layers}><SlideObjectLayers blocks={draft.blocks} selectedId={selectedId} selectedIds={selection.selectedIds} onSelect={(id, modifiers) => selection.selectLayer(id, modifiers)} onToggleSelect={(id) => selection.selectLayer(id, { shiftKey: true })} onSelectMember={selection.enterMember} onToggleFlag={selection.toggleFlag} onReorder={reorder} /></SlideInspectorSection>
          {selected && <fieldset disabled={!selection.editable} inert={!selection.editable}><SlideObjectSettings selected={selected} blocks={draft.blocks} courseId={courseId} sections={sections} lessons={lessons} area={draft} activeTextEditor={focused?.id === selectedId && !focused.editor.isDestroyed ? focused.editor : null} onBlockChange={change} onReorderLayer={reorder} onDuplicate={() => selection.duplicate()} onDelete={() => selection.remove()} onReplaceTemplate={(block) => setTemplates({ replace: block })} /></fieldset>}
        </SlideInspectorSections>
      </aside>
    </div>
    {clipboardNotice && <p role={clipboardNotice.error ? "alert" : "status"} className={`mt-3 text-xs ${clipboardNotice.error ? "text-rose-700" : "text-slate-500"}`}>{clipboardNotice.message}</p>}
    {selection.notice && <p role={selection.notice.error ? "alert" : "status"} className="mt-3 text-xs text-rose-700">{selection.notice.message}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    <MediaLibraryDialog courseId={courseId} kind={picker?.template.type === "video" ? "video" : picker?.template.type === "audio" ? "audio" : "image"} open={picker !== null} onClose={() => setPicker(null)} onSelect={(asset) => { if (picker) add(picker.template, asset, picker.replace); }} />
    <BlockTemplatePicker open={templates !== null} nativeDialog mode={templates?.replace ? "replace" : "add"} onClose={() => setTemplates(null)} onSelect={(template) => add(template)} />
  </Dialog>;
}
