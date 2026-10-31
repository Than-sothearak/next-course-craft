"use client";
import { useState } from "react";
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, CircleDot, ImagePlus, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { InteractionIcon } from "@/components/interaction-icon";
import { interactionIcons, isInteractionTarget } from "@/lib/editor/interaction-button";
import type { ContentBlock } from "@/lib/schemas/block";
import { MediaLibraryDialog } from "../media-library-dialog";
import { InteractionPopupEditor } from "./interaction-popup-editor";

type Interaction = Extract<ContentBlock, { type: "interactionButton" }>;
const buttonPositions = [
  { value: "top-left", label: "Top left", Icon: ArrowUpLeft },
  { value: "top-center", label: "Top center", Icon: ArrowUp },
  { value: "top-right", label: "Top right", Icon: ArrowUpRight },
  { value: "middle-left", label: "Middle left", Icon: ArrowLeft },
  { value: "middle-center", label: "Center", Icon: CircleDot },
  { value: "middle-right", label: "Middle right", Icon: ArrowRight },
  { value: "bottom-left", label: "Bottom left", Icon: ArrowDownLeft },
  { value: "bottom-center", label: "Bottom center", Icon: ArrowDown },
  { value: "bottom-right", label: "Bottom right", Icon: ArrowDownRight },
] as const;
export function InteractionButtonSettings({ block, courseId, lessonBlocks, onChange }: { block: Interaction; courseId: string; lessonBlocks: readonly ContentBlock[]; onChange: (block: ContentBlock) => void }) {
  const [imageOpen, setImageOpen] = useState(false), [popupOpen, setPopupOpen] = useState(false);
  const data = block.data, popup = data.popup;
  const buttonSize = data.buttonSize ?? 80, position = data.position ?? "middle-center";
  const update = (change: Partial<Interaction["data"]>) => onChange({ ...block, data: { ...data, ...change } });
  const updatePopup = (change: Partial<typeof popup>) => update({ popup: { ...popup, ...change } });
  const targets = lessonBlocks.filter((item) => isInteractionTarget(item, block.id));
  return <div className="space-y-4" aria-label="Interaction button settings">
    <label className="block space-y-1 text-xs text-slate-600">Button label<Input aria-label="Interaction button label" maxLength={120} value={data.label} onChange={(event) => { if (event.target.value.trim()) update({ label: event.target.value }); }} /></label>
    <Select aria-label="Interaction button appearance" value={data.trigger} onChange={(event) => update({ trigger: event.target.value as "icon" | "image" })}><option value="icon">Preset icon</option><option value="image">Uploaded image</option></Select>
    {data.trigger === "icon" ? <div className="grid grid-cols-6 gap-1" aria-label="Interaction button icon choices">{interactionIcons.map((icon) => <Button key={icon} variant={data.icon === icon ? "secondary" : "outline"} size="icon" className="size-8 min-w-0" aria-label={`Interaction icon ${icon}`} title={icon} aria-pressed={data.icon === icon} onClick={() => update({ icon })}><InteractionIcon name={icon} size={17} /></Button>)}</div> : <Button variant="outline" size="sm" className="w-full" onClick={() => setImageOpen(true)}><ImagePlus size={14} />{data.imageSrc ? "Replace button image" : "Choose or upload button image"}</Button>}
    {data.trigger === "image" && <Input aria-label="Interaction button image description" value={data.imageAlt} maxLength={500} onChange={(event) => update({ imageAlt: event.target.value })} placeholder="Image description" />}
    <label className="block space-y-1 text-xs text-slate-600">Button size (px)<NumberInput aria-label="Interaction button size" min={24} max={256} value={buttonSize} onValueChange={(value) => update({ buttonSize: value })} /></label>
    <fieldset className="space-y-2"><legend className="text-xs font-medium text-slate-600">Button position inside object</legend>
      <div className="grid grid-cols-3 gap-1">{buttonPositions.map(({ value, label, Icon }) => <Button key={value} variant={position === value ? "secondary" : "outline"} size="sm" className="min-w-0 gap-1 px-1 text-[10px]" aria-label={`Interaction button position ${label.toLowerCase()}`} aria-pressed={position === value} onClick={() => update({ position: value })}><Icon size={13} aria-hidden="true" className="shrink-0" />{label}</Button>)}</div>
      <p className="text-[11px] leading-4 text-slate-500">The button keeps its pixel size inside larger object boxes and fits smaller boxes automatically.</p>
    </fieldset>
    <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Interaction button radar" checked={data.radarEnabled} onChange={(event) => update({ radarEnabled: event.target.checked })} />Radar effect</label><label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Interaction button show label" checked={data.showLabel} onChange={(event) => update({ showLabel: event.target.checked })} />Show label</label></div>
    <div className="grid grid-cols-2 gap-3">{(["color", "iconColor", "radarColor"] as const).map((field) => <div key={field} className="space-y-1 text-xs text-slate-600">{field === "color" ? "Button fill" : field === "iconColor" ? "Icon & label" : "Radar color"}<ColorPicker aria-label={`Interaction ${field}`} value={data[field]} onChange={(value) => update({ [field]: value })} /></div>)}</div>
    <div className="grid grid-cols-2 gap-2">{([{ field: "iconSize", label: "Icon size", min: 16, max: 96 }, { field: "radius", label: "Corner radius", min: 0, max: 64 }] as const).map(({ field, label, min, max }) => <label key={field} className="space-y-1 text-xs text-slate-600">{label} (px)<NumberInput aria-label={`Interaction ${label.toLowerCase()}`} min={min} max={max} value={data[field]} onValueChange={(value) => update({ [field]: value })} /></label>)}</div>
    <label className="block space-y-1 text-xs font-medium text-slate-600">On click<Select aria-label="Interaction button action" value={data.action} onChange={(event) => update({ action: event.target.value as "popup" | "block" })}><option value="popup">Open custom popup mini slide</option><option value="block">Show an existing block in a popup</option></Select></label>
    {data.action === "block" && <Select aria-label="Interaction target block" value={data.targetBlockId} onChange={(event) => update({ targetBlockId: event.target.value })}><option value="">Choose a block</option>{targets.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.type === "heading" ? item.data.text : item.type === "audio" ? item.data.fileName || "Audio" : item.type}</option>)}</Select>}
    <label className="block space-y-1 text-xs text-slate-600">Popup title<Input aria-label="Interaction popup title" value={popup.title} maxLength={160} onChange={(event) => { if (event.target.value.trim()) updatePopup({ title: event.target.value }); }} /></label>
    <div className="grid grid-cols-2 gap-2">{(["width", "height"] as const).map((field) => <label key={field} className="space-y-1 text-xs text-slate-600">Popup {field} (px)<Input aria-label={`Interaction popup ${field}`} type="number" min={field === "width" ? 480 : 270} max={field === "width" ? 1280 : 960} value={popup[field]} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= (field === "width" ? 480 : 270) && value <= (field === "width" ? 1280 : 960)) updatePopup({ [field]: value }); }} /></label>)}</div>
    <div className="grid grid-cols-2 gap-3">{(["backgroundColor", "textColor"] as const).map((field) => <div key={field} className="space-y-1 text-xs text-slate-600">Popup {field === "backgroundColor" ? "background" : "text"}<ColorPicker aria-label={`Interaction popup ${field}`} value={popup[field]} onChange={(value) => updatePopup({ [field]: value })} /></div>)}</div>
    <Select aria-label="Interaction popup animation" value={popup.animation} onChange={(event) => updatePopup({ animation: event.target.value as typeof popup.animation })}><option value="zoom">Smooth zoom</option><option value="fade">Fade</option><option value="slide">Slide up</option><option value="none">None</option></Select>
    {data.action === "popup" && <Button variant="outline" size="sm" className="w-full" onClick={() => setPopupOpen(true)}><PanelsTopLeft size={14} />Edit popup mini slide ({popup.blocks.length} objects)</Button>}
    <p className="text-[11px] leading-4 text-slate-500">Click the button on the canvas to preview its popup. Opening it completes this activity when Required for progress is enabled.</p>
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => { update({ imageSrc: asset.fileUrl, imageAlt: asset.originalName }); setImageOpen(false); }} />
    {popupOpen && <InteractionPopupEditor popup={popup} courseId={courseId} onClose={() => setPopupOpen(false)} onApply={(next) => { updatePopup(next); setPopupOpen(false); }} />}
  </div>;
}
