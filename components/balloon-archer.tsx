"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { backgroundPaint, colorWithOpacity, contrastTextColor } from "@/lib/color";
import type { ArcherPoint } from "@/lib/interactive/balloon-archer";
import type { BalloonArcherData } from "@/lib/schemas/balloon-archer";
import { getInteractiveItemProgressId } from "@/lib/export/progress";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { ArcherScene } from "./balloon-archer/archer-scene";
import { useArcherGame } from "./balloon-archer/use-archer-game";
import { useArcherBalloons } from "./balloon-archer/use-archer-balloons";

export function BalloonArcher({ blockId, data, presentation = false, authoring = false, editing = false, decorative = false, interactedContentIds = new Set<string>(), onProgress, onPositionChange }: {
  blockId: string; data: BalloonArcherData; presentation?: boolean; authoring?: boolean; editing?: boolean; decorative?: boolean;
  interactedContentIds?: ReadonlySet<string>; onProgress?: (id: string) => void; onPositionChange?: (id: string, point: ArcherPoint) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const slideActive = useSlidePlaybackActive();
  const reducedMotion = Boolean(useReducedMotion());
  const fieldInk = contrastTextColor(data.backgroundColor);
  const [visible, setVisible] = useState(true), [previewing, setPreviewing] = useState(false), [replaying, setReplaying] = useState(false);
  const [localPopped, setLocalPopped] = useState<Set<string>>(() => new Set());
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const arranging = editing && !previewing;
  const enabled = !decorative && !arranging && visible && (!presentation || authoring || slideActive);
  const popped = new Set(data.balloons.filter((balloon) => localPopped.has(balloon.id) || (!authoring && !replaying && interactedContentIds.has(getInteractiveItemProgressId(blockId, "balloon", balloon.id)))).map((balloon) => balloon.id));
  const motion = useArcherBalloons(data.balloons, popped, enabled, reducedMotion);
  const game = useArcherGame({ balloons: data.balloons, getTargets: motion.getTargets, popped, enabled, reducedMotion, onPop: (balloon) => {
    setLocalPopped((current) => new Set([...current, balloon.id])); setRevealedId(balloon.id);
    const id = getInteractiveItemProgressId(blockId, "balloon", balloon.id);
    if (!authoring && !interactedContentIds.has(id)) onProgress?.(id);
  } });
  const { cancel } = game;
  const { restart: restartMotion } = motion;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer?.observe(element);
    const restart = () => { cancel(); restartMotion(); setRevealedId(null); };
    element.addEventListener(slideMediaRestartEvent, restart);
    return () => { observer?.disconnect(); element.removeEventListener(slideMediaRestartEvent, restart); };
  }, [cancel, restartMotion]);
  const revealed = data.balloons.find((balloon) => balloon.id === revealedId);
  const remaining = data.balloons.filter((balloon) => !popped.has(balloon.id));
  const replay = () => { cancel(); motion.restart(); setLocalPopped(new Set()); setReplaying(true); setRevealedId(null); game.setMessage("Ready for another round. Your recorded progress is kept."); };
  return <div ref={root} data-balloon-archer={blockId} data-slide-game-player onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.stopPropagation(); }} className={presentation ? "flex h-full min-h-[320px] min-w-[320px] w-full flex-col gap-2" : "w-full space-y-3"}>
    <div className="flex shrink-0 items-start gap-2">
      <div className="min-w-0 flex-1"><h3 className="font-semibold">{data.title || "Balloon Archer"}</h3><p className="text-xs leading-5 opacity-75">{arranging ? "Drag balloons to reposition them. Arrow keys move a focused balloon." : data.instructions}</p></div>
      {editing && <Button variant="outline" size="sm" aria-label={previewing ? "Arrange balloons" : "Preview Balloon Archer"} onClick={() => { replay(); setPreviewing(!previewing); }}><Play size={14} aria-hidden="true" />{previewing ? "Arrange" : "Preview"}</Button>}
      {!arranging && <Button variant="outline" size="icon" aria-label="Replay Balloon Archer" title="Replay without clearing progress" onClick={replay}><RotateCcw size={15} aria-hidden="true" /></Button>}
    </div>
    <div data-archer-arena className={`relative isolate overflow-hidden rounded-xl border border-slate-200 ${presentation ? "min-h-0 flex-1" : "aspect-[4/3] w-full"}`} style={backgroundPaint(data.backgroundColor)}>
      <ArcherScene data={data} positions={motion.targets} popped={popped} arranging={arranging} enabled={enabled && remaining.length > 0} reducedMotion={reducedMotion} pull={game.pull} recoil={game.recoil} shot={game.shot} burst={game.burst} onPull={game.setPull} onRelease={(pull) => { setRevealedId(null); game.fire(pull); }} onCancel={cancel} onReview={setRevealedId} onPositionChange={onPositionChange} />
      {!arranging && <span className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium" style={{ color: fieldInk, backgroundColor: colorWithOpacity(fieldInk, 8) }} aria-label="Balloon progress">{popped.size} / {data.balloons.length} discovered</span>}
      {revealed && !arranging && <Card role="region" aria-label={`Revealed balloon: ${revealed.word || "Balloon"}`} className="absolute inset-x-4 top-14 z-10 mx-auto flex max-h-[65%] max-w-md flex-col overflow-hidden border-white/30 bg-white/95 p-4 text-slate-900 shadow-xl backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2"><h4 className="min-w-0 flex-1 break-words font-semibold">{revealed.word || "Balloon"}</h4><Button variant="ghost" size="icon" className="size-7" aria-label="Close balloon reveal" onClick={() => setRevealedId(null)}><X size={14} aria-hidden="true" /></Button></div>
        <p className="min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6">{revealed.content || "There is no explanation for this balloon yet."}</p>
        <Button variant="outline" size="sm" className="mt-3 shrink-0" onClick={() => setRevealedId(null)}>{remaining.length ? "Continue aiming" : "All balloons discovered"}</Button>
      </Card>}
    </div>
    {!arranging && <p role="status" aria-live="polite" className="shrink-0 text-xs leading-5 opacity-75">{popped.size === data.balloons.length ? "All balloons discovered. Review a check mark or play again." : game.message}</p>}
  </div>;
}
