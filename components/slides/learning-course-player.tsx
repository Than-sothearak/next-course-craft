"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LearningPageSurface } from "./learning-page-surface";
import { SlideSurface } from "./slide-surface";
import { usePageClock } from "./use-page-clock";
import { masterSettingsForSlide, renderSlideMaster } from "@/lib/slides/master-schema";
import { pageRequirementsMet } from "@/lib/slides/blocks";
import { restorePageProgress, type CoursePageProgress, type PageProgress } from "@/lib/slides/progress";
import type { SlideAction, SlideRecord } from "@/lib/slides/schema";
import type { SlideTheme } from "@/lib/slides/themes";
import type { CanvasOverrides } from "./canvas-surface";
import { FixedStageViewport } from "./fixed-stage-viewport";

function ContentPage({ page, theme, progress, onProgress, onAction, overrides }: { page: SlideRecord; theme: SlideTheme; progress?: PageProgress; onProgress: (update: (previous?: PageProgress) => PageProgress) => void; onAction: (actions: SlideAction[]) => void; overrides?: CanvasOverrides }) {
  const clock = usePageClock(page.composition?.duration ?? 30);
  const completed = progress?.completedBlocks ?? [];
  const ready = !page.composition || pageRequirementsMet(page.composition, completed);
  const updateBlock = (id: string) => onProgress((current) => ({ revision: page.revision, finished: current?.finished ?? false, completedBlocks: [...new Set([...(current?.completedBlocks ?? []), id])] }));
  const content = page.composition && <LearningPageSurface slideTitle={page.title} slideOrder={page.order} page={{ ...page.composition, ...masterSettingsForSlide(page) }} theme={theme} time={clock.time} playing={clock.playing} onComplete={(id) => { if (!completed.includes(id)) updateBlock(id); }} onAction={onAction} />;
  return <div className="min-w-0 overflow-hidden rounded-xl bg-white text-slate-900 shadow-xl">
    {page.composition ? <><div className="flex flex-wrap items-center gap-3 border-b p-4"><Button variant="outline" size="sm" onClick={clock.toggle}>{clock.playing ? "Pause page" : "Play page"}</Button><Input aria-label="Page playback position" type="range" className="min-w-32 flex-1" min={0} max={page.composition.duration} step={.1} value={clock.time} onChange={(event) => { clock.pause(); clock.seek(Number(event.target.value)); }} /><span className="text-xs tabular-nums">{clock.time.toFixed(1)}s / {page.composition.duration}s</span></div>{page.composition.layout === "flow" && !renderSlideMaster(theme.master, masterSettingsForSlide(page).masterOverrides)?.enabled ? content : <FixedStageViewport resolution={page.composition.resolution} fitHeight={false} background={theme.backgroundColor}>{content}</FixedStageViewport>}</> : renderSlideMaster(theme.master, masterSettingsForSlide(page).masterOverrides)?.enabled ? <FixedStageViewport fitHeight={false}><SlideSurface slide={page} theme={theme} onAction={onAction} overrides={overrides} /></FixedStageViewport> : <SlideSurface slide={page} theme={theme} onAction={onAction} overrides={overrides} />}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5"><p className="text-sm text-slate-600">{progress?.finished ? "Page completed." : ready ? "Finished reading? Mark this page complete." : "Complete the required interactions, quiz or media before marking this page complete."}</p><Button disabled={!ready || progress?.finished} onClick={() => onProgress(() => ({ revision: page.revision, completedBlocks: completed, finished: true }))}>{progress?.finished ? "Completed" : "Mark page complete"}</Button></div>
  </div>;
}

