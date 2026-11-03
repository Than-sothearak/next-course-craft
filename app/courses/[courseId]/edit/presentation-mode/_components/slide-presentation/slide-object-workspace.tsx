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
import { useSlideSelection } from "./use-slide-selection";
import { SlideSelectionOverlay } from "./slide-selection-overlay";
import { SlideCanvasMediaReplace } from "./slide-canvas-media-replace";

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
  onBlocksChange,
  onReorderLayer,
  onApplyBorderRadiusToAll,
  onAddTemplate,
  onMoreTemplates,
  onReplaceTemplate,
  onPasteObject,
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
  onBlocksChange: (blocks: ContentBlock[]) => void;
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
  const [headerSelected, setHeaderSelected] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const selection = useSlideSelection({ blocks, area, scopeRef: workspaceRef, onBlocksChange, initialSelectedId, cover: Boolean(cover) });
  const selectedId = selection.selectedId;
  const setSelectedId = (id: string | null) => id ? selection.selectObject(id) : selection.clear();
  const changeBlock: typeof onBlockChange = (block, options) => { if (!selection.lockedIds.has(block.id)) onBlockChange(block, options); };
  const [inspectorTab, setInspectorTab] = useState<SlideInspectorTab>(
    cover ? "cover" : "object",
  );
  const [snapGuides, setSnapGuides] = useState<SlideSnapGuide[]>([]);
  const [focusedText, setFocusedText] = useState<{
    blockId: string;
    editor: Editor;
  } | null>(null);
  const selected = selection.selectedIds.length === 1 ? blocks.find((block) => block.id === selectedId) ?? null : null;
  const activeTextEditor =
    selected &&
    focusedText?.blockId === selected.id &&
    !focusedText.editor.isDestroyed
      ? focusedText.editor
      : null;
  const selectObject = (id: string, modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    setHeaderSelected(false);
    if (blocks.some((block) => block.id === id)) selection.selectObject(id, modifiers); else selection.selectIds([id]);
    setInspectorTab("object");
  };
  const clipboardNotice = useSlideObjectClipboard({
    scopeRef: workspaceRef,
    courseId,
    blocks,
    selectedId,
    selectedIds: selection.selectedIds,
    onPasteMany: selection.paste,
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
      {selection.renderBlocks.map((block, index) => !selection.hiddenIds.has(block.id) && (
        <SlideObject
          key={block.id}
          block={block}
          courseId={courseId}
          index={index}
          total={blocks.length}
          master={master}
          area={area}
          headerBottom={headerBottom}
          footerTop={footerTop}
          snapEnabled={snapEnabled}
          lessonBlocks={blocks}
          selected={selection.selectedIds.includes(block.id)}
          readOnly={selection.lockedIds.has(block.id)}
          suppressTransforms={selection.selectedIds.length > 1 || Boolean(block.slideGroupId && selection.memberGroupId !== block.slideGroupId)}
          suspendAutoFit={selection.transforming}
          onPointerSelect={(event) => { setHeaderSelected(false); setInspectorTab("object"); return selection.objectPointerDown(block.id, event); }}
          onEnterMember={() => selection.enterMember(block.id)}
          onSelect={() => selectObject(block.id)}
          onFrame={(slideFrame, options) =>
            changeBlock({ ...block, slideFrame }, options)
          }
          onChange={changeBlock}
          onSnapGuides={setSnapGuides}
          onEditorFocus={(editor) => {
            selectObject(block.id);
            setFocusedText({ blockId: block.id, editor });
          }}
        />
      ))}
      {selected && <SlideObjectSnapGuides guides={snapGuides} />}
      <SlideSelectionOverlay selection={selection} />
    </div>
  );
  return (
    <div
      ref={workspaceRef}
      tabIndex={-1}
      onPointerDownCapture={selection.backgroundPointerDown}
      onPointerMoveCapture={selection.pointerMove}
      onPointerUpCapture={selection.pointerUp}
      onPointerCancelCapture={selection.cancel}
      onLostPointerCapture={selection.cancel}
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
          overlay={<SlideCanvasMediaReplace block={selection.editable ? selected : null} courseId={courseId} onChange={changeBlock} />}
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
          clipboardNotice={selection.notice ?? clipboardNotice}
          selection={selection}
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
          onSelectObject={(id, modifiers) => { setHeaderSelected(false); selection.selectLayer(id, modifiers); setInspectorTab("object"); }}
          selected={selected}
          sections={sections}
          lessons={lessons}
          area={area}
          headerBottom={headerBottom}
          footerTop={footerTop}
          activeTextEditor={activeTextEditor}
          onBlockChange={changeBlock}
          onReorderLayer={onReorderLayer}
          onApplyBorderRadiusToAll={onApplyBorderRadiusToAll}
          onDuplicate={() => selection.duplicate()}
          onDelete={() => selection.remove()}
          onReplaceTemplate={onReplaceTemplate}
        />
      </div>
      {children}
    </div>
  );
}
