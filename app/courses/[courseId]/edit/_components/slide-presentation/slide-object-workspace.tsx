"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Layers } from "lucide-react";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { resolveSlideFooterHeight, resolveSlideSize, type SlideCover, type SlideMaster, type SlideHeaderStyle } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideMasterPanel } from "./slide-master-panel";
import { SlideCoverPanel } from "./slide-cover-panel";
import { SlideInspectorTabs, type SlideInspectorTab } from "./slide-inspector-tabs";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import { SlideInspectorSection } from "./slide-inspector-section";

import { SlideObject } from "./slide-editable-object";
import { SlideInsertToolbar } from "./slide-insert-toolbar";
import { SlideObjectLayers } from "./slide-object-layers";
import { SlideObjectSettings } from "./slide-object-settings";
import { SlideHeaderTitleEditor } from "./slide-header-title-editor";
import { SlideHeaderTextSettings } from "./slide-header-text-settings";
import { SlideAppearanceSettings } from "./slide-appearance-settings";
import type { SlideAppearance } from "@/lib/editor/slide-design";

export function SlideObjectWorkspace({ title, headerStyle, onHeaderStyleChange, appearance, onAppearanceChange, courseTitle, slideNumber, slideCount, blocks, sections, lessons, master, cover, hasCover = false, courseId, zoom, onZoomChange, onTitleChange, onMasterChange, onCoverChange, onApplyCover, onCourseTitleChange, onStart, onBlockChange, onReorderLayer, onApplyBorderRadiusToAll, onAddTemplate, onMoreTemplates, onReplaceTemplate, onDuplicate, onDelete, controls, children }: {
  title: string;
  headerStyle?: SlideHeaderStyle;
  onHeaderStyleChange: (style?: SlideHeaderStyle) => void;
  appearance?: SlideAppearance;
  onAppearanceChange: (appearance?: SlideAppearance) => void;
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
  onBlockChange: (block: ContentBlock, options?: { recordHistory?: boolean }) => void;
  onReorderLayer: (activeId: string, overId: string) => void;
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
  const footerHeight = appearance?.hideFooter ? 0 : resolveSlideFooterHeight(master);
  const footerTop = (size.height - footerHeight) / size.height * 100;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [headerSelected, setHeaderSelected] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
  const [inspectorTab, setInspectorTab] = useState<SlideInspectorTab>(cover ? "cover" : "object");
  const [footerSnapped, setFooterSnapped] = useState(false);
  const [focusedText, setFocusedText] = useState<{ blockId: string; editor: Editor } | null>(null);
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const activeTextEditor = selected && focusedText?.blockId === selected.id && !focusedText.editor.isDestroyed ? focusedText.editor : null;
  const selectObject = (id: string) => { setHeaderSelected(false); setSelectedId(id); setInspectorTab("object"); };
  const selectHeader = () => { setSelectedId(null); setHeaderSelected(true); setInspectorTab("object"); if (inspectorRef.current) inspectorRef.current.scrollTop = 0; };
  const openCover = () => { setInspectorTab("cover"); onApplyCover(); };
  const objects = <div data-slide-objects className="pointer-events-none relative h-full w-full">
    {!cover && <div className="pointer-events-auto absolute inset-x-0" style={{ top: appearance?.hideHeader ? 0 : 108, bottom: footerHeight }} onPointerDown={() => { setSelectedId(null); setHeaderSelected(false); }} />}
    {blocks.map((block, index) => <SlideObject key={block.id} block={block} index={index} total={blocks.length} master={master} area={area} footerTop={footerTop} lessonBlocks={blocks} selected={selectedId === block.id} onSelect={() => selectObject(block.id)} onFrame={(slideFrame, options) => onBlockChange({ ...block, slideFrame }, options)} onChange={onBlockChange} onFooterSnap={setFooterSnapped} onEditorFocus={(editor) => { selectObject(block.id); setFocusedText({ blockId: block.id, editor }); }} />)}
    {footerSnapped && <div data-slide-footer-guide className="pointer-events-none absolute inset-x-0 z-[1001] border-b-2 border-indigo-500" style={{ bottom: footerHeight }}><span className="absolute bottom-1 right-2 rounded bg-indigo-600 px-2 py-1 text-[10px] text-white" role="status">Snapped to footer</span></div>}
  </div>;
  return (
    <div className="space-y-3" aria-label="Presentation slide editor">
      <SlideInsertToolbar cover={Boolean(cover)} showCover={slideNumber === 1} onCover={openCover} onMore={onMoreTemplates} onInsert={(templateId) => { const id = onAddTemplate(templateId); if (id) selectObject(id); }} />
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <SlideEditorCanvas label={`Slide ${slideNumber} / ${slideCount}`} size={size} zoom={zoom} onZoomChange={onZoomChange}>
            {cover ? <SlideCoverSurface appearance={appearance} cover={cover} title={courseTitle} master={master} number={slideNumber} total={slideCount} onStart={onStart} startDisabled={!onStart} controls={controls}>{objects}</SlideCoverSurface> : <SlideSurface master={master} appearance={appearance} headerTextStyle={headerStyle} title={<SlideHeaderTitleEditor title={title} selected={headerSelected} onSelect={selectHeader} onChange={onTitleChange} />} number={slideNumber} total={slideCount} controls={controls}>
              {objects}
            </SlideSurface>}
        </SlideEditorCanvas>
        <aside ref={inspectorRef} className="max-h-[760px] min-w-0 space-y-3 overflow-y-auto" aria-label="Slide inspector">
          <SlideInspectorTabs value={inspectorTab} onChange={setInspectorTab} master={<SlideMasterPanel value={master} courseId={courseId} onChange={onMasterChange} />} cover={<SlideCoverPanel cover={cover} hasCover={hasCover || Boolean(cover)} courseId={courseId} courseTitle={courseTitle} onTitleChange={onCourseTitleChange} onChange={(next) => { onCoverChange(next); if (!next) setInspectorTab("object"); }} onOpenCover={openCover} />}>
          <SlideAppearanceSettings value={appearance} onChange={onAppearanceChange} master={master} courseId={courseId} />
          {headerSelected && !cover && <SlideHeaderTextSettings master={master} value={headerStyle} onChange={onHeaderStyleChange} />}
          {blocks.length > 0 && <SlideInspectorSection title="Objects & layers" label="Slide object layers" icon={Layers}><SlideObjectLayers blocks={blocks} selectedId={selectedId} onSelect={selectObject} onReorder={onReorderLayer} /></SlideInspectorSection>}
          {!selected && !headerSelected && <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{cover ? "Add an Audio instruction block above, or use Cover page settings to edit this slide." : "Select the header or an object on the canvas to edit its text and layout."}</section>}
          {selected && <SlideObjectSettings selected={selected} blocks={blocks} courseId={courseId} sections={sections} lessons={lessons} area={area} footerTop={footerTop} activeTextEditor={activeTextEditor} onBlockChange={onBlockChange} onReorderLayer={onReorderLayer} onApplyBorderRadiusToAll={onApplyBorderRadiusToAll} onDuplicate={onDuplicate} onDelete={(id) => { onDelete(id); setSelectedId(null); }} onReplaceTemplate={cover ? undefined : onReplaceTemplate} />}
          </SlideInspectorTabs>
        </aside>
      </div>
      {children}
    </div>
  );
}
