"use client";

import type { Editor } from "@tiptap/react";
import { AlignLeft, ArrowDown, ArrowUp, Copy, Crop, Image as ImageIcon, Layers, ListChecks, Maximize, Paintbrush, SlidersHorizontal, Sparkles, Trash2, Type, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveSlideTextLayout, type SlideSize } from "@/lib/editor/slide-design";
import { isSlideMediaObject } from "@/lib/editor/slide-objects";
import { isSlideVideoFile } from "@/lib/editor/slide-crop";
import { getSlideLayers } from "@/lib/editor/slide-layers";
import type { ContentBlock } from "@/lib/schemas/block";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { TextFormattingToolbar } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";
import { CodeExampleControls } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/(rich_text_block_editor_components)/code-example-controls";
import { SlideInspectorSection } from "./slide-inspector-section";
import { objectIcons, objectLabels } from "./slide-object-labels";
import { isSlideTextBlock } from "./slide-text-object-editor";
import { SlideMediaPicker, slideMediaKind } from "./slide-media-picker";
import { SlideMediaOverlayControls } from "./slide-media-overlay-controls";
import { SlideMediaCropControls } from "./slide-media-crop-controls";
import { SlideObjectSizeControls } from "./slide-object-size-controls";
import { SlideMediaSizeControls } from "./slide-media-size-controls";
import { SlideAudioSizeControls } from "./slide-audio-size-controls";
import { SlideObjectBackgroundControls } from "./slide-object-background-controls";
import { SlideObjectBorderControls } from "./slide-object-border-controls";
import { SlideObjectAlignmentControls } from "./slide-object-alignment-controls";
import { SlidePlaybackControls } from "./slide-playback-controls";
import { SlideTextLayoutControls } from "./slide-text-layout-controls";
import { SlideProgressControls } from "./slide-progress-controls";
import { SlideObjectAnimationControls } from "./slide-object-animation-controls";

