"use client";

import type { Ref } from "react";
import type { Editor } from "@tiptap/react";
import { Layers } from "lucide-react";
import type {
  SlideAppearance,
  SlideCover,
  SlideHeaderStyle,
  SlideMaster,
  SlideSize,
} from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideAppearanceSettings } from "./slide-appearance-settings";
import { SlideCoverPanel } from "./slide-cover-panel";
import { SlideEditorInspector } from "./slide-editor-inspector";
import { SlideHeaderTextSettings } from "./slide-header-text-settings";
import { SlideInspectorSection } from "./slide-inspector-section";
import { SlideInspectorTabs, type SlideInspectorTab } from "./slide-inspector-tabs";
import { SlideMasterPanel } from "./slide-master-panel";
import { SlideObjectLayers } from "./slide-object-layers";
import { SlideObjectSettings } from "./slide-object-settings";
import { SlideSelectionControls } from "./slide-selection-controls";
import type { SlideSelection } from "./use-slide-selection";

type ClipboardNotice = { message: string; error: boolean } | null;

type Props = {
  inspectorRef: Ref<HTMLElement>;
  selection: SlideSelection;
  clipboardNotice: ClipboardNotice;
  inspectorTab: SlideInspectorTab;
  onInspectorTabChange: (tab: SlideInspectorTab) => void;
  master?: SlideMaster;
  onMasterChange: (master: SlideMaster) => void;
  cover?: SlideCover;
  hasCover: boolean;
  courseId: string;
  courseTitle: string;
  onCourseTitleChange: (title: string) => void;
  onCoverChange: (cover?: SlideCover) => void;
  onApplyCover: () => void;
  appearance?: SlideAppearance;
  onAppearanceChange: (appearance?: SlideAppearance) => void;
  headerSelected: boolean;
  headerStyle?: SlideHeaderStyle;
  onHeaderStyleChange: (style?: SlideHeaderStyle) => void;
  blocks: ContentBlock[];
  selectedId: string | null;
  onSelectObject: (id: string, modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
  selected: ContentBlock | null;
  sections: { id: string; title: string; order: number }[];
  lessons: {
    id: string;
    title: string;
    sectionId: string;
    order: number;
    lessonType?: "content" | "quiz";
  }[];
  area: SlideSize;
  headerBottom?: number;
  footerTop: number;
  activeTextEditor: Editor | null;
  onBlockChange: (block: ContentBlock) => void;
  onReorderLayer: (activeId: string, overId: string) => void;
  onApplyBorderRadiusToAll?: (radius: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReplaceTemplate?: (block: ContentBlock) => void;
};

export function SlideObjectInspector({
  inspectorRef,
  selection,
  clipboardNotice,
  inspectorTab,
  onInspectorTabChange,
  master,
  onMasterChange,
  cover,
  hasCover,
  courseId,
  courseTitle,
  onCourseTitleChange,
  onCoverChange,
  onApplyCover,
  appearance,
  onAppearanceChange,
  headerSelected,
  headerStyle,
  onHeaderStyleChange,
  blocks,
  selectedId,
  onSelectObject,
  selected,
  sections,
  lessons,
  area,
  headerBottom,
  footerTop,
  activeTextEditor,
  onBlockChange,
  onReorderLayer,
  onApplyBorderRadiusToAll,
  onDuplicate,
  onDelete,
  onReplaceTemplate,
}: Props) {
  return (
    <SlideEditorInspector inspectorRef={inspectorRef}>
      {clipboardNotice && (
        <p
          role={clipboardNotice.error ? "alert" : "status"}
          className={`text-xs ${clipboardNotice.error ? "text-rose-700" : "text-slate-500"}`}
        >
          {clipboardNotice.message}
        </p>
      )}
      <SlideInspectorTabs
        value={inspectorTab}
        onChange={onInspectorTabChange}
        master={
          <SlideMasterPanel
            value={master}
            courseId={courseId}
            onChange={onMasterChange}
          />
        }
        cover={
          <SlideCoverPanel
            cover={cover}
            hasCover={hasCover || Boolean(cover)}
            courseId={courseId}
            courseTitle={courseTitle}
            onTitleChange={onCourseTitleChange}
            onChange={(next) => {
              onCoverChange(next);
              if (!next) onInspectorTabChange("object");
            }}
            onOpenCover={onApplyCover}
          />
        }
      >
        <SlideAppearanceSettings
          value={appearance}
          onChange={onAppearanceChange}
          master={master}
          courseId={courseId}
        />
        {headerSelected && !cover && (
          <SlideHeaderTextSettings
            master={master}
            value={headerStyle}
            onChange={onHeaderStyleChange}
          />
        )}
        <SlideSelectionControls selection={selection} blocks={blocks} />
        {blocks.length > 0 && (
          <SlideInspectorSection
            title="Objects & layers"
            label="Slide object layers"
            icon={Layers}
            defaultOpen={false}
          >
            <SlideObjectLayers
              blocks={blocks}
              selectedId={selectedId}
              selectedIds={selection.selectedIds}
              onToggleSelect={(id) => onSelectObject(id, { shiftKey: true })}
              onSelectMember={(id) => { onSelectObject(id); selection.enterMember(id); }}
              onToggleFlag={selection.toggleFlag}
              onSelect={onSelectObject}
              onReorder={onReorderLayer}
            />
          </SlideInspectorSection>
        )}
        {!selected && !headerSelected && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            {cover
              ? "Add an Audio instruction block above, or use Cover page settings to edit this slide."
              : "Select the header or an object on the canvas to edit its text and layout."}
          </section>
        )}
        {selected && (
          <fieldset disabled={!selection.editable} inert={!selection.editable}><SlideObjectSettings
            selected={selected}
            blocks={blocks}
            courseId={courseId}
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
            onDelete={onDelete}
            onReplaceTemplate={cover ? undefined : onReplaceTemplate}
          /></fieldset>
        )}
      </SlideInspectorTabs>
    </SlideEditorInspector>
  );
}
