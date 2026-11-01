"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { contrastTextColor } from "@/lib/color";
import type { ContentBlock, HangingRopeCard } from "@/lib/schemas/block";
import { getInteractiveItemProgressId } from "@/lib/export/progress";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { RopeCardScene } from "./rope-card-scene";

type Data = Extract<ContentBlock, { type: "hangingRopeCards" }>["data"];
export function HangingRopeCards({ blockId, data, presentation = false, authoring = false, decorative = false, interactedContentIds, onProgress, renderContent }: {
  blockId: string; data: Data; presentation?: boolean; authoring?: boolean; decorative?: boolean; interactedContentIds?: ReadonlySet<string>; onProgress?: (id: string) => void; renderContent: (card: HangingRopeCard) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), reviewButton = useRef<HTMLButtonElement | null>(null);
  const reported = useRef(new Set<string>());
  const [replaying, setReplaying] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set()), [selectedId, setSelectedId] = useState<string | null>(null), [replayToken, setReplayToken] = useState(0), [visible, setVisible] = useState(true);
  const reducedMotion = Boolean(useReducedMotion()), slideActive = useSlidePlaybackActive();
  const selected = data.cards.find((card) => card.id === selectedId);
  const active = !decorative && visible && (!presentation || authoring || slideActive);
  const complete = (id: string) => revealed.has(id) || (!authoring && !replaying && Boolean(interactedContentIds?.has(getInteractiveItemProgressId(blockId, "rope", id))));
  // Persisted completion and local replay are intentionally independent.
  const completedIds = new Set(data.cards.filter((card) => complete(card.id)).map((card) => card.id));
  const pauseMedia = useCallback(() => { root.current?.querySelectorAll<HTMLMediaElement>("video,audio").forEach((media) => { if (!media.paused) media.pause(); }); }, []);
  const replay = useCallback(() => { pauseMedia(); setReplaying(true); setRevealed(new Set()); setSelectedId(null); setReplayToken((value) => value + 1); }, [pauseMedia]);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)); observer?.observe(element);
    const restart = () => { if (data.allowReplay) replay(); else pauseMedia(); };
    const visibility = () => { if (document.hidden) pauseMedia(); };
    document.addEventListener("visibilitychange", visibility);
    element.addEventListener(slideMediaRestartEvent, restart);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", visibility); element.removeEventListener(slideMediaRestartEvent, restart); pauseMedia(); };
  }, [data.allowReplay, replay, pauseMedia]);
  useEffect(() => { if (!active) pauseMedia(); }, [active, pauseMedia]);
  useLayoutEffect(() => {
    const behavior = reducedMotion ? "auto" : "smooth";
    if (selectedId) {
      content.current?.focus({ preventScroll: true });
      // Wrapped mobile grids may be tall; bring the opened discovery into view.
      if (!presentation) content.current?.parentElement?.scrollIntoView?.({ block: "start", behavior });
    } else if (reviewButton.current?.isConnected) {
      reviewButton.current.focus({ preventScroll: true });
      if (!presentation) reviewButton.current.scrollIntoView?.({ block: "nearest", behavior });
    }
  }, [selectedId, presentation, reducedMotion]);
  function open(cardId: string) {
    reviewButton.current = [...(root.current?.querySelectorAll<SVGSVGElement>("[data-rope-scene]") ?? [])].find((scene) => scene.dataset.ropeScene === cardId)?.querySelector<HTMLButtonElement>("[data-rope-card-button]") ?? null;
    setSelectedId(cardId);
  }
  function finish(card: HangingRopeCard) {
    setRevealed((current) => new Set([...current, card.id])); open(card.id);
    const progressId = getInteractiveItemProgressId(blockId, "rope", card.id);
    if (!authoring && !reported.current.has(progressId) && !interactedContentIds?.has(progressId)) { reported.current.add(progressId); onProgress?.(progressId); }
  }
  function close() { pauseMedia(); setSelectedId(null); }
  return <div ref={root} data-hanging-rope-cards={blockId} data-slide-game-player className={presentation ? "relative flex h-full min-h-[300px] min-w-[300px] w-full flex-col gap-2" : "relative w-full space-y-3"} onKeyDown={(event) => { if (event.key === "Escape" && selected) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <div className="flex shrink-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-semibold">{data.title || "Hanging Rope Cards"}</h3>{data.showInstructions && <p className="mt-1 text-xs leading-5 opacity-65">{data.instructions}</p>}</div>{data.allowReplay && !decorative && <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="Replay hanging cards" onClick={replay}><RotateCcw size={14} aria-hidden="true" /></Button>}</div>
    <div data-rope-board className={`grid min-w-0 gap-x-3 gap-y-5 rounded-2xl border border-black/5 p-2 ${presentation ? "min-h-0 flex-1" : ""}`} style={{ backgroundColor: data.backgroundColor, color: contrastTextColor(data.backgroundColor), gridTemplateColumns: presentation ? `repeat(${Math.min(3, data.cards.length)}, minmax(0,1fr))` : "repeat(auto-fit, minmax(min(100%, 205px), 1fr))", gridTemplateRows: presentation ? `repeat(${Math.ceil(data.cards.length / 3)}, minmax(0,1fr))` : undefined }}>
      {data.cards.map((card) => <div key={card.id} data-slide-animation-item className={presentation ? "min-h-0 min-w-0" : "mx-auto aspect-[7/11] max-h-[440px] w-full min-w-0"}><RopeCardScene key={`${card.id}-${replayToken}`} card={card} settings={data} completed={completedIds.has(card.id)} enabled={active && !selected} reducedMotion={reducedMotion} replayToken={replayToken} onComplete={() => finish(card)} onReview={() => open(card.id)} /></div>)}
    </div>
    <p role="status" className="shrink-0 text-xs opacity-60">{completedIds.size} / {data.cards.length} discoveries{authoring ? " · Author preview" : ""}</p>
    {selected && <Card role="region" aria-label={`Rope discovery: ${selected.title || "Discovery"}`} className={`${presentation ? "absolute inset-3 z-30 flex min-h-0 flex-col" : "relative mt-4"} overflow-hidden border-slate-200 bg-white p-4 text-slate-900 shadow-xl`}>
      <div className="mb-3 flex shrink-0 items-center gap-2"><h4 className="min-w-0 flex-1 break-words font-semibold">{selected.title || "Discovery"}</h4><Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close rope discovery" onClick={close}><X size={16} aria-hidden="true" /></Button></div>
      <div ref={content} tabIndex={-1} className={`${presentation ? "min-h-0 flex-1" : "max-h-[480px]"} overflow-y-auto overscroll-contain rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}>{renderContent(selected)}</div>
    </Card>}
  </div>;
}
