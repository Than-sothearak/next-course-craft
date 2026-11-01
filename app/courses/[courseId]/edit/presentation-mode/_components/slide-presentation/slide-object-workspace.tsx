"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import {
  resolveSlideFooterHeight,
  resolveSlideSize,
  type SlideCover,
  type SlideMaster,
  type SlideHeaderStyle,
} from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import type { SlideInspectorTab } from "./slide-inspector-tabs";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import { SlideObject } from "./slide-editable-object";
import { SlideInsertToolbar } from "./slide-insert-toolbar";
import { SlideHeaderTitleEditor } from "./slide-header-title-editor";
import { useSlideObjectClipboard } from "./use-slide-object-clipboard";
import type { SlideSnapGuide } from "@/lib/editor/slide-alignment";
import { SlideObjectSnapGuides } from "./slide-object-snap-guides";
import { SlideSnapControls } from "./slide-snap-controls";
import type { SlideAppearance } from "@/lib/editor/slide-design";
import { SlideObjectInspector } from "./slide-object-inspector";

export function SlideObjectWorkspace({
  initialSelectedId,
  title,
  headerStyle,
  onHeaderStyleChange,
  appearance,
  onAppearanceChange,
  courseTitle,
  slideNumber,
  slideCount,
  blocks,
  sections,
  lessons,
  master,
  cover,
  hasCover = false,
  courseId,
  zoom,
  onZoomChange,
  snapEnabled,
  onSnapEnabledChange,
  onTitleChange,
  onMasterChange,
  onCoverChange,
  onApplyCover,
  onCourseTitleChange,
  onStart,
  onBlockChange,
  onReorderLayer,
  onApplyBorderRadiusToAll,
  onAddTemplate,
  onMoreTemplates,
  onReplaceTemplate,
  onDuplicate,
  onPasteObject,
  onDelete,
  controls,
  children,
}: {
  initialSelectedId?: string;
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
  lessons: {
    id: string;
    title: string;
    sectionId: string;
    order: number;
    lessonType?: "content" | "quiz";
  }[];
  master?: SlideMaster;
  cover?: SlideCover;
  hasCover?: boolean;
  courseId: string;
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (enabled: boolean) => void;
  onTitleChange: (title: string) => void;
  onMasterChange: (master: SlideMaster) => void;
  onCoverChange: (cover?: SlideCover) => void;
  onApplyCover: () => void;
  onCourseTitleChange: (title: string) => void;
  onStart?: () => void;
  onBlockChange: (
    block: ContentBlock,
    options?: { recordHistory?: boolean },
  ) => void;
  onReorderLayer: (activeId: string, overId: string) => void;
  onApplyBorderRadiusToAll?: (radius: number) => void;
  onAddTemplate: (id: string) => string | null;
  onMoreTemplates: () => void;
  onReplaceTemplate: (block: ContentBlock) => void;
  onDuplicate: (id: string) => void;
  onPasteObject: (source: ContentBlock) => string;
  onDelete: (id: string) => void;
  children?: ReactNode;
  controls?: ReactNode;
}) {
  const size = resolveSlideSize(master);
  const area = size;
  const footerHeight = appearance?.hideFooter
    ? 0
    : resolveSlideFooterHeight(master);
  const footerTop = ((size.height - footerHeight) / size.height) * 100;
  const headerBottom =
    !cover && !appearance?.hideHeader ? (108 / size.height) * 100 : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    blocks.some((block) => block.id === initialSelectedId)
      ? (initialSelectedId ?? null)
      : null,
  );
  const [headerSelected, setHeaderSelected] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [inspectorTab, setInspectorTab] = useState<SlideInspectorTab>(
    cover ? "cover" : "object",
  );
  const [snapGuides, setSnapGuides] = useState<SlideSnapGuide[]>([]);
  const [focusedText, setFocusedText] = useState<{
    blockId: string;
    editor: Editor;
  } | null>(null);
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const activeTextEditor =
    selected &&
    focusedText?.blockId === selected.id &&
    !focusedText.editor.isDestroyed
      ? focusedText.editor
      : null;
  const selectObject = (id: string) => {
    setHeaderSelected(false);
    setSelectedId(id);
    setInspectorTab("object");
  };
  const clipboardNotice = useSlideObjectClipboard({
    scopeRef: workspaceRef,
    courseId,
    blocks,
    selectedId,
    area,
    onPaste: onPasteObject,
    onSelect: selectObject,
  });
  const selectHeader = () => {
    setSelectedId(null);
    setHeaderSelected(true);
    setInspectorTab("object");
    if (inspectorRef.current) inspectorRef.current.scrollTop = 0;
  };
  const openCover = () => {
    setInspectorTab("cover");
    onApplyCover();
  };
  const objects = (
    <div
      data-slide-objects
      className="pointer-events-none relative h-full w-full"
    >
      {!cover && (
        <div
          className="pointer-events-auto absolute inset-x-0"
          style={{
            top: appearance?.hideHeader ? 0 : 108,
            bottom: footerHeight,
          }}
          onPointerDown={() => {
            setSelectedId(null);
            setHeaderSelected(false);
          }}
        />
      )}
      {blocks.map((block, index) => (
        <SlideObject
          key={block.id}
          block={block}
          index={index}
          total={blocks.length}
          master={master}
          area={area}
          headerBottom={headerBottom}
          footerTop={footerTop}
          snapEnabled={snapEnabled}
          lessonBlocks={blocks}
          selected={selectedId === block.id}
          onSelect={() => selectObject(block.id)}
          onFrame={(slideFrame, options) =>
            onBlockChange({ ...block, slideFrame }, options)
          }
          onChange={onBlockChange}
          onSnapGuides={setSnapGuides}
          onEditorFocus={(editor) => {
            selectObject(block.id);
            setFocusedText({ blockId: block.id, editor });
          }}
        />
      ))}
      {selected && <SlideObjectSnapGuides guides={snapGuides} />}
    </div>
  );
  return (
    <div
      ref={workspaceRef}
      className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden"
      aria-label="Presentation slide editor"
    >
      <div className="">
        <SlideInsertToolbar
          cover={Boolean(cover)}
          showCover={slideNumber === 1}
          onCover={openCover}
          onMore={onMoreTemplates}
          onInsert={(templateId) => {
            const id = onAddTemplate(templateId);
            if (id) selectObject(id);
          }}
        />
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1">
        <SlideEditorCanvas
          fillAvailable
          label={`Slide ${slideNumber} / ${slideCount}`}
          size={size}
          zoom={zoom}
          onZoomChange={onZoomChange}
          toolbar={
            <SlideSnapControls
              enabled={snapEnabled}
              onChange={onSnapEnabledChange}
              compact
            />
          }
        >
          {cover ? (
            <SlideCoverSurface
              appearance={appearance}
              cover={cover}
              title={courseTitle}
              master={master}
              number={slideNumber}
              total={slideCount}
              onStart={onStart}
              startDisabled={!onStart}
              controls={controls}
            >
              {objects}
            </SlideCoverSurface>
          ) : (
            <SlideSurface
              master={master}
              appearance={appearance}
              headerTextStyle={headerStyle}
              title={
                <SlideHeaderTitleEditor
                  title={title}
                  selected={headerSelected}
                  onSelect={selectHeader}
                  onChange={onTitleChange}
                />
              }
              number={slideNumber}
              total={slideCount}
              controls={controls}
            >
              {objects}
            </SlideSurface>
          )}
        </SlideEditorCanvas>
        <SlideObjectInspector
          inspectorRef={inspectorRef}
          clipboardNotice={clipboardNotice}
          inspectorTab={inspectorTab}
          onInspectorTabChange={setInspectorTab}
          master={master}
          onMasterChange={onMasterChange}
          cover={cover}
          hasCover={hasCover}
          courseId={courseId}
          courseTitle={courseTitle}
          onCourseTitleChange={onCourseTitleChange}
          onCoverChange={onCoverChange}
          onApplyCover={openCover}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          headerSelected={headerSelected}
          headerStyle={headerStyle}
          onHeaderStyleChange={onHeaderStyleChange}
          blocks={blocks}
          selectedId={selectedId}
          onSelectObject={selectObject}
          selected={selected}
          sections={sections}
          lessons={lessons}
          area={area}
          headerBottom={headerBottom}
          footerTop={footerTop}
          activeTextEditor={activeTextEditor}
          onBlockChange={onBlockChange}
          onReorderLayer={onReorderLayer}
          onApplyBorderRadiusToAll={onApplyBorderRadiusToAll}
          onDuplicate={onDuplicate}
          onDelete={(id) => {
            onDelete(id);
            setSelectedId(null);
          }}
          onReplaceTemplate={onReplaceTemplate}
        />
      </div>
      {children}
    </div>
  );
}
