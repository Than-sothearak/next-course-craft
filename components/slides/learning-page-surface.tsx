"use client";
/* eslint-disable @next/next/no-img-element -- Browser-only renderer is shared with future static learner exports. */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluateQuizAttempt, isQuizAnswerCorrect, type QuizAnswers } from "@/lib/interactive/quiz-assessment";
import type { LearningBlock, LearningPage, ObjectPlacement } from "@/lib/slides/blocks";
import { layerActive } from "@/lib/slides/blocks";
import { readableSlideColor, type SlideTheme } from "@/lib/slides/themes";
import { TemplateSurface } from "./template-surface";
import type { PreviewAudioMonitor } from "@/lib/slides/timeline";
import { TimedMedia } from "./timed-media";
import type { SlideAction } from "@/lib/slides/schema";
import { renderSlideMaster } from "@/lib/slides/master-schema";
import { ObjectCanvasSurface } from "./object-canvas-surface";

type ContentProps = { monitor?: PreviewAudioMonitor; block: LearningBlock; theme: SlideTheme; time?: number; playing?: boolean; onComplete?: (id: string) => void; onAction?: (actions: SlideAction[]) => void; onMediaDuration?: (id: string, duration: number) => void; staticPreview?: boolean; fit?: boolean };
function LearningObjectContent({ block, theme, time, playing, onComplete, onAction, onMediaDuration, staticPreview, fit, monitor }: ContentProps) {
  if (staticPreview && !["template", "text", "image", "shape", "button"].includes(block.kind)) return <p className="p-6 text-xl font-semibold">{block.name}</p>;
  if (block.kind === "template") return <TemplateSurface template={block.content} theme={theme} onAction={onAction} staticPreview={staticPreview} />;
  if (block.kind === "text") return <>{block.heading && <h2 className="font-semibold" style={{ fontSize: block.appearance?.headingSize ?? 32 }}>{block.heading}</h2>}<p className="mt-3 whitespace-pre-wrap leading-relaxed" style={{ fontSize: block.appearance?.fontSize ?? 22 }}>{block.body}</p></>;
  if (block.kind === "image") return block.src ? <img src={block.src} alt={block.alt} className="h-full w-full" style={{ objectFit: block.appearance?.imageFit ?? "contain" }} /> : <p className="p-6 text-sm">Choose an image.</p>;
  if (block.kind === "audio" || block.kind === "video") return <TimedMedia monitor={monitor} fit={fit} block={block} time={time} playing={playing} onDuration={(duration) => onMediaDuration?.(block.id, duration)} onComplete={() => onComplete?.(block.id)} />;
  if (block.kind === "quiz") return <QuizBlock block={block} onComplete={() => onComplete?.(block.id)} />;
  if (block.kind === "button") return staticPreview ? <span>{block.label}</span> : <Button className="h-full w-full whitespace-normal" style={{ background: block.appearance?.backgroundColor ?? theme.primaryColor, color: block.appearance?.color ?? readableSlideColor(block.appearance?.backgroundColor ?? theme.primaryColor), fontSize: block.appearance?.fontSize ?? 22 }} onClick={() => onAction?.([{ type: block.action }])}>{block.label}</Button>;
  if (block.kind === "shape") {
    const fill = block.appearance?.backgroundColor ?? theme.primaryColor;
    return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-label={block.name} role="img"><g fill={fill} stroke={block.appearance?.borderColor ?? fill} strokeWidth={block.appearance?.borderWidth ?? 0}>{block.shape === "ellipse" ? <ellipse cx="50" cy="50" rx="48" ry="48" /> : block.shape === "triangle" ? <polygon points="50,2 98,98 2,98" /> : block.shape === "line" ? <line x1="0" y1="50" x2="100" y2="50" strokeWidth={block.appearance?.borderWidth || 3} /> : block.shape === "arrow" ? <polygon points="0,30 65,30 65,0 100,50 65,100 65,70 0,70" /> : <rect x="1" y="1" width="98" height="98" rx={block.shape === "roundedRectangle" ? 12 : 0} />}</g></svg>;
  }
  return <ExploreBlock block={block} onComplete={() => onComplete?.(block.id)} />;
}