type Props = { title: string; slides: SlideRecord[]; theme: SlideTheme; editorHref?: string; progressKey?: string };
const subscribeHydration = () => () => {};
export function LearningCoursePlayer(props: Props) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return hydrated ? <LearningCourseContent key={`${props.progressKey}:${props.slides.map((slide) => `${slide.id}:${slide.revision}`).join(",")}`} {...props} /> : <p className="p-8">Loading course content…</p>;
}
function LearningCourseContent({ title, slides, theme, editorHref, progressKey }: Props) {
  const storageKey = progressKey ? `coursecraft:learning-progress:${progressKey}` : null;
  const [index, setIndex] = useState(0), [menu, setMenu] = useState(true), [progress, setProgress] = useState<CoursePageProgress>(() => {
    try { return restorePageProgress(storageKey ? JSON.parse(localStorage.getItem(storageKey) ?? "null") : null, slides); } catch { return {}; }
  });
  const [feedback, setFeedback] = useState<string | null>(null), [overrides, setOverrides] = useState<Record<string, CanvasOverrides>>({});
  useEffect(() => { if (!storageKey) return; try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* Progress still works in this tab. */ } }, [storageKey, progress]);
  const page = slides[index];
  const goTo = useCallback((next: number) => { setIndex(Math.max(0, Math.min(slides.length - 1, next))); setFeedback(null); }, [slides.length]);
  const runActions = useCallback((actions: SlideAction[], source = page?.id) => {
    if (!source) return;
    for (const action of actions) {
      if (action.type === "nextSlide") goTo(index + 1);
      else if (action.type === "previousSlide") goTo(index - 1);
      else if (action.type === "goToSlide") { const next = slides.findIndex((slide) => slide.id === action.slideId); if (next >= 0) goTo(next); }
      else if (action.type === "feedback") setFeedback(action.message);
      else if (action.type === "openUrl") { try { const url = new URL(action.url); if (["https:", "http:"].includes(url.protocol)) window.open(url.href, "_blank", "noopener,noreferrer"); } catch { /* Validated at persistence boundary. */ } }
      else setOverrides((current) => ({ ...current, [source]: { ...current[source], [action.targetObjectId]: { ...current[source]?.[action.targetObjectId], ...(action.type === "setState" ? { stateId: action.stateId } : { visible: action.type === "showObject" }) } } }));
    }
  }, [goTo, index, page?.id, slides]);
  const previousRef = useRef<SlideRecord | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    if (previous?.id === page?.id) return;
    previousRef.current = page ?? null;
    if (previous) runActions(previous.interactions.filter((entry) => entry.event === "slideExit").map((entry) => entry.action), previous.id);
    if (page) runActions(page.interactions.filter((entry) => entry.event === "slideEnter").map((entry) => entry.action), page.id);
  }, [page, runActions]);
  const completedPages = slides.filter((slide) => progress[slide.id]?.finished).length;
  return <main className="min-h-screen bg-slate-100"><header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4"><div><p className="text-xs text-indigo-600">Interactive course</p><h1 className="font-semibold">{title}</h1></div><div className="flex items-center gap-3"><Button variant="outline" size="sm" aria-expanded={menu} onClick={() => setMenu((value) => !value)}>Content menu</Button>{editorHref && <a href={editorHref} className="text-sm text-indigo-700 underline">Back to editor</a>}</div></header>
    <div className={`mx-auto grid max-w-[1600px] gap-5 p-3 sm:p-6 ${menu ? "lg:grid-cols-[260px_minmax(0,1fr)]" : "grid-cols-1"}`}>
      {menu && <nav aria-label="Course content" className="self-start rounded-xl border bg-white p-4"><h2 className="text-sm font-semibold">Course content</h2><p role="status" className="my-3 text-xs text-slate-500">{completedPages} of {slides.length} pages completed</p><div role="progressbar" aria-label="Course completion" aria-valuenow={completedPages} aria-valuemin={0} aria-valuemax={slides.length} className="mb-4 h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${slides.length ? completedPages / slides.length * 100 : 0}%` }} /></div><div className="space-y-2">{slides.map((slide, position) => <Button key={slide.id} variant={position === index ? "secondary" : "ghost"} className="h-auto w-full justify-start whitespace-normal text-left" aria-current={position === index ? "page" : undefined} onClick={() => goTo(position)}><span className="mr-2">{progress[slide.id]?.finished ? "✓" : position + 1}</span><span>{slide.title}<span className="block text-[10px] font-normal text-slate-500">{progress[slide.id]?.finished ? "Completed" : position === index ? "In progress" : "Not completed"}</span></span></Button>)}</div></nav>}
      <div className="min-w-0">{page ? <ContentPage key={page.id} page={page} theme={theme} progress={progress[page.id]} onProgress={(update) => setProgress((current) => ({ ...current, [page.id]: update(current[page.id]) }))} onAction={runActions} overrides={overrides[page.id]} /> : <p>No content pages yet.</p>}{feedback && <div role="status" className="mt-4 rounded-xl bg-indigo-100 p-4">{feedback}<Button size="sm" variant="ghost" onClick={() => setFeedback(null)}>Dismiss</Button></div>}<footer className="mt-5 flex items-center justify-between"><Button variant="outline" disabled={index === 0} onClick={() => goTo(index - 1)}>Previous page</Button><span className="text-xs text-slate-600">Page {index + 1} of {slides.length}</span><Button disabled={index >= slides.length - 1} onClick={() => goTo(index + 1)}>Next page</Button></footer><p className="mt-4 text-xs text-slate-500">Preview progress is saved in this browser when storage is available.</p></div>
    </div>
  </main>;
}
