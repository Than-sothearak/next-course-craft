"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, Copy, Eye, Grid2X2, ImagePlus, Layers, LayoutTemplate, LoaderCircle, Monitor, MousePointer2, Palette, Plus, Redo2, Save, Shapes, Smartphone, Tablet, Trash2, Type, Undo2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SlideSurface, SlideThumbnail } from "@/components/slides/slide-surface";
import type { SlideViewportSize } from "@/components/slides/slide-viewport";
import { FixedStageViewport } from "@/components/slides/fixed-stage-viewport";
import { updateTemplateSlot } from "@/components/slides/template-surface";
import type { SlideObject, SlideRecord } from "@/lib/slides/schema";
import { createTemplateContent, replaceSlideTemplate } from "@/lib/slides/templates";
import type { SlideTemplateId } from "@/lib/slides/template-definitions";
import type { SlideTheme, SlideThemeSnapshot } from "@/lib/slides/themes";
import { MediaLibraryDialog } from "../../edit/_components/media-library-dialog";
import { useSlideWorkspace } from "./use-slide-workspace";
import { TemplateGallery } from "./_components/template-gallery";
import { MasterSlideSettings } from "./_components/master-slide-settings";
import { MasterEditor } from "./_components/master-editor";
import { masterOverridesFor, masterSettingsForSlide, resolveSlideMaster } from "@/lib/slides/master-schema";
import { ThemeDialog } from "./_components/theme-dialog";
import { TemplateInspector } from "./_components/template-inspector";
import { CanvasInspector, createCanvasObject, removeCanvasObject } from "./_components/canvas-inspector";
import { BlockGallery } from "./_components/block-gallery";
import { LearningPageEditor } from "./_components/learning-page-editor";
import { createLearningBlock, type LearningBlockKind } from "@/lib/slides/blocks";
import { composeLearningPage } from "@/lib/slides/pages";
import { createObjectLayout } from "@/lib/slides/object-layouts";

export type { SlideRecord } from "@/lib/slides/schema";
type Props = { courseId: string; courseTitle: string; initialSlides: SlideRecord[]; initialTheme: SlideThemeSnapshot };
type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; object: SlideObject };