type SurfaceProps = { monitor?: PreviewAudioMonitor; slideTitle?: string; slideOrder?: number; page: LearningPage; theme: SlideTheme; time?: number; playing?: boolean; selectedId?: string | null; disabled?: boolean; onSelect?: (id: string) => void; onPlacement?: (id: string, placement: ObjectPlacement, group?: string) => void; onDelete?: (id: string) => void; onComplete?: (id: string) => void; onAction?: (actions: SlideAction[]) => void; onMediaDuration?: (id: string, duration: number) => void; staticPreview?: boolean };
export function LearningPageSurface(props: SurfaceProps) {
  const { page, theme, time, onSelect, selectedId } = props;
  const canvas = page.layout !== "flow" || !!renderSlideMaster(theme.master, page.masterOverrides)?.enabled;
  const renderObject = (block: LearningBlock) => <LearningObjectContent {...props} fit={canvas} block={block} />;
  if (canvas) return <ObjectCanvasSurface {...props} renderObject={renderObject} />;
  const visible = page.layers.filter((layer) => time === undefined ? layer.visible : layerActive(layer, Math.min(time, page.duration - .001), page.duration));
  return <div data-learning-page className="@container min-h-80 space-y-5 p-5" style={{ background: theme.backgroundColor, color: readableSlideColor(theme.backgroundColor), overflowWrap: "anywhere", fontFamily: theme.fontFamily === "serif" ? "Georgia, serif" : "Arial, sans-serif" }}>{visible.map((block) => <section key={block.id} data-layer-id={block.id} className={`relative min-w-0 rounded-xl ${onSelect ? "border p-4" : ""} ${selectedId === block.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"}`}>{onSelect && <Button size="sm" variant="outline" className="mb-4" onClick={() => onSelect(block.id)}>Edit {block.name}</Button>}{renderObject(block)}</section>)}</div>;
}

function ExploreBlock({ block, onComplete }: { block: Extract<LearningBlock, { items: unknown }>; onComplete?: () => void }) {
  const [seen, setSeen] = useState<string[]>([]), [active, setActive] = useState<string | null>(null);
  const explore = (id: string) => { const next = [...new Set([...seen, id])]; setSeen(next); if (next.length === block.items.length) onComplete?.(); };
  if (block.kind === "accordion") return <div className="space-y-2">{block.items.map((item) => <details key={item.id} className="rounded-lg border p-4" onToggle={(event) => { if (event.currentTarget.open) explore(item.id); }}><summary className="cursor-pointer font-medium">{item.title}</summary><p className="mt-3 whitespace-pre-wrap leading-7">{item.body}</p></details>)}</div>;
  if (block.kind === "tabs") return <div><div role="group" aria-label="Explore topics" className="flex flex-wrap gap-2">{block.items.map((item) => <Button key={item.id} variant={active === item.id ? "default" : "outline"} aria-pressed={active === item.id} onClick={() => { setActive(item.id); explore(item.id); }}>{item.title}</Button>)}</div>{active ? <p className="mt-4 whitespace-pre-wrap leading-7">{block.items.find((item) => item.id === active)?.body}</p> : <p className="mt-4 text-sm">Select each topic to explore.</p>}</div>;
  return <div className="grid gap-3 @lg:grid-cols-2">{block.items.map((item) => <Button key={item.id} variant="outline" className="h-auto min-h-40 whitespace-pre-wrap p-6 text-left leading-7" aria-label={`Flip ${item.title}`} aria-pressed={active === item.id} onClick={() => { setActive(active === item.id ? null : item.id); explore(item.id); }}>{active === item.id ? item.body : item.title}</Button>)}</div>;
}

function QuizBlock({ block, onComplete }: { block: Extract<LearningBlock, { kind: "quiz" }>; onComplete?: () => void }) {
  const [answers, setAnswers] = useState<QuizAnswers>({}), [result, setResult] = useState<ReturnType<typeof evaluateQuizAttempt>>(null);
  return <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); const attempt = evaluateQuizAttempt(block.questions, answers, block.passingScore); setResult(attempt); if (attempt?.passed) onComplete?.(); }}>
    {block.questions.map((question, index) => <fieldset key={question.id} disabled={result !== null} className="space-y-3"><legend className="mb-3 font-semibold">{index + 1}. {question.prompt}</legend>{question.imageSrc && <img src={question.imageSrc} alt={question.imageAlt} className="max-h-64 max-w-full" />}{question.choices.map((choice) => <label key={choice.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Input type={question.selectionMode === "single" ? "radio" : "checkbox"} name={`question-${block.id}-${question.id}`} className="size-4 shrink-0 accent-indigo-600" checked={answers[question.id]?.includes(choice.id) ?? false} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: question.selectionMode === "single" ? (event.target.checked ? [choice.id] : []) : event.target.checked ? [...(current[question.id] ?? []), choice.id] : (current[question.id] ?? []).filter((id) => id !== choice.id) }))} /><span>{choice.text}{choice.imageSrc && <img src={choice.imageSrc} alt={choice.imageAlt} className="max-h-32 max-w-full" />}</span></label>)}{result && <p className="text-sm">{isQuizAnswerCorrect(question, answers[question.id] ?? []) ? question.correctFeedback : question.incorrectFeedback}</p>}</fieldset>)}
    {result ? <div role="status" className="space-y-3"><p className="font-semibold">Score: {result.score}% · {result.passed ? "Passed" : `You need ${block.passingScore}% to pass.`}</p><Button type="button" variant="outline" onClick={() => { setAnswers({}); setResult(null); }}>Retry quiz</Button></div> : <Button type="submit" disabled={block.questions.some((question) => !answers[question.id]?.length)}>Submit quiz</Button>}
  </form>;
}

