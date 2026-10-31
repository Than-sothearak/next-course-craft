"use client";

import { useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { AlignLeft, AlignVerticalJustifyEnd, ArrowDown, ArrowUp, AudioLines, Copy, Crop, FileText, Image as ImageIcon, Layers, ListChecks, Maximize, MousePointer2, Paintbrush, SlidersHorizontal, Trash2, Type, Video, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { fitSlideFrame as fitFrame, resolveSlideFrame, resolveSlideFooterHeight, resolveSlideSize, resolveSlideTextLayout, type SlideCover, type SlideMaster } from "@/lib/editor/slide-design";
import { isSlideMediaObject } from "@/lib/editor/slide-objects";
import type { ContentBlock } from "@/lib/schemas/block";
import { ContentBlockEditor } from "../(editor_client_components)/content-block-editor";
import { SlideMasterPanel } from "./slide-master-panel";
import { SlideMediaPicker } from "./slide-media-picker";
import { SlideCoverPanel } from "./slide-cover-panel";
import { SlideInspectorTabs, type SlideInspectorTab } from "./slide-inspector-tabs";
import { isSlideTextBlock } from "./slide-text-object-editor";
import { TextFormattingToolbar } from "../(editor_client_components)/(text_editing_components)/text-formatting-toolbar";
import { CodeExampleControls } from "../(editor_client_components)/(content_block_editor_components)/(rich_text_block_editor_components)/code-example-controls";
import { SlideObjectBackgroundControls } from "./slide-object-background-controls";
import { SlideTextLayoutControls } from "./slide-text-layout-controls";
import { SlideMediaSizeControls } from "./slide-media-size-controls";
import { SlideObjectSizeControls } from "./slide-object-size-controls";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import { SlidePlaybackControls } from "./slide-playback-controls";
import { SlideInspectorSection } from "./slide-inspector-section";
import { SlideProgressControls } from "./slide-progress-controls";
import { SlideMediaCropControls } from "./slide-media-crop-controls";
import { isSlideVideoFile } from "@/lib/editor/slide-crop";

import { SlideObject } from "./slide-editable-object";
import { SlideInsertToolbar } from "./slide-insert-toolbar";

const objectIcons: Partial<Record<ContentBlock["type"], LucideIcon>> = { heading: Type, richText: AlignLeft, image: ImageIcon, gallery: ImageIcon, video: Video, audio: AudioLines, audioInstruction: AudioLines, attachment: FileText, labeledGraphic: MousePointer2, interactionButton: MousePointer2, statement: FileText };
const objectLabels: Partial<Record<ContentBlock["type"], string>> = { richText: "Text", audioInstruction: "Audio instruction", labeledGraphic: "Interactive image", interactionButton: "Interaction button", flipCard: "Flip cards", knowledgeCheck: "Question", processSteps: "Process steps", lessonMap: "Lesson map" };



export function SlideObjectWorkspace({ title, courseTitle, slideNumber, slideCount, blocks, sections, lessons, master, cover, hasCover = false, courseId, zoom, onZoomChange, onTitleChange, onMasterChange, onCoverChange, onApplyCover, onCourseTitleChange, onStart, onBlockChange, onApplyBorderRadiusToAll, onAddTemplate, onMoreTemplates, onReplaceTemplate, onDuplicate, onDelete, controls, children }: {
  title: string;
  courseTitle: string;
  slideNumber: number;
  slideCount: number;
  blocks: ContentBlock[];
  sections: { id: string; title: string; order: number }[];
  lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  master?: SlideMaster;
  cover?: SlideCover;
  hasCover?: boolean;
  courseId: string;
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  onTitleChange: (title: string) => void;
  onMasterChange: (master: SlideMaster) => void;
  onCoverChange: (cover?: SlideCover) => void;
  onApplyCover: () => void;
  onCourseTitleChange: (title: string) => void;
  onStart?: () => void;
  onBlockChange: (block: ContentBlock) => void;
  onApplyBorderRadiusToAll?: (radius: number) => void;
  onAddTemplate: (id: string) => string | null;
  onMoreTemplates: () => void;
  onReplaceTemplate: (block: ContentBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  children?: ReactNode;
  controls?: ReactNode;
}) {
  const size = resolveSlideSize(master);
  const area = size;
  const footerHeight = resolveSlideFooterHeight(master);
  const footerTop = (size.height - footerHeight) / size.height * 100;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<SlideInspectorTab>(cover ? "cover" : "object");
  const [footerSnapped, setFooterSnapped] = useState(false);
  const [focusedText, setFocusedText] = useState<{ blockId: string; editor: Editor } | null>(null);
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const SelectedIcon = selected ? objectIcons[selected.type] ?? Layers : Layers;
  const selectedLabel = selected ? objectLabels[selected.type] ?? selected.type : "Object";
  const activeTextEditor = selected && focusedText?.blockId === selected.id && !focusedText.editor.isDestroyed ? focusedText.editor : null;
  const selectObject = (id: string) => { setSelectedId(id); setInspectorTab("object"); };
  const openCover = () => { setInspectorTab("cover"); onApplyCover(); };
  const objects = <div data-slide-objects className="pointer-events-none relative h-full w-full">
    {!cover && <div className="pointer-events-auto absolute inset-x-0 top-[108px]" style={{ bottom: footerHeight }} onPointerDown={() => setSelectedId(null)} />}
    {blocks.map((block, index) => <SlideObject key={block.id} block={block} index={index} total={blocks.length} master={master} area={area} footerTop={footerTop} lessonBlocks={blocks} selected={selectedId === block.id} onSelect={() => selectObject(block.id)} onFrame={(slideFrame) => onBlockChange({ ...block, slideFrame })} onChange={onBlockChange} onFooterSnap={setFooterSnapped} onEditorFocus={(editor) => { selectObject(block.id); setFocusedText({ blockId: block.id, editor }); }} />)}
    {footerSnapped && <div data-slide-footer-guide className="pointer-events-none absolute inset-x-0 z-[1001] border-b-2 border-indigo-500" style={{ bottom: footerHeight }}><span className="absolute bottom-1 right-2 rounded bg-indigo-600 px-2 py-1 text-[10px] text-white" role="status">Snapped to footer</span></div>}
  </div>;
  return (
    <div className="space-y-3" aria-label="Presentation slide editor">
      <SlideInsertToolbar cover={Boolean(cover)} showCover={slideNumber === 1} onCover={openCover} onMore={onMoreTemplates} onInsert={(templateId) => { const id = onAddTemplate(templateId); if (id) selectObject(id); }} />
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <SlideEditorCanvas label={`Slide ${slideNumber} / ${slideCount}`} size={size} zoom={zoom} onZoomChange={onZoomChange}>
            {cover ? <SlideCoverSurface cover={cover} title={courseTitle} master={master} number={slideNumber} total={slideCount} onStart={onStart} startDisabled={!onStart} controls={controls}>{objects}</SlideCoverSurface> : <SlideSurface master={master} title={<Input aria-label="Slide title" value={title} onChange={(event) => onTitleChange(event.target.value)} style={{ color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", fontStyle: "inherit", letterSpacing: "inherit" }} className="h-auto w-full border-0 bg-transparent px-0 py-0 leading-tight shadow-none outline-none focus-visible:ring-0 placeholder:opacity-50" placeholder="Slide title" />} number={slideNumber} total={slideCount} controls={controls}>
              {objects}
            </SlideSurface>}
        </SlideEditorCanvas>
        <aside className="max-h-[760px] min-w-0 space-y-3 overflow-y-auto" aria-label="Slide inspector">
          <SlideInspectorTabs value={inspectorTab} onChange={setInspectorTab} master={<SlideMasterPanel value={master} courseId={courseId} onChange={onMasterChange} />} cover={<SlideCoverPanel cover={cover} hasCover={hasCover || Boolean(cover)} courseId={courseId} courseTitle={courseTitle} onTitleChange={onCourseTitleChange} onChange={(next) => { onCoverChange(next); if (!next) setInspectorTab("object"); }} onOpenCover={openCover} />}>
          {selected && isSlideTextBlock(selected) && <SlideInspectorSection title="Text format" label="Slide text formatting" icon={Type}>
            {activeTextEditor ? <>
              <TextFormattingToolbar editor={activeTextEditor} textAlign={selected.slideTextLayout?.horizontal} onTextAlignChange={(horizontal) => onBlockChange({ ...selected, slideTextLayout: { ...resolveSlideTextLayout(selected.slideTextLayout), horizontal } })} />
              {selected.type === "richText" && <CodeExampleControls editor={activeTextEditor} />}
            </> : <p className="text-sm text-slate-500">Click text on the slide to type or select text to format it.</p>}
          </SlideInspectorSection>}
          {blocks.length > 0 && <SlideInspectorSection title="Objects & layers" label="Slide object layers" icon={Layers}><div className="grid grid-cols-2 gap-2">{[...blocks].sort((a, b) => resolveSlideFrame(b, blocks.indexOf(b), blocks.length, area).z - resolveSlideFrame(a, blocks.indexOf(a), blocks.length, area).z).map((block, index) => { const Icon = objectIcons[block.type] ?? Layers; return <Button key={block.id} type="button" variant={selectedId === block.id ? "secondary" : "outline"} size="sm" onClick={() => selectObject(block.id)} className="min-w-0 justify-start gap-1.5 px-2" aria-label={`Select ${block.type} object from layers`}><Icon size={14} aria-hidden="true" className="shrink-0" /><span className="truncate capitalize">{index + 1}. {objectLabels[block.type] ?? block.type}</span></Button>; })}</div></SlideInspectorSection>}
          {!selected && <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{cover ? "Add an Audio instruction block above, or use Cover page settings to edit this slide." : "Select an object on the canvas or from the layers to edit its content and layout."}</section>}
          {selected && <div className="space-y-2"><div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5"><h2 className="flex items-center gap-2 text-xs font-semibold capitalize"><SelectedIcon size={15} aria-hidden="true" className="text-indigo-600" />{selectedLabel}</h2><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Duplicate object" title="Duplicate object" onClick={() => onDuplicate(selected.id)}><Copy size={14} aria-hidden="true" /></Button><Button type="button" variant="ghost" size="icon" className="size-7 text-rose-600" aria-label="Delete object" title="Delete object" onClick={() => { onDelete(selected.id); setSelectedId(null); }}><Trash2 size={14} aria-hidden="true" /></Button></div></div>
            <SlideInspectorSection title="Position & size" icon={Maximize}>
            <SlideObjectSizeControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onBlockChange({ ...selected, slideFrame: fitFrame(resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length, area), { z: Math.max(0, resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length, area).z - 1) }) })}><ArrowDown size={14} />Back</Button><Button type="button" variant="outline" size="sm" onClick={() => onBlockChange({ ...selected, slideFrame: fitFrame(resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length, area), { z: resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length, area).z + 1 }) })}><ArrowUp size={14} />Front</Button></div>
            <SlideMediaSizeControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { const frame = resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length, area); onBlockChange({ ...selected, slideFrame: fitFrame(frame, { y: Math.max(0, footerTop - frame.height) }) }); }}><AlignVerticalJustifyEnd size={14} aria-hidden="true" />Align to footer</Button>
            </SlideInspectorSection>
            {(["image", "video", "audio", "gallery", "attachment", "labeledGraphic"] as string[]).includes(selected.type) && <SlideInspectorSection title="Media source" icon={ImageIcon}>
              <SlideMediaPicker key={`media-${selected.id}`} block={selected} courseId={courseId} onChange={onBlockChange} />
            </SlideInspectorSection>}
            {isSlideMediaObject(selected) && (selected.type === "image" || isSlideVideoFile(selected)) && <SlideInspectorSection title="Crop" icon={Crop}>
              <SlideMediaCropControls key={`crop-${selected.id}-${selected.data.src}`} block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            </SlideInspectorSection>}
            {(selected.type === "video" || selected.type === "audio") && <SlideInspectorSection title="Playback" icon={Video}><SlidePlaybackControls block={selected} onChange={onBlockChange} /></SlideInspectorSection>}
            {isSlideTextBlock(selected) && <SlideInspectorSection title="Text box layout" icon={AlignLeft}><SlideTextLayoutControls block={selected} onChange={onBlockChange} /></SlideInspectorSection>}
            <SlideInspectorSection title="Appearance" icon={Paintbrush}>
            <SlideObjectBackgroundControls block={selected} onChange={onBlockChange} onApplyBorderRadiusToAll={onApplyBorderRadiusToAll} />
            </SlideInspectorSection>
            <SlideInspectorSection title="Navigation & progress" icon={ListChecks}>
              <SlideProgressControls block={selected} onChange={onBlockChange} />
            </SlideInspectorSection>
            <SlideInspectorSection title={isSlideTextBlock(selected) ? "Text content" : "Content & interaction"} icon={SlidersHorizontal}>
              {isSlideTextBlock(selected) ? <div className="space-y-3"><p className="text-xs text-slate-500">Edit text directly on the slide. Drag the move handle to reposition the object.</p><Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onReplaceTemplate(selected)}>Change block style</Button></div> : <ContentBlockEditor key={selected.id} block={selected} courseId={courseId} sections={sections} lessons={lessons} lessonBlocks={blocks} onChange={onBlockChange} onReplaceTemplate={cover ? undefined : () => onReplaceTemplate(selected)} inlineSettings />}
            </SlideInspectorSection>
          </div>}
          </SlideInspectorTabs>
        </aside>
      </div>
      {children}
    </div>
  );
}