export function SlideEditorClient({ courseId, courseTitle, initialSlides, initialTheme }: Props) {
  const router = useRouter();
  const workspace = useSlideWorkspace(courseId, initialSlides, initialTheme);
  const { slides: drafts, themes, saveAll } = workspace;
  const [activeId, setActiveId] = useState(initialSlides[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>("title"), [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false), [grid, setGrid] = useState(false);
  const [viewport, setViewport] = useState<SlideViewportSize>("desktop");
  const [gallery, setGallery] = useState<"add" | "replace" | "block" | null>(null), [themeOpen, setThemeOpen] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterScope, setMasterScope] = useState<"course" | "slide" | null>(null);
  const [blockOpen, setBlockOpen] = useState(false), [blockError, setBlockError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null), [reloadOpen, setReloadOpen] = useState(false);
  const [tab, setTab] = useState("content"), [previewState, setPreviewState] = useState("__base");
  const [media, setMedia] = useState<{ slideId: string; key: string; kind: "image" | "video"; template: boolean } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null), dragRef = useRef<Drag | null>(null);
  const active = workspace.items.find((slide) => slide.id === activeId) ?? workspace.items[0];
  function changeTheme(theme: SlideTheme) {
    for (const slide of workspace.items) {
      try { resolveSlideMaster(theme.master, masterSettingsForSlide(slide).masterOverrides); }
      catch { setMasterError(`This design conflicts with the content bounds on ${slide.title}. Reset that slide to the master before applying.`); return; }
    }
    setMasterError(null); themes.update("theme", (current) => ({ ...current, theme }), "theme");
  }
  const update = (updater: (slide: SlideRecord) => SlideRecord, group?: string) => { if (active && !workspace.busy) drafts.update(active.id, updater, group); };
  const selectSlide = (id: string) => { setActiveId(id); setSelectedSlot("title"); setSelectedObject(null); setPreviewState("__base"); };
  const selectObject = (id: string | null) => { setSelectedObject(id); setPreviewState("__base"); };
  const chooseImage = (key: string) => active && setMedia({ slideId: active.id, key, kind: "image", template: true });
  const selectSlot = (key: string) => { setSelectedSlot(key); setTab("content"); };
  const saveLabel = workspace.failure ? "Changes need attention" : workspace.saving ? "Saving…" : workspace.dirty ? "Unsaved changes" : "All changes saved";

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveAll(true); return; }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (event.key.toLowerCase() === "z" && !masterScope && active && !workspace.busy) { event.preventDefault(); if (event.shiftKey) drafts.redo(active.id); else drafts.undo(active.id); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [active, drafts, saveAll, workspace.busy, masterScope]);

  async function chooseTemplate(id: SlideTemplateId | null) {
    if (gallery === "block" && id && active) {
      const objects = createObjectLayout(id, Math.max(1, ...(active.composition?.layers ?? []).map((block, index) => block.placement?.zIndex ?? index + 1)) + 1);
      if ((active.composition?.layers.length ?? 1) + objects.length > 100) { setBlockError("A canvas can contain up to 100 objects."); setGallery(null); return; }
      update((slide) => { const page = composeLearningPage(slide); return { ...page, composition: { ...page.composition!, layers: [...page.composition!.layers, ...objects] } }; });
      setGallery(null); return;
    }
    if (gallery === "replace" && active && !active.objects.length && id) {
      update((slide) => ({ ...slide, schemaVersion: 2, template: slide.template ? replaceSlideTemplate(slide.template, id) : createTemplateContent(id) }));
      setGallery(null); setSelectedSlot("title"); setTab("content"); return;
    }
    const createdId = await workspace.addSlide(id);
    if (createdId) { selectSlide(createdId); setGallery(null); setAdvanced(id === null); setTab("content"); }
  }
  function addBlock(kind: LearningBlockKind) {
    if (!active || workspace.busy) return;
    try {
      const page = composeLearningPage(active);
      if (page.composition!.layers.length >= 100) throw new Error("A page can contain up to 100 blocks.");
      const block = createLearningBlock(kind);
      update(() => ({ ...page, composition: { ...page.composition!, layers: [...page.composition!.layers, block] } }));
      setBlockOpen(false); setBlockError(null);
    } catch (cause) { setBlockError(cause instanceof Error ? cause.message : "Could not add a block."); }
  }
  async function addContentPage() {
    const id = await workspace.addSlide(null);
    if (!id) return;
    drafts.update(id, (slide) => ({ ...composeLearningPage(slide), title: `Page ${drafts.getSnapshot().items.length}` }));
    selectSlide(id);
  }
  function addObject(kind: SlideObject["type"]) {
    if (!active || active.template || active.objects.length >= 200) return;
    const object = createCanvasObject(kind, Math.min(500, Math.max(0, ...active.objects.map((item) => item.zIndex)) + 1));
    update((slide) => ({ ...slide, objects: [...slide.objects, object] })); selectObject(object.id);
  }
  function pointerDown(event: PointerEvent<HTMLElement>, object: SlideObject, mode: Drag["mode"]) {
    if (!advanced || workspace.busy) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedObject(object.id); dragRef.current = { id: object.id, mode, startX: event.clientX, startY: event.clientY, object: structuredClone(object) };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current || workspace.busy) return;
    const bounds = (canvasRef.current.querySelector<HTMLElement>("[data-canvas-slide]") ?? canvasRef.current).getBoundingClientRect();
    const scale = bounds.width / 1280, scaleY = bounds.height ? bounds.height / 720 : scale;
    const snap = (value: number) => grid ? Math.round(value / 10) * 10 : Math.round(value);
    const dx = (event.clientX - drag.startX) / scale, dy = (event.clientY - drag.startY) / scaleY;
    update((slide) => ({ ...slide, objects: slide.objects.map((object) => object.id !== drag.id ? object : drag.mode === "move" ? {
      ...object, x: Math.max(0, Math.min(1280 - object.width, snap(drag.object.x + dx))), y: Math.max(0, Math.min(720 - object.height, snap(drag.object.y + dy))),
    } : { ...object, width: Math.max(1, Math.min(1280 - object.x, snap(drag.object.width + dx))), height: Math.max(1, Math.min(720 - object.y, snap(drag.object.height + dy))) }) }), `drag:${drag.id}`);
  }
  async function navigate(path: string) { if (await saveAll()) router.push(path); }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ courseId, slides: drafts.getSnapshot().items, theme: themes.getSnapshot().items[0] }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "coursecraft-slide-draft.json"; link.click(); URL.revokeObjectURL(url);
  }

  return <main className="flex min-h-screen flex-col bg-[#f3f4f8] text-slate-900 lg:h-dvh lg:min-h-[640px]">
    <header className="z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" aria-label="Back to courses" disabled={workspace.busy} onClick={() => void navigate("/dashboard")}><ArrowLeft size={17} /></Button><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><Grid2X2 size={19} /></div><div className="min-w-0"><h1 className="max-w-[240px] truncate text-sm font-semibold">{courseTitle}</h1><p role="status" aria-live="polite" className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${workspace.failure ? "text-rose-600" : "text-slate-400"}`}>{workspace.saving ? <LoaderCircle size={10} className="animate-spin" /> : !workspace.dirty && !workspace.failure ? <Check size={11} className="text-emerald-600" /> : <span className="size-1.5 rounded-full bg-amber-400" />}{saveLabel}</p></div></div>
      <div className="flex flex-wrap items-center gap-1.5"><Button variant="ghost" size="icon" aria-label="Undo slide edit" title="Undo slide edit" disabled={workspace.busy || !active || !drafts.canUndo(active.id)} onClick={() => active && drafts.undo(active.id)}><Undo2 size={16} /></Button><Button variant="ghost" size="icon" aria-label="Redo slide edit" title="Redo slide edit" disabled={workspace.busy || !active || !drafts.canRedo(active.id)} onClick={() => active && drafts.redo(active.id)}><Redo2 size={16} /></Button><span className="mx-1 h-6 border-l border-slate-200" /><Button variant="ghost" size="sm" onClick={() => setThemeOpen(true)}><Palette size={15} /> Theme</Button><Button variant="ghost" size="sm" disabled={workspace.busy} onClick={() => setMasterScope("course")}>Edit Slide Master</Button><Button variant="ghost" size="sm" disabled={workspace.busy || !themes.canUndo("theme")} onClick={() => themes.undo("theme")}>Undo theme</Button><Button variant="ghost" size="sm" disabled={workspace.busy || !themes.canRedo("theme")} onClick={() => themes.redo("theme")}>Redo theme</Button><Button variant="outline" size="sm" disabled={workspace.busy || !active || !!active.objects.length} onClick={() => setBlockOpen(true)}>Add object</Button><Button variant="outline" size="sm" disabled={workspace.busy} onClick={() => void addContentPage()}><Plus size={15} /> Add page</Button><Button variant="outline" size="sm" disabled={workspace.busy} onClick={() => void navigate(`/courses/${courseId}/slides/preview`)}><Eye size={15} /> Preview</Button><Button variant="ghost" size="icon" aria-label="Save now" title="Save now (Ctrl+S)" disabled={workspace.saving || workspace.busy} onClick={() => void saveAll(true)}><Save size={16} /></Button><Button size="sm" disabled title="Slide publishing is not available yet">Publish <ChevronDown size={13} /></Button><Button variant="ghost" size="sm" disabled title="Slide HTML and SCORM export are not available yet">Export</Button></div>
    </header>
    {(workspace.failure || workspace.operationError) && <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-900"><p className="min-w-40 flex-1">{workspace.failure?.message ?? workspace.operationError} {workspace.failure && "Your edits are kept in this tab."}</p>{workspace.failure && <><Button size="sm" variant="outline" disabled={workspace.saving || workspace.busy} onClick={() => void saveAll(true)}>Retry save</Button><Button size="sm" variant="ghost" onClick={downloadDraft}>Download draft</Button><Button size="sm" variant="ghost" disabled={workspace.saving || workspace.busy} onClick={() => setReloadOpen(true)}>Reload saved version</Button></>}</div>}

    <div className={`grid min-h-0 flex-1 grid-cols-1 ${active?.composition ? "lg:grid-cols-[190px_minmax(0,1fr)]" : "lg:grid-cols-[190px_minmax(0,1fr)_280px] xl:grid-cols-[220px_minmax(0,1fr)_300px]"}`}>
      <aside className="order-2 flex min-h-0 flex-col border-t border-slate-200 bg-[#f9fafc] lg:order-1 lg:border-r lg:border-t-0"><div className="flex items-center justify-between px-4 py-4"><div><h2 className="text-xs font-semibold">Content menu</h2><p className="mt-1 text-[10px] text-slate-400">{workspace.items.length} pages in this course</p></div><Button size="icon" variant="ghost" aria-label="Add content page" disabled={workspace.busy} onClick={() => void addContentPage()}><Plus size={16} /></Button></div><div className="flex min-h-0 gap-3 overflow-auto px-3 pb-4 lg:flex-col">
        {workspace.items.map((slide, index) => <div key={slide.id} className={`group min-w-44 rounded-xl border p-2 transition-colors lg:min-w-0 ${slide.id === active?.id ? "border-indigo-400 bg-white ring-1 ring-indigo-400" : "border-transparent hover:border-slate-200 hover:bg-white"}`}><Button variant="ghost" className="block h-auto w-full p-0 text-left hover:bg-transparent" disabled={workspace.busy} aria-label={`Select page ${index + 1}: ${slide.title}`} aria-current={slide.id === active?.id ? "page" : undefined} onClick={() => selectSlide(slide.id)}><SlideThumbnail slide={slide} theme={workspace.theme} /><span className="mt-2 flex items-center gap-2"><span className={`grid size-4 shrink-0 place-items-center rounded text-[9px] ${slide.id === active?.id ? "bg-indigo-100 text-indigo-700" : "bg-slate-200/60 text-slate-500"}`}>{index + 1}</span><span className="truncate text-[11px] font-medium">{slide.title}</span>{(slide.template?.slots.button || slide.objects.some((object) => object.actions.length)) && <MousePointer2 aria-label="Has interactions" size={11} className="ml-auto shrink-0 text-indigo-400" />}{slide.objects.some((object) => object.type === "video") && <Video aria-label="Has video" size={11} className="shrink-0 text-slate-400" />}</span></Button><div className="mt-1 flex justify-end gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"><Button size="icon" variant="ghost" className="size-6" aria-label={`Move ${slide.title} up`} disabled={workspace.busy || index === 0} onClick={() => void workspace.moveSlide(slide.id, -1)}><ArrowUp size={11} /></Button><Button size="icon" variant="ghost" className="size-6" aria-label={`Move ${slide.title} down`} disabled={workspace.busy || index === workspace.items.length - 1} onClick={() => void workspace.moveSlide(slide.id, 1)}><ArrowDown size={11} /></Button><Button size="icon" variant="ghost" className="size-6" aria-label={`Duplicate ${slide.title}`} disabled={workspace.busy} onClick={() => void workspace.duplicateSlide(slide.id).then((id) => id && selectSlide(id))}><Copy size={11} /></Button><Button size="icon" variant="ghost" className="size-6 text-rose-600" aria-label={`Delete ${slide.title}`} disabled={workspace.busy || workspace.items.length <= 1} onClick={() => setDeleteId(slide.id)}><Trash2 size={11} /></Button></div></div>)}
        <Button variant="outline" className="min-h-16 min-w-44 border-dashed border-slate-300 bg-transparent text-xs text-slate-500 shadow-none lg:min-w-0" disabled={workspace.busy} onClick={() => void addContentPage()}><Plus size={15} /> Add a page</Button>
      </div></aside>

      <section className="order-1 flex min-h-[500px] min-w-0 flex-col lg:order-2"><div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/75 px-4 py-2"><div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5" aria-label="Editing mode"><Button size="sm" variant={advanced ? "ghost" : "secondary"} className="h-7 min-h-7 text-[11px]" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Simple</Button><Button size="sm" variant={advanced ? "secondary" : "ghost"} className="h-7 min-h-7 text-[11px]" aria-pressed={advanced} onClick={() => setAdvanced(true)}><Layers size={12} /> Advanced</Button></div><div className="flex gap-1" aria-label="Preview screen size">{([{ id: "desktop", label: "Desktop", Icon: Monitor }, { id: "tablet", label: "Tablet", Icon: Tablet }, { id: "mobile", label: "Mobile", Icon: Smartphone }] as const).map(({ id, label, Icon }) => <Button key={id} size="icon" variant={viewport === id ? "secondary" : "ghost"} className="size-8" aria-label={`${label} preview`} aria-pressed={viewport === id} title={`${label} preview`} onClick={() => setViewport(id)}><Icon size={15} /></Button>)}</div></div>
        {active && !active.template && !active.composition && advanced && <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-3 py-2">{([{ type: "text", label: "Text", Icon: Type }, { type: "image", label: "Image", Icon: ImagePlus }, { type: "video", label: "Video", Icon: Video }, { type: "button", label: "Button", Icon: MousePointer2 }, { type: "shape", label: "Shape", Icon: Shapes }] as const).map(({ type, label, Icon }) => <Button key={type} size="sm" variant="ghost" className="text-xs" disabled={workspace.busy || active.objects.length >= 200} onClick={() => addObject(type)}><Icon size={13} /> {label}</Button>)}<Button size="sm" variant={grid ? "secondary" : "ghost"} aria-pressed={grid} className="ml-auto text-xs" onClick={() => setGrid((value) => !value)}>Grid & snap</Button></div>}
        {active?.composition ? <LearningPageEditor key={active.id} courseId={courseId} slide={{ ...active, composition: active.composition }} theme={workspace.theme} viewport={viewport} advanced={advanced} disabled={workspace.busy} onUpdate={update} onAdd={() => setBlockOpen(true)} onEditMaster={() => setMasterScope("slide")} onAction={(actions) => { for (const action of actions) { const index = workspace.items.findIndex((slide) => slide.id === active.id); const destination = action.type === "nextSlide" ? workspace.items[index + 1] : action.type === "previousSlide" ? workspace.items[index - 1] : undefined; if (destination) selectSlide(destination.id); } }} /> : <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-7 sm:px-6 lg:py-10"><div className="my-auto w-full">{active ? <FixedStageViewport viewport={viewport} background={active.template ? workspace.theme.backgroundColor : active.background.color} fitHeight={false}><div ref={canvasRef} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
          <SlideSurface slide={active} theme={workspace.theme}
            templateAuthoring={{ selectedSlot, disabled: workspace.busy, onSelect: selectSlot, onChooseImage: chooseImage, onTextChange: (key, content) => update((slide) => ({ ...slide, template: updateTemplateSlot(slide.template!, key, (slot) => slot.type === "text" ? { ...slot, content } : slot) }), `slot:${key}`) }}
            canvasAuthoring={{ selectedId: selectedObject, advanced, disabled: workspace.busy, onSelect: selectObject, onPointerDown: pointerDown, onKeyDown: (event, object) => {
              if (workspace.busy) return;
              if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); update((slide) => removeCanvasObject(slide, object.id)); selectObject(null); return; }
              const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
              if (dx || dy) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; update((slide) => ({ ...slide, objects: slide.objects.map((item) => item.id === object.id ? { ...item, x: Math.max(0, Math.min(1280 - item.width, item.x + dx * step)), y: Math.max(0, Math.min(720 - item.height, item.y + dy * step)) } : item) }), `nudge:${object.id}`); }
            } }} overrides={selectedObject ? { [selectedObject]: { stateId: previewState } } : undefined} />
          {!active.template && advanced && grid && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#94a3b833_1px,transparent_1px),linear-gradient(to_bottom,#94a3b833_1px,transparent_1px)] bg-[size:20px_20px]" />}
        </div></FixedStageViewport> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><LayoutTemplate size={32} className="mx-auto text-indigo-400" /><h2 className="mt-4 font-semibold">Every lesson starts with a good idea.</h2><Button className="mt-5" onClick={() => void addContentPage()}><Plus size={15} /> Choose your first slide</Button></div>}
          {active && !active.template && !active.objects.length && <Button variant="outline" className="mx-auto mt-4 flex" onClick={() => setGallery("replace")}><LayoutTemplate size={16} /> Choose a template for this slide</Button>}
        </div></div>}<footer className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/70 px-4 py-2 text-[10px] text-slate-400"><span>{active ? `Page ${workspace.items.findIndex((slide) => slide.id === active.id) + 1} of ${workspace.items.length}` : "No pages"} · {active?.composition ? "Content blocks & timeline layers" : active?.template ? "Responsive layout" : "Scaled canvas"}</span><span>{advanced && !active?.template ? "Arrow keys move objects · Shift for 10 px" : "Click content to edit · Layout adjusts automatically"}</span></footer>
      </section>
      {!active?.composition && <aside className="order-3 min-h-0 overflow-auto border-t border-slate-200 bg-white lg:border-l lg:border-t-0"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><h2 className="text-xs font-semibold">Make it yours</h2><span className="text-[10px] text-slate-400">{active?.template ? "Template slide" : "Canvas slide"}</span></div>{active && <div className="p-4"><MasterSlideSettings slide={active} disabled={workspace.busy} onEditMaster={() => setMasterScope("slide")} onUpdate={update} /></div>}{active?.template ? <TemplateInspector slide={{ ...active, template: active.template }} theme={workspace.theme} selectedSlot={selectedSlot} onSelect={selectSlot} tab={tab} onTab={setTab} onUpdate={update} onChooseImage={chooseImage} onReplace={() => setGallery("replace")} disabled={workspace.busy} advanced={advanced} /> : active && <CanvasInspector slide={active} slides={workspace.items} selectedId={selectedObject} onSelect={selectObject} onUpdate={update} tab={tab} onTab={setTab} advanced={advanced} disabled={workspace.busy} onMedia={(key, kind) => setMedia({ slideId: active.id, key, kind, template: false })} previewState={previewState} onPreviewState={setPreviewState} />}</aside>}
    </div>

    {masterError && <Dialog open onClose={() => setMasterError(null)} title="Could not apply slide master"><p role="alert">{masterError}</p></Dialog>}
    <BlockGallery open={blockOpen} onClose={() => { setBlockOpen(false); setBlockError(null); }} disabled={workspace.busy} onChoose={addBlock} onLayouts={() => { setBlockOpen(false); setGallery("block"); }} />
    {blockError && <Dialog open onClose={() => setBlockError(null)} title="Could not add block"><p role="alert">{blockError}</p></Dialog>}
    <TemplateGallery open={gallery !== null} onClose={() => setGallery(null)} onChoose={(id) => void chooseTemplate(id)} theme={workspace.theme} busy={workspace.busy} replacing={gallery === "replace"} blockMode={gallery === "block"} preserveCanvas={Boolean(active?.objects.length)} error={workspace.operationError ?? workspace.failure?.message} />
    {masterScope && <MasterEditor courseId={courseId} theme={workspace.theme} slide={active} slides={workspace.items} scope={masterScope} disabled={workspace.busy} onClose={() => setMasterScope(null)} onApply={(master, scope) => { if (scope === "course") changeTheme({ ...workspace.theme, preset: "custom", master }); else update((slide) => { const changes = masterOverridesFor(workspace.theme.master, master), overrides = Object.keys(changes).length ? changes : undefined; return slide.composition ? { ...slide, masterOverrides: undefined, composition: { ...slide.composition, masterOverrides: overrides } } : { ...slide, masterOverrides: overrides }; }); setMasterScope(null); }} />}
    <ThemeDialog onEditMaster={() => { setThemeOpen(false); setMasterScope("course"); }} open={themeOpen} onClose={() => setThemeOpen(false)} theme={workspace.theme} disabled={workspace.busy} onChange={changeTheme} />
    <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete this slide?" busy={workspace.busy} footer={<><Button variant="outline" onClick={() => setDeleteId(null)}>Keep slide</Button><Button variant="destructive" disabled={workspace.busy} onClick={() => deleteId && void workspace.deleteSlide(deleteId).then((id) => { if (id) { setDeleteId(null); if (active?.id === id) selectSlide(drafts.getSnapshot().items[0]?.id ?? ""); } })}>Delete slide</Button></>}><p className="text-sm leading-6 text-slate-600">“{workspace.items.find((slide) => slide.id === deleteId)?.title}” will be removed. Navigation actions pointing to this slide will also be removed.</p>{workspace.operationError && <p role="alert" className="mt-3 text-sm text-rose-700">{workspace.operationError}</p>}</Dialog>
    <Dialog open={reloadOpen} onClose={() => setReloadOpen(false)} title="Reload the saved version?" footer={<><Button variant="outline" onClick={downloadDraft}>Download local draft</Button><Button disabled={workspace.busy} onClick={() => void workspace.reloadSaved().then(() => setReloadOpen(false))}>Reload saved version</Button></>}><p className="text-sm leading-6 text-slate-600">Your unsaved changes will be replaced by the server’s saved version. Download your local draft first if you want to keep a copy.</p></Dialog>
    <MediaLibraryDialog courseId={courseId} kind={media?.kind ?? "image"} open={media !== null} onClose={() => setMedia(null)} onSelect={(asset) => {
      if (!media) return;
      drafts.update(media.slideId, (slide) => media.template && slide.template ? { ...slide, template: updateTemplateSlot(slide.template, media.key, (slot) => slot.type === "image" ? { ...slot, src: asset.fileUrl, alt: slot.alt || asset.originalName } : slot) } : { ...slide, objects: slide.objects.map((object) => object.id === media.key && (object.type === "image" || object.type === "video") ? { ...object, content: asset.fileUrl, ...(object.type === "image" ? { alt: object.alt || asset.originalName } : {}) } : object) });
      setMedia(null);
    }} />
  </main>;
}
