"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Maximize, Paintbrush, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { SettingsPanelContent, SettingsSection } from "@/components/ui/settings-section";
import { Select } from "@/components/ui/select";
import { CourseThemeContext } from "@/lib/editor/course-theme-context";
import { gradientColor } from "@/lib/color";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import { DraggableSettingsPanel } from "./draggable-settings-panel";

const spacingOptions = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;
const blockPaddingOptions = [0, 20, 40, 60, 80, 100, 120] as const;
const backgroundColors = ["#ffffff", "#f1f5f9", "#dbeafe", "#bfdbfe", "#dcfce7", "#bbf7d0", "#fef3c7", "#fde68a", "#fee2e2", "#fecaca", "#ede9fe", "#1e293b"];

export function BlockFormatMenu({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const theme = useContext(CourseThemeContext);
  const themeColors = [
    { label: "Brand", color: theme.primaryColor },
    { label: "Accent", color: theme.accentColor },
    { label: "Brand to accent", color: gradientColor(theme.primaryColor, theme.accentColor) },
    { label: "Accent to brand", color: gradientColor(theme.accentColor, theme.primaryColor) },
  ];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `block-format-${block.id}`;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        triggerRef.current?.contains(target) ||
        document.getElementById(panelId)?.contains(target)
      )
        return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, panelId]);

  return <>
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Format block"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => {
        if (open) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      }}
      className="size-8 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Settings2 size={15} />
    </Button>
    {open && (
      <DraggableSettingsPanel
        id={panelId}
        title="Block format settings"
        settingsLabel="Block format"
        side="right"
        panelClassName="w-[min(380px,calc(100vw-3rem))]"
        bodyClassName="space-y-3"
      >
        <h3 className="sr-only">Format</h3>
        <SettingsPanelContent>
        <SettingsSection title="Layout" icon={Maximize}>
        <label className="block text-xs font-medium">Content width
          <Select aria-label="Content width" value={block.widthCustom ? block.width : defaultBlockWidthForBlock(block)} onChange={(event) => onChange({ ...block, width: event.target.value as ContentBlock["width"], widthCustom: true })} className="mt-1 h-9 w-full text-xs"><option value="full">L - 920px</option><option value="medium">M - 720px</option><option value="small">S - 520px</option></Select>
        </label>
        </SettingsSection>
        <SettingsSection title="Appearance" icon={Paintbrush}>
        <div>
          <label htmlFor={`block-background-${block.id}`} className="block text-xs font-medium">Background color</label>
          <ColorPicker id={`block-background-${block.id}`} aria-label="Choose background color" hexLabel="Background color hex code" value={block.backgroundColor} allowGradient onChange={(backgroundColor) => onChange({ ...block, backgroundColor })} className="mt-1" />
          <fieldset className="mt-3 space-y-2"><legend className="text-[11px] font-medium text-slate-500">Theme colors</legend>
            <div className="grid grid-cols-4 gap-2">{themeColors.map(({ label, color }) => <Button key={label} variant="outline" size="sm" aria-label={`Use theme ${label.toLowerCase()} background`} aria-pressed={block.backgroundColor === color} title={label} className={`h-auto min-w-0 flex-col gap-1 p-1.5 text-[10px] ${block.backgroundColor === color ? "border-indigo-500 ring-1 ring-indigo-500" : ""}`} onClick={() => onChange({ ...block, backgroundColor: color })}><span aria-hidden="true" className="h-6 w-full rounded border border-black/5" style={{ background: color }} /><span className="w-full truncate">{label}</span></Button>)}</div>
          </fieldset>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Background color presets">
            {backgroundColors.map((color) => <Button key={color} type="button" variant="outline" size="icon" aria-label={`Set background ${color}`} aria-pressed={block.backgroundColor.toLowerCase() === color} title={color} onClick={() => onChange({ ...block, backgroundColor: color })} className={`size-6 rounded-md ${block.backgroundColor.toLowerCase() === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200"}`} style={{ backgroundColor: color }} />)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Text color adjusts for contrast.</p>
        </div>
        </SettingsSection>
        <SettingsSection title="Advanced" label="Advanced block format settings" icon={Settings2} defaultOpen={false}>
        <label className="block text-xs font-medium">Block padding
          <Select aria-label="Block padding" value={String(block.blockPadding ?? defaultBlockPaddingForBlock(block))} onChange={(event) => onChange({ ...block, blockPadding: Number(event.target.value) })} className="mt-1 h-9 w-full text-xs">
            {block.blockPadding !== undefined && !blockPaddingOptions.includes(block.blockPadding as typeof blockPaddingOptions[number]) && <option value={block.blockPadding}>{block.blockPadding} px</option>}
            {blockPaddingOptions.map((padding) => <option key={padding} value={padding}>{padding} px</option>)}
          </Select>
        </label>
        {block.type === "heading" && <label className="block text-xs font-medium">Heading padding
          <Select aria-label="Heading padding" value={block.headingPadding ?? "none"} onChange={(event) => onChange({ ...block, headingPadding: event.target.value as ContentBlock["headingPadding"] })} className="mt-1 h-9 w-full text-xs">{spacingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
        </label>}
        </SettingsSection>
        </SettingsPanelContent>
      </DraggableSettingsPanel>
    )}
  </>;
}
