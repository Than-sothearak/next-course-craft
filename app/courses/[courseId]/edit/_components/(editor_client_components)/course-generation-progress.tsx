"use client";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
export function CourseGenerationProgress({ session, running, error, onRetry, onCancel, onSelectLesson, onClose }: {
  session: GenerationSessionSnapshot | null; running: boolean; error: string; onRetry: () => void; onCancel: () => void; onSelectLesson: (id: string) => void; onClose?: () => void;
}) {
  const panelClassName = "fixed bottom-4 left-4 z-40 max-h-[calc(100dvh-2rem)] w-[22rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-indigo-200 bg-white p-4 shadow-xl";
  if (!session || session.status === "outline") return error ? <div className={panelClassName}><div className="flex items-start justify-between gap-3"><p role="alert" className="text-sm text-rose-700">{error}</p>{onClose && <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close lesson drafts"><X size={16} /></Button>}</div></div> : null;
  const lessons = session.outline.sections.flatMap((section) => section.lessons);
  const complete = session.completedLessonIds.length;
  const percentage = Math.round(complete / lessons.length * 100);
  const current = lessons.find((lesson) => lesson.id === session.currentLessonId);
  const currentIsQuiz = current?.kind === "preTest" || current?.kind === "postTest";
  const currentType = currentIsQuiz ? "quiz" : "lesson";
  const completed = session.status === "completed";
  const cancelled = session.status === "cancelled";
  const activity = error ? "Generation stopped. Saved lessons are safe." : `${session.lease?.locked ? "Waiting for ongoing generation of" : session.readyToSave ? "Saving" : "Generating"} ${currentType} ${complete + 1}: ${current?.title ?? "Preparing…"}`;
  const statusTitle = completed
    ? "Lesson generation completed"
    : cancelled
      ? "Lesson generation cancelled"
      : `Generating ${currentType}...`;
  const statusIcon = completed
    ? <span role="img" aria-label="Generation completed" title="Generation completed" className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check size={17} aria-hidden="true" /></span>
    : cancelled
      ? <span role="img" aria-label="Generation cancelled" title="Generation cancelled" className="grid size-7 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><X size={17} aria-hidden="true" /></span>
      : <span role="img" aria-label="AI generation" title="AI generation" className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Sparkles size={16} aria-hidden="true" /></span>;
  return <section aria-label="Lesson draft generation" className={panelClassName}>
    <div className="mb-1 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">{statusIcon}<h2 className="text-sm font-semibold">{statusTitle}</h2></div>
      {onClose && session.status !== "generating" && <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} aria-label="Close lesson drafts" title="Close lesson drafts"><X size={16} /></Button>}
    </div>
    {!cancelled && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div>
        <p role="status" aria-live="polite" className="mt-1 text-sm text-slate-600">{complete} of {lessons.length} lessons generated and saved · {percentage}%</p>
      </div><div className="flex gap-2">{error && session.status === "generating" && <Button size="sm" variant="outline" onClick={onRetry}>Retry / resume</Button>}{session.status === "generating" && <Button size="sm" variant="outline" onClick={onCancel}>Cancel remaining</Button>}</div></div>
      <Progress value={percentage} aria-label="Lessons saved to database" className="mt-3" />
      {!completed && <p className="mt-2 flex min-w-0 items-center gap-1 text-xs text-slate-600">{running && <LoaderCircle size={12} className="shrink-0 animate-spin" />}<span data-generation-current-lesson title={activity} className="min-w-0 flex-1 truncate">{activity}</span></p>}
      {error && session.status === "generating" && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      <details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-600">Lesson status</summary><ol className="mt-2 max-h-44 space-y-1 overflow-y-auto">{lessons.map((lesson) => <li key={lesson.id} className="flex items-center justify-between gap-3">{!session.completedLessonIds.includes(lesson.id) ? <div className="min-w-0 flex-1 py-1" aria-label="Lesson draft loading"><Skeleton className="h-3 w-3/4" /></div> : <Button variant="ghost" size="sm" className="h-auto min-w-0 justify-start truncate px-1 text-xs" onClick={() => onSelectLesson(lesson.id)}>{lesson.title}</Button>}{session.completedLessonIds.includes(lesson.id) ? <span role="img" aria-label="Saved" title="Saved" className="shrink-0 text-emerald-600"><Check size={16} aria-hidden="true" /></span> : <span className="shrink-0 text-slate-500">{lesson.id === session.currentLessonId ? error ? "Failed" : "Generating" : "Pending"}</span>}</li>)}</ol></details>
    </>}
  </section>;
}
