"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FixedStageViewport } from "@/components/slides/fixed-stage-viewport";
import { SlideSurface } from "@/components/slides/slide-surface";
import { institutionalGreenMaster, masterSettingsForSlide, renderSlideMaster, resolveSlideMaster, slideMasterSchema, type SlideMaster } from "@/lib/slides/master-schema";
import { slideSnapshotSchema, type SlideRecord } from "@/lib/slides/schema";
import type { SlideTheme } from "@/lib/slides/themes";
import { MediaLibraryDialog } from "../../../edit/_components/media-library-dialog";

type Scope = "course" | "slide";
type Props = { courseId: string; theme: SlideTheme; slide?: SlideRecord; slides?: SlideRecord[]; scope: Scope; disabled: boolean; onClose: () => void; onApply: (master: SlideMaster, scope: Scope) => void };
export function MasterEditor({ courseId, theme, slide, slides = [], scope: initialScope, disabled, onClose, onApply }: Props) {
  const initial = renderSlideMaster(theme.master, initialScope === "slide" ? (slide ? masterSettingsForSlide(slide).masterOverrides : undefined) : undefined) ?? institutionalGreenMaster;
  const [history, setHistory] = useState<{ past: SlideMaster[]; draft: SlideMaster; future: SlideMaster[] }>({ past: [], draft: structuredClone(initial), future: [] });
  const [scope, setScope] = useState<Scope>(initialScope), [media, setMedia] = useState<"logo" | "background" | null>(null);
  const { draft, past, future } = history;
  const change = (next: SlideMaster) => setHistory((current) => ({ past: [...current.past, current.draft].slice(-60), draft: next, future: [] }));
  const background = (patch: Partial<SlideMaster["background"]>) => change({ ...draft, background: { ...draft.background, ...patch } });
  const header = (patch: Partial<SlideMaster["header"]>) => change({ ...draft, header: { ...draft.header, ...patch } });
  const title = (patch: Partial<SlideMaster["header"]["title"]>) => header({ title: { ...draft.header.title, ...patch } });
  const logo = (patch: Partial<SlideMaster["header"]["logo"]>) => header({ logo: { ...draft.header.logo, ...patch } });
  const content = (patch: Partial<SlideMaster["content"]>) => change({ ...draft, content: { ...draft.content, ...patch } });
  const footer = (patch: Partial<SlideMaster["footer"]>) => change({ ...draft, footer: { ...draft.footer, ...patch } });
  const text = (patch: Partial<SlideMaster["footer"]["textStyle"]>) => footer({ textStyle: { ...draft.footer.textStyle, ...patch } });
  const number = (patch: Partial<SlideMaster["footer"]["number"]>) => footer({ number: { ...draft.footer.number, ...patch } });
  const validation = slideMasterSchema.safeParse(draft);
  const conflict = validation.success && scope === "course" ? slides.find((candidate) => { const overrides = masterSettingsForSlide(candidate).masterOverrides; if (!overrides) return false; try { resolveSlideMaster(validation.data, overrides); return false; } catch { return true; } }) : undefined;
  const previewMaster = validation.success ? validation.data : initial;
  const previewSlide: SlideRecord = slide ? { ...slide, masterOverrides: undefined, composition: slide.composition ? { ...slide.composition, masterOverrides: undefined } : undefined } : { ...slideSnapshotSchema.parse({ title: "Slide title", order: 0, objects: [], schemaVersion: 3, revision: 0, composition: { duration: 30, layers: [], layout: "canvas", resolution: "hd" } }), id: "master-preview" };
  return <Dialog open onClose={onClose} title="Edit Slide Master" className="max-w-7xl" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={disabled || !validation.success || !!conflict || (scope === "slide" && !slide)} onClick={() => { if (validation.success) onApply(validation.data, scope); }}>Apply master</Button></>}>
    <div className="mb-4 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm">Apply to<Select aria-label="Master apply scope" className="w-auto" value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="course">All inheriting slides</option><option value="slide" disabled={!slide}>Current slide override</option></Select></label><Button variant="outline" size="sm" disabled={!past.length} onClick={() => setHistory({ past: past.slice(0, -1), draft: past.at(-1)!, future: [draft, ...future] })}>Undo master edit</Button><Button variant="outline" size="sm" disabled={!future.length} onClick={() => setHistory({ past: [...past, draft], draft: future[0], future: future.slice(1) })}>Redo master edit</Button><Button variant="ghost" size="sm" onClick={() => change(structuredClone(institutionalGreenMaster))}>Reset preset</Button></div>
    <p className="mb-4 text-xs text-slate-500">Changes appear in this preview. Apply saves the design through the course’s autosave. Each slide keeps its title, objects and timing. Current slide overrides keep inheriting settings you have not changed.</p>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 self-start rounded-xl bg-slate-100 p-3 lg:sticky lg:top-0"><FixedStageViewport resolution={slide?.composition?.resolution} fitHeight={false}><SlideSurface slide={previewSlide} theme={{ ...theme, master: previewMaster }} /></FixedStageViewport></div>
      <fieldset disabled={disabled} className="max-h-[55dvh] space-y-4 overflow-auto pr-2">
        <Field label="Master name"><Input aria-label="Master name" maxLength={80} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></Field>
        <Toggle label="Show slide master" value={draft.enabled} onChange={(enabled) => change({ ...draft, enabled })} />
        <Section title="Background" open>
          <Choice label="Background type" value={draft.background.type} options={["solid", "gradient", "geometric", "image", "transparent"]} onChange={(value) => background({ type: value })} />
          <Color label="Background color" value={draft.background.color} onChange={(color) => background({ color })} /><Color label="Background secondary color" value={draft.background.secondaryColor} onChange={(secondaryColor) => background({ secondaryColor })} />
          <Color label="Triangle color" value={draft.background.patternColor} onChange={(patternColor) => background({ patternColor })} />
          <Num label="Background opacity" value={draft.background.opacity} min={0} max={1} step={.05} onChange={(opacity) => background({ opacity })} /><Num label="Triangle opacity" value={draft.background.patternOpacity} min={0} max={1} step={.01} onChange={(patternOpacity) => background({ patternOpacity })} />
          <Num label="Triangle size" value={draft.background.patternSize} min={40} max={400} onChange={(patternSize) => background({ patternSize })} /><Num label="Triangle density" value={draft.background.density} min={.5} max={4} step={.1} onChange={(density) => background({ density })} /><Num label="Gradient angle" value={draft.background.angle} min={0} max={360} onChange={(angle) => background({ angle })} />
          <Choice label="Background image position" value={draft.background.imagePosition} options={["center", "top", "bottom"]} onChange={(imagePosition) => background({ imagePosition })} />
          <Button size="sm" variant="outline" onClick={() => setMedia("background")}>Choose background image</Button><Button size="sm" variant="ghost" disabled={!draft.background.imageSrc} onClick={() => background({ imageSrc: "" })}>Remove background image</Button>
        </Section>
        <Section title="Header and title" open>
          <Toggle label="Show header" value={draft.header.enabled} onChange={(enabled) => header({ enabled })} />
          <Num label="Header height" value={draft.header.height} min={48} max={180} onChange={(height) => header({ height })} /><Color label="Header color" value={draft.header.color} onChange={(color) => header({ color })} />
          <Choice label="Header edge" value={draft.header.shape} options={["straight", "angled"]} onChange={(shape) => header({ shape })} />
          <Num label="Banner width" value={draft.header.bannerWidth} min={400} max={1280} onChange={(bannerWidth) => header({ bannerWidth })} /><Num label="Angled edge width" value={draft.header.angleWidth} min={0} max={160} onChange={(angleWidth) => header({ angleWidth })} />
          <Choice label="Title font" value={draft.header.title.fontFamily} options={["sans", "serif", "rounded"]} onChange={(fontFamily) => title({ fontFamily })} />
          <Num label="Title size" value={draft.header.title.fontSize} min={8} max={120} onChange={(fontSize) => title({ fontSize })} /><Color label="Title color" value={draft.header.title.color} onChange={(color) => title({ color })} />
          <Choice label="Title alignment" value={draft.header.title.alignment} options={["left", "center", "right"]} onChange={(alignment) => title({ alignment })} /><Num label="Title horizontal offset" value={draft.header.title.offsetX} min={-300} max={300} onChange={(offsetX) => title({ offsetX })} /><Num label="Title vertical offset" value={draft.header.title.offsetY} min={-60} max={60} onChange={(offsetY) => title({ offsetY })} />
        </Section>
        <Section title="Institution logo">
          <Toggle label="Show logo" value={draft.header.logo.visible} onChange={(visible) => logo({ visible })} />
          <div className="col-span-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => setMedia("logo")}>Choose institution logo</Button><Button size="sm" variant="ghost" onClick={() => logo({ src: "" })}>Use placeholder</Button></div>
          <Field label="Logo description"><Input aria-label="Logo description" value={draft.header.logo.alt} maxLength={500} onChange={(event) => logo({ alt: event.target.value })} /></Field>
          <Num label="Logo X" value={draft.header.logo.x} min={0} max={1280 - draft.header.logo.width} onChange={(x) => logo({ x })} /><Num label="Logo Y" value={draft.header.logo.y} min={0} max={180 - draft.header.logo.height} onChange={(y) => logo({ y })} />
          <Num label="Logo width" value={draft.header.logo.width} min={24} max={Math.min(256, 1280 - draft.header.logo.x)} onChange={(width) => logo({ width })} /><Num label="Logo height" value={draft.header.logo.height} min={24} max={Math.min(180, 180 - draft.header.logo.y)} onChange={(height) => logo({ height })} />
        </Section>
        <Section title="Content region">
          <Num label="Content X" value={draft.content.x} min={0} max={1180} onChange={(x) => content({ x })} /><Num label="Content Y" value={draft.content.y} min={0} max={620} onChange={(y) => content({ y })} /><Num label="Content width" value={draft.content.width} min={100} max={1280 - draft.content.x} onChange={(width) => content({ width })} /><Num label="Content height" value={draft.content.height} min={100} max={720 - draft.content.y} onChange={(height) => content({ height })} />
          <Num label="Content padding" value={draft.content.padding} min={0} max={80} onChange={(padding) => content({ padding })} /><Num label="Content corners" value={draft.content.radius} min={0} max={100} onChange={(radius) => content({ radius })} /><Color label="Content panel color" value={draft.content.color} onChange={(color) => content({ color })} /><Num label="Content panel opacity" value={draft.content.opacity} min={0} max={1} step={.05} onChange={(opacity) => content({ opacity })} />
        </Section>
        <Section title="Footer and numbering" open>
          <Toggle label="Show footer" value={draft.footer.enabled} onChange={(enabled) => footer({ enabled })} /><Num label="Footer height" value={draft.footer.height} min={36} max={140} onChange={(height) => footer({ height })} /><Color label="Footer color" value={draft.footer.color} onChange={(color) => footer({ color })} />
          <Field label="Module or lesson text"><Input aria-label="Module or lesson text" value={draft.footer.text} maxLength={500} onChange={(event) => footer({ text: event.target.value })} /></Field>
          <Choice label="Footer font" value={draft.footer.textStyle.fontFamily} options={["sans", "serif", "rounded"]} onChange={(fontFamily) => text({ fontFamily })} /><Num label="Footer text size" value={draft.footer.textStyle.fontSize} min={8} max={48} onChange={(fontSize) => text({ fontSize })} /><Color label="Footer text color" value={draft.footer.textStyle.color} onChange={(color) => text({ color })} /><Choice label="Footer text alignment" value={draft.footer.textStyle.alignment} options={["left", "center", "right"]} onChange={(alignment) => text({ alignment })} /><Num label="Footer text inset" value={draft.footer.textStyle.inset} min={12} max={200} onChange={(inset) => text({ inset })} />
          <Toggle label="Show slide numbers" value={draft.footer.number.visible} onChange={(visible) => number({ visible })} /><Num label="Starting slide number" value={draft.footer.number.start} min={0} max={9999} onChange={(start) => number({ start })} /><Choice label="Number style" value={draft.footer.number.style} options={["circle", "square", "plain"]} onChange={(style) => number({ style })} /><Color label="Number color" value={draft.footer.number.color} onChange={(color) => number({ color })} /><Color label="Number background color" value={draft.footer.number.backgroundColor} onChange={(backgroundColor) => number({ backgroundColor })} /><Num label="Number circle size" value={draft.footer.number.size} min={24} max={100} onChange={(size) => number({ size })} /><Num label="Number text size" value={draft.footer.number.fontSize} min={8} max={48} onChange={(fontSize) => number({ fontSize })} /><Num label="Number right inset" value={draft.footer.number.right} min={8} max={200} onChange={(right) => number({ right })} />
        </Section>
      </fieldset>
    </div>
    {conflict && <p role="alert" className="mt-4 text-sm text-rose-700">This master conflicts with the content region on {conflict.title}. Reset that slide to the master or adjust these bounds before applying.</p>}
    {!validation.success && <p role="alert" className="mt-4 text-sm text-rose-700">{validation.error.issues[0]?.message} The preview shows the last valid starting design until these values are corrected.</p>}
    <MediaLibraryDialog courseId={courseId} kind="image" open={media !== null} onClose={() => setMedia(null)} onSelect={(asset) => { if (media === "logo") logo({ src: asset.fileUrl, alt: asset.originalName }); else background({ imageSrc: asset.fileUrl, type: "image" }); setMedia(null); }} />
  </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-medium text-slate-700">{label}<div className="mt-1">{children}</div></label>; }
function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) { return <details open={open} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{title}</summary><div className="mt-3 grid grid-cols-2 items-end gap-3">{children}</div></details>; }
function Num({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next))); }} /></Field>; }
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><Input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /></Field>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-xs"><Checkbox aria-label={label} checked={value} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) { return <Field label={label}><Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>; }