type Props = {
  selected: ContentBlock;
  blocks: ContentBlock[];
  courseId: string;
  sections: { id: string; title: string; order: number }[];
  lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  area: SlideSize;
  footerTop?: number;
  headerBottom?: number;
  activeTextEditor: Editor | null;
  onBlockChange: (block: ContentBlock) => void;
  onReorderLayer: (activeId: string, overId: string) => void;
  onApplyBorderRadiusToAll?: (radius: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReplaceTemplate?: (block: ContentBlock) => void;
};

export function SlideObjectSettings({ selected, blocks, courseId, sections, lessons, area, footerTop, headerBottom, activeTextEditor, onBlockChange, onReorderLayer, onApplyBorderRadiusToAll, onDuplicate, onDelete, onReplaceTemplate }: Props) {
  const layers = getSlideLayers(blocks);
  const selectedLayerIndex = layers.findIndex((block) => block.id === selected.id);
  const SelectedIcon = objectIcons[selected.type] ?? Layers;
  const selectedLabel = objectLabels[selected.type] ?? selected.type;
  return <section data-slide-object-settings={selected.id} aria-label={`${selectedLabel} object settings`} className="min-w-0 rounded-lg border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><h2 className="flex items-center gap-2 text-xs font-semibold capitalize"><SelectedIcon size={15} aria-hidden="true" className="text-indigo-600" />{selectedLabel}</h2><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Duplicate object" title="Duplicate object" onClick={() => onDuplicate(selected.id)}><Copy size={14} aria-hidden="true" /></Button><Button type="button" variant="ghost" size="icon" className="size-7 text-rose-600" aria-label="Delete object" title="Delete object" onClick={() => { onDelete(selected.id); }}><Trash2 size={14} aria-hidden="true" /></Button></div></div>
            <div className="space-y-2 p-2">
            <SlideInspectorSection title={isSlideTextBlock(selected) ? "Text content" : "Content & interaction"} icon={SlidersHorizontal}>
              {isSlideTextBlock(selected) ? <div className="space-y-3"><p className="text-xs text-slate-500">Edit text directly on the slide. Drag the move handle to reposition the object.</p>{onReplaceTemplate && <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onReplaceTemplate(selected)}>Change block style</Button>}</div> : <ContentBlockEditor key={selected.id} block={selected} courseId={courseId} sections={sections} lessons={lessons} lessonBlocks={blocks} onChange={onBlockChange} onReplaceTemplate={onReplaceTemplate ? () => onReplaceTemplate(selected) : undefined} inlineSettings />}
            </SlideInspectorSection>
            {slideMediaKind(selected) && <SlideInspectorSection title="Media source" icon={ImageIcon}>
              <SlideMediaPicker key={`media-${selected.id}`} block={selected} courseId={courseId} onChange={onBlockChange} />
              <SlideMediaOverlayControls block={selected} onChange={onBlockChange} />
            </SlideInspectorSection>}
            {(selected.type === "video" || selected.type === "audio") && <SlideInspectorSection title="Playback" icon={Video}><SlidePlaybackControls block={selected} onChange={onBlockChange} /></SlideInspectorSection>}
            <SlideInspectorSection title="Position & size" icon={Maximize}>
            <SlideAudioSizeControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            <SlideObjectSizeControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={selectedLayerIndex === layers.length - 1} onClick={() => onReorderLayer(selected.id, layers[selectedLayerIndex + 1].id)}><ArrowDown size={14} />Back</Button><Button type="button" variant="outline" size="sm" disabled={selectedLayerIndex === 0} onClick={() => onReorderLayer(selected.id, layers[selectedLayerIndex - 1].id)}><ArrowUp size={14} />Front</Button></div>
            <SlideMediaSizeControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            <SlideObjectAlignmentControls block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} headerBottom={headerBottom} footerTop={footerTop} onChange={onBlockChange} />
            </SlideInspectorSection>
            {isSlideTextBlock(selected) && <SlideInspectorSection title="Text format" label="Slide text formatting" icon={Type}>
              {activeTextEditor ? <>
                <TextFormattingToolbar editor={activeTextEditor} textAlign={selected.slideTextLayout?.horizontal} onTextAlignChange={(horizontal) => onBlockChange({ ...selected, slideTextLayout: { ...resolveSlideTextLayout(selected.slideTextLayout), horizontal } })} />
                {selected.type === "richText" && <CodeExampleControls editor={activeTextEditor} />}
              </> : <p className="text-sm text-slate-500">Click text on the slide to type or select text to format it.</p>}
            </SlideInspectorSection>}
            {isSlideMediaObject(selected) && (selected.type === "image" || isSlideVideoFile(selected)) && <SlideInspectorSection title="Crop" icon={Crop}>
              <SlideMediaCropControls key={`crop-${selected.id}-${selected.data.src}`} block={selected} index={blocks.indexOf(selected)} total={blocks.length} area={area} onChange={onBlockChange} />
            </SlideInspectorSection>}
            {isSlideTextBlock(selected) && <SlideInspectorSection title="Text box layout" icon={AlignLeft}><SlideTextLayoutControls block={selected} onChange={onBlockChange} /></SlideInspectorSection>}
            <SlideInspectorSection title="Appearance" icon={Paintbrush}>
            <SlideObjectBackgroundControls block={selected} onChange={onBlockChange} />
            <SlideObjectBorderControls block={selected} onChange={onBlockChange} onApplyBorderRadiusToAll={onApplyBorderRadiusToAll} />
            </SlideInspectorSection>
            <SlideInspectorSection title="Animation" icon={Sparkles}><SlideObjectAnimationControls block={selected} onChange={onBlockChange} /></SlideInspectorSection>
            <SlideInspectorSection title="Navigation & progress" icon={ListChecks}>
              <SlideProgressControls block={selected} onChange={onBlockChange} />
            </SlideInspectorSection>
            </div>
          </section>;
}
