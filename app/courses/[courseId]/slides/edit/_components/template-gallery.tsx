"use client";

import { useMemo, useState } from "react";
import { LayoutTemplate, LoaderCircle, Search, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SlideThumbnail } from "@/components/slides/slide-surface";
import { slideTemplateDefinitions, type SlideTemplateId } from "@/lib/slides/template-definitions";
import { createTemplateSlide } from "@/lib/slides/templates";
import type { SlideTheme } from "@/lib/slides/themes";

export function TemplateGallery({ open, onClose, onChoose, theme, busy, replacing, preserveCanvas, error, blockMode = false }: { open: boolean; onClose: () => void; onChoose: (id: SlideTemplateId | null) => void; theme: SlideTheme; busy: boolean; replacing: boolean; preserveCanvas: boolean; error?: string | null; blockMode?: boolean }) {
  const [search, setSearch] = useState(""), [category, setCategory] = useState("All");
  const slides = useMemo(() => new Map(slideTemplateDefinitions.map((template) => [template.id, { ...createTemplateSlide(template.id, 0), id: template.id }])), []);
  const visible = slideTemplateDefinitions.filter((template) => (category === "All" || template.category === category) && `${template.name} ${template.description}`.toLowerCase().includes(search.toLowerCase()));
  return <Dialog open={open} onClose={onClose} title={replacing ? "Choose a different design" : blockMode ? "Add a prebuilt layout block" : "Start with a great slide"} busy={busy} className="max-w-6xl">
    <p className="-mt-2 mb-5 max-w-2xl text-sm leading-6 text-slate-500">Choose a layout, replace the sample content, and make it yours. Spacing, alignment, and mobile layout are taken care of.</p>
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {replacing && <p className="mb-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">{preserveCanvas ? "This slide has a canvas layout. Your original will be kept and the selected template will be added as a new slide." : "Matching content stays in place. Other content is kept so it can be restored when you return to a compatible design."}</p>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1" aria-label="Template categories">{["All", "Introduction", "Content", "Images", "Closing"].map((item) => <Button key={item} size="sm" variant={category === item ? "secondary" : "ghost"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div><label className="relative min-w-52 flex-1 sm:max-w-64"><Search className="absolute top-3 left-3 text-slate-400" size={15} /><Input aria-label="Search slide templates" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a layout…" className="pl-9" /></label></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((template) => <Button key={template.id} variant="outline" className="block h-auto min-w-0 rounded-xl border-slate-200 p-2.5 text-left whitespace-normal shadow-none hover:border-indigo-400 hover:bg-indigo-50/30" aria-label={`Use ${template.name} template`} disabled={busy} onClick={() => onChoose(template.id)}>
      <SlideThumbnail slide={slides.get(template.id)!} theme={theme} />
      <div className="p-2"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{template.name}</span><LayoutTemplate size={13} className="shrink-0 text-slate-400" /></div><p className="text-xs leading-5 font-normal text-slate-500">{template.description}</p></div>
    </Button>)}</div>
    {!visible.length && <p role="status" className="py-12 text-center text-sm text-slate-500">No layouts match your search.</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-xs text-slate-500">{visible.length} layouts · Styled with your course theme</p>{busy ? <span role="status" className="flex items-center gap-2 text-sm text-indigo-700"><LoaderCircle size={16} className="animate-spin" /> Creating your slide…</span> : !replacing && !blockMode && <Button variant="ghost" size="sm" onClick={() => onChoose(null)}><SquareDashed size={15} /> Blank canvas · Advanced</Button>}</div>
  </Dialog>;
}
