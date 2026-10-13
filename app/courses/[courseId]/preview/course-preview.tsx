"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Circle, CirclePlay, ClipboardList, FileText, Lightbulb, Menu, Monitor, Smartphone, Tablet } from "lucide-react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { defaultBlockPadding, defaultBlockWidth, type ContentBlock } from "@/lib/schemas/block";
import { getCourseProgress } from "@/lib/editor/preview";
import { Button } from "@/components/ui/button";
import { StatementBlockPreview } from "../edit/_components/statement-block-preview";
import { StatementTextPreview } from "../edit/_components/statement-text-preview";
import type { QuizQuestion } from "@/lib/schemas/quiz";

type PreviewData = { courseId: string } & Omit<EditorSnapshotInput, "revision">;
type PreviewMode = "course" | "learn";
type PreviewDevice = "desktop" | "tablet" | "mobile";

const lessonIcons = {
  file: FileText,
  book: BookOpen,
  video: CirclePlay,
  quiz: ClipboardList,
  idea: Lightbulb,
} as const;

function authorInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CA";
}

function contrastTextColor(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length < 3) return "#111827";
  const luminance = channels.slice(0, 3).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? "#111827" : "#ffffff";
}

function safeImageSource(value: string) {
  const source = value.trim();
  return /^https?:\/\//i.test(source) || (source.startsWith("/") && !source.startsWith("//")) ? source : "";
}

function QuizQuestionPreview({ question, index }: { question: QuizQuestion; index: number }) {
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const hasAnswerKey = question.correctChoiceIds.length > 0;

  function toggleChoice(choiceId: string, selected: boolean) {
    setSelectedChoiceIds((previous) => question.selectionMode === "single"
      ? selected ? [choiceId] : []
      : selected ? [...previous, choiceId] : previous.filter((id) => id !== choiceId));
    setIsCorrect(null);
  }

  function checkAnswer() {
    const selected = new Set(selectedChoiceIds);
    const correct = new Set(question.correctChoiceIds);
    setIsCorrect(selected.size === correct.size && [...selected].every((id) => correct.has(id)));
  }

  const questionImage = safeImageSource(question.imageSrc);

  return <section aria-labelledby={`quiz-question-${question.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Question {index + 1}</p>
    <h2 id={`quiz-question-${question.id}`} className="mt-2 text-xl font-semibold leading-snug text-slate-900">{question.prompt || "Question prompt"}</h2>
    {questionImage && <Image src={questionImage} alt={question.imageAlt} width={960} height={540} unoptimized className="mt-4 max-h-[420px] w-auto rounded-xl object-contain" />}
    <fieldset className="mt-5 space-y-3">
      <legend className="sr-only">{question.selectionMode === "single" ? "Choose one answer" : "Choose all answers that apply"}</legend>
      {question.choices.map((choice, choiceIndex) => {
        const choiceImage = safeImageSource(choice.imageSrc);
        return <label key={choice.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${selectedChoiceIds.includes(choice.id) ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
          <input type={question.selectionMode === "single" ? "radio" : "checkbox"} name={`answer-${question.id}`} checked={selectedChoiceIds.includes(choice.id)} onChange={(event) => toggleChoice(choice.id, event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-indigo-600" />
          <span className="min-w-0 flex-1">{choice.text && <span className="block">{choice.text}</span>}{choiceImage && <Image src={choiceImage} alt={choice.imageAlt} width={640} height={420} unoptimized className={`${choice.text ? "mt-2" : ""} max-h-56 w-auto rounded-lg object-contain`} />}{!choice.text && !choiceImage && <span className="text-slate-400">Answer {choiceIndex + 1}</span>}</span>
        </label>;
      })}
    </fieldset>
    <Button type="button" onClick={checkAnswer} disabled={!selectedChoiceIds.length || !hasAnswerKey} className="mt-5">Check answer</Button>
    {!hasAnswerKey && <p role="status" className="mt-3 text-sm text-amber-700">The answer key has not been set for this question.</p>}
    {isCorrect !== null && <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{isCorrect ? question.correctFeedback || "Correct!" : question.incorrectFeedback || "That answer is not correct. Try again."}</p>}
  </section>;
}

function PreviewBlock({ block, device, animateListItems = false }: { block: ContentBlock; device: PreviewDevice; animateListItems?: boolean }) {
  if (block.type === "divider") {
    return block.data.style === "line" ? <hr className="border-0 border-t border-slate-300" /> : <div aria-hidden="true" className="h-10" />;
  }

  const contentWidth = block.widthCustom ? block.width : defaultBlockWidth(block.type);
  const widthClass = contentWidth === "small" ? "max-w-[520px]" : contentWidth === "medium" ? "max-w-[720px]" : "max-w-[920px]";
  const blockPadding = block.blockPadding ?? defaultBlockPadding(block.type);
  const style = { backgroundColor: block.backgroundColor, color: contrastTextColor(block.backgroundColor), paddingTop: `${blockPadding}px`, paddingBottom: `${blockPadding}px` };

  let content: React.ReactNode;
  if (block.type === "heading") {
    content = <StatementTextPreview tag="h3" text={block.data.text} html={block.data.html} className="text-3xl font-semibold tracking-tight [&_h1]:my-0 [&_h1]:text-4xl [&_h2]:my-0 [&_h2]:text-3xl [&_h3]:my-0 [&_h3]:text-2xl [&_p]:my-0 [&_p]:text-3xl [&_p]:font-semibold" />;
  } else if (block.type === "richText") {
    content = <StatementTextPreview tag="p" text="" html={block.data.html} className={`prose max-w-none leading-7 [&_p]:my-3 [&_h1]:my-5 [&_h2]:my-4 [&_h3]:my-3 ${animateListItems ? "lesson-list-enter" : ""}`} />;
  } else if (block.type === "statement") {
    content = <StatementBlockPreview style={block.data.style} title={block.data.title} body={block.data.body} titleHtml={block.data.titleHtml} bodyHtml={block.data.bodyHtml} />;
  } else if (block.type === "image") {
    content = <figure><Image src={block.data.src} alt={block.data.alt} width={1200} height={675} unoptimized className="max-h-[640px] w-full rounded-lg object-contain" />{block.data.caption && <figcaption className="mt-3 text-center text-sm text-slate-500">{block.data.caption}</figcaption>}</figure>;
  } else if (block.type === "gallery") {
    const columns = block.data.images.length === 1 ? "grid-cols-1" : device === "mobile" ? "grid-cols-1" : block.data.images.length === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
    content = <div className={`grid ${columns} gap-3`}>{block.data.images.map((image, index) => <Image key={`${block.id}-${index}`} src={image.src} alt={image.alt} width={640} height={480} unoptimized className="aspect-[4/3] w-full rounded-lg object-cover" />)}</div>;
  } else if (block.type === "video") {
    const isVideoFile = Boolean(block.data.mimeType) || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src);
    content = isVideoFile ? <video controls className="aspect-video w-full rounded-xl bg-black" src={block.data.src}>{block.data.captions && <track kind="captions" src={block.data.captions} srcLang="en" label="Captions" />}</video> : <a href={block.data.src} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900"><span className="grid size-14 place-items-center rounded-full bg-white/15"><CirclePlay size={27} /></span><span className="text-sm font-medium">Open video</span></a>;
  } else if (block.type === "knowledgeCheck") {
    content = <fieldset className="space-y-3"><legend className="text-lg font-semibold">{block.data.question}</legend><div className="space-y-2">{block.data.options.map((option, index) => <label key={`${block.id}-${index}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-indigo-300"><input type="radio" name={`preview-${block.id}`} className="mt-0.5 accent-indigo-600" /><span>{option}</span></label>)}</div></fieldset>;
  } else {
    content = <fieldset className="space-y-4"><legend className="text-lg font-semibold">{block.data.question}</legend><div className="flex flex-wrap items-center gap-3">{[1, 2, 3, 4, 5].map((rating) => <label key={rating} className="flex cursor-pointer flex-col items-center gap-1 text-sm"><input type="radio" name={`preview-${block.id}`} value={rating} className="size-5 accent-indigo-600" /><span>{rating}</span></label>)}</div><div className="flex max-w-sm justify-between text-xs text-slate-500"><span>{block.data.minLabel}</span><span>{block.data.maxLabel}</span></div></fieldset>;
  }

  return <div className="w-full" style={style}><div className={`mx-auto w-full ${widthClass} px-4`}>{content}</div></div>;
}

function LessonBlocksPreview({
  blocks,
  device,
  animate,
  revealedDividerIds,
  completedDividerIds,
  onReveal,
}: {
  blocks: ContentBlock[];
  device: PreviewDevice;
  animate: boolean;
  revealedDividerIds: Set<string>;
  completedDividerIds: Set<string>;
  onReveal: (dividerId: string, nextBlockId?: string) => void;
}) {
  const firstHiddenDividerIndex = blocks.findIndex((block) =>
    block.type === "divider" && block.data.style === "continue" && !revealedDividerIds.has(block.id),
  );
  const visibleBlocks = firstHiddenDividerIndex < 0 ? blocks : blocks.slice(0, firstHiddenDividerIndex + 1);
  const mostRecentRevealedDividerIndex = visibleBlocks.reduce((lastIndex, block, index) =>
    block.type === "divider" && block.data.style === "continue" && revealedDividerIds.has(block.id) ? index : lastIndex,
  -1);

  return <div className="mt-10 space-y-8">{visibleBlocks.map((block, index) => {
    const blockDelay = Math.min(2100, Math.max(0, index - mostRecentRevealedDividerIndex - 1) * 240);
    const animationStyle = animate ? { animationDelay: `${blockDelay}ms`, "--lesson-block-delay": `${blockDelay}ms` } as CSSProperties : undefined;
    if (block.type === "divider" && block.data.style === "continue") {
      if (revealedDividerIds.has(block.id)) return null;
      const requiresCompletion = block.data.completionType === "completeAbove";
      const isDisabled = requiresCompletion && !completedDividerIds.has(block.id);
      return <div key={block.id} data-lesson-block-id={block.id} className={animate ? "lesson-block-enter" : undefined} style={animationStyle}>
        <div className="flex flex-col items-center gap-2 text-center">
          <Button type="button" disabled={isDisabled} aria-describedby={isDisabled ? `continue-hint-${block.id}` : undefined} onClick={() => onReveal(block.id, blocks[index + 1]?.id)} className="min-w-36 rounded-full px-6">
            {block.data.label.trim() || "Continue"}
          </Button>
          {isDisabled && <p id={`continue-hint-${block.id}`} className="text-xs text-slate-500">Scroll to the end of the content above to continue.</p>}
        </div>
      </div>;
    }
    return <div key={block.id} data-lesson-block-id={block.id} className={animate ? "lesson-block-enter" : undefined} style={animationStyle}><PreviewBlock block={block} device={device} animateListItems={animate} /></div>;
  })}</div>;
}

export function CoursePreview({ initialData, authorName }: { initialData: PreviewData; authorName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<PreviewMode>("course");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [visitedLessonIds, setVisitedLessonIds] = useState<Set<string>>(() => new Set());
  const [revealedDividerIds, setRevealedDividerIds] = useState<Set<string>>(() => new Set());
  const [completedDividerIds, setCompletedDividerIds] = useState<Set<string>>(() => new Set());
  const [pendingContinueScroll, setPendingContinueScroll] = useState<{ lessonId: string; blockId: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lessonContentScrollRef = useRef<HTMLDivElement>(null);
  const lessonArticleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lessonBodyScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sections = useMemo(() => [...initialData.sections].sort((a, b) => a.order - b.order), [initialData.sections]);
  const lessons = useMemo(() => sections.flatMap((section) => initialData.lessons.filter((lesson) => lesson.sectionId === section.id).sort((a, b) => a.order - b.order)), [initialData.lessons, sections]);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const lessonIndex = selectedLesson ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id) : -1;
  const progress = getCourseProgress(visitedLessonIds, lessons.map((lesson) => lesson.id));
  const initials = authorInitials(authorName);

  const markContentAboveComplete = useCallback((lesson: (typeof lessons)[number], element: HTMLDivElement) => {
    const divider = lesson.blocks.find((block) => block.type === "divider" && block.data.style === "continue" && !revealedDividerIds.has(block.id));
    if (divider?.type !== "divider" || divider.data.completionType !== "completeAbove" || completedDividerIds.has(divider.id)) return;
    const reachedEnd = element.scrollHeight <= element.clientHeight + 1 || element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
    if (reachedEnd) setCompletedDividerIds((previous) => new Set(previous).add(divider.id));
  }, [completedDividerIds, revealedDividerIds]);

  useEffect(() => {
    const lesson = lessons.find((item) => item.id === selectedLessonId);
    const element = lesson ? lessonBodyScrollRefs.current.get(lesson.id) : undefined;
    if (lesson && element) markContentAboveComplete(lesson, element);
  }, [selectedLessonId, revealedDividerIds, lessons, markContentAboveComplete]);

  useEffect(() => {
    if (!pendingContinueScroll) return;
    const frame = window.requestAnimationFrame(() => {
      if (pendingContinueScroll.lessonId === selectedLessonId) {
        const container = lessonBodyScrollRefs.current.get(pendingContinueScroll.lessonId);
        const target = container && Array.from(container.querySelectorAll<HTMLElement>("[data-lesson-block-id]"))
          .find((element) => element.dataset.lessonBlockId === pendingContinueScroll.blockId);
        if (container && target) {
          const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
          container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
      }
      setPendingContinueScroll(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingContinueScroll, revealedDividerIds, selectedLessonId]);

  useEffect(() => {
    if (mode !== "learn" || !selectedLessonId) return;
    const scrollContainer = lessonContentScrollRef.current;
    const article = lessonArticleRefs.current.get(selectedLessonId);
    if (!scrollContainer || !article) return;
    const top = article.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop;
    scrollContainer.scrollTo({ top, behavior: "smooth" });
  }, [mode, selectedLessonId]);

  function selectLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    setVisitedLessonIds((previous) => new Set(previous).add(lessonId));
    setMode("learn");
    setMobileMenuOpen(false);
  }

  function startLearning() {
    setMode("learn");
    if (!selectedLesson && lessons[0]) selectLesson(lessons[0].id);
  }

  function renderLessonMenu(mobile = false) {
    const menuWidth = mobile ? "h-full w-[min(84%,320px)] shadow-2xl" : `${device === "tablet" ? "w-[220px]" : "w-[270px]"} shrink-0 border-r border-slate-200`;
    return <aside className={`flex min-h-0 flex-col overflow-y-auto bg-white ${menuWidth}`}>
      <div className="bg-[#2c5d96] px-4 py-5 text-white sm:px-5">
        <p className="line-clamp-3 text-lg font-semibold leading-tight">{initialData.title}</p>
        <div className="mt-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em]"><span>{progress}% complete</span><span>{visitedLessonIds.size}/{lessons.length}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Course completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="flex-1 py-2">
        {sections.map((section) => {
          const sectionLessons = lessons.filter((lesson) => lesson.sectionId === section.id);
          if (!sectionLessons.length) return null;
          return <section key={section.id}>
            <h2 className="flex items-center justify-between bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600"><span>{section.title}</span><ChevronDown size={13} /></h2>
            <ul className="divide-y divide-slate-100">{sectionLessons.map((lesson) => {
              const Icon = lessonIcons[lesson.icon ?? "file"];
              const active = selectedLesson?.id === lesson.id;
              const visited = visitedLessonIds.has(lesson.id);
              return <li key={lesson.id}><button type="button" onClick={() => selectLesson(lesson.id)} aria-current={active ? "page" : undefined} className={`flex min-h-20 w-full items-start gap-2.5 px-4 py-4 text-left ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                <Icon size={14} className="mt-0.5 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1"><span className={`block text-sm leading-5 ${active ? "font-semibold text-indigo-800" : "font-medium text-slate-800"}`}>{lesson.title}</span><span className="mt-1 block text-[11px] text-slate-500">{lesson.lessonType === "quiz" ? "Quiz" : "Lesson"}</span></span>
                {visited ? <Check size={15} className="mt-0.5 shrink-0 text-blue-700" /> : <Circle size={14} className="mt-0.5 shrink-0 text-slate-300" />}
              </button></li>;
            })}</ul>
          </section>;
        })}
      </div>
    </aside>;
  }

  const viewportClass = device === "desktop" ? "w-full" : device === "tablet" ? "w-full max-w-[900px] border-x border-slate-200 shadow-xl" : "w-full max-w-[390px] border-x border-slate-300 shadow-2xl";

  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900">
    <header className="z-50 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to course editor" title="Back to editor" onClick={() => router.push(`/courses/${initialData.courseId}/edit`)}><ArrowLeft size={18} /></Button>
        <div className="flex items-center gap-2"><span className="text-sm font-semibold">Course Preview</span><span className="hidden text-xs text-slate-500 sm:inline">Current version</span></div>
      </div>
      <div className="flex items-center rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Preview mode">
        <Button type="button" variant={mode === "course" ? "secondary" : "ghost"} size="sm" aria-pressed={mode === "course"} onClick={() => setMode("course")} className="h-8 px-2.5 text-xs sm:px-3">Preview course</Button>
        <Button type="button" variant={mode === "learn" ? "secondary" : "ghost"} size="sm" aria-pressed={mode === "learn"} onClick={startLearning} className="h-8 px-2.5 text-xs sm:px-3">Learn</Button>
      </div>
      <div className="ml-auto flex items-center gap-1" role="group" aria-label="Preview device size">
        {([{ id: "desktop", label: "Desktop", Icon: Monitor }, { id: "tablet", label: "Tablet", Icon: Tablet }, { id: "mobile", label: "Mobile", Icon: Smartphone }] as const).map(({ id, label, Icon }) => <Button key={id} type="button" variant={device === id ? "secondary" : "ghost"} size="icon" aria-label={`Preview on ${label.toLowerCase()}`} aria-pressed={device === id} title={label} onClick={() => { setDevice(id); setMobileMenuOpen(false); }} className="size-8"><Icon size={16} /></Button>)}
        <Button type="button" variant="default" size="sm" onClick={() => router.push(`/courses/${initialData.courseId}/edit`)} className="ml-1 h-8 px-3 text-xs">Edit</Button>
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-hidden">
      <div className={`mx-auto h-full overflow-hidden bg-white transition-[max-width] duration-200 ${viewportClass}`}>
        {mode === "course" ? <div className="h-full overflow-y-auto">
          <section className={`bg-gradient-to-br from-[#102e53] via-[#0b2444] to-[#06152d] px-5 text-center text-white sm:px-10 ${device === "mobile" ? "py-12" : "py-16 sm:py-24"}`}>
            <div className="mx-auto max-w-5xl">
              {initialData.authorVisible && <div className="mb-6 inline-flex items-center gap-2.5 text-sm font-medium text-white/90"><span className="grid size-9 place-items-center rounded-full bg-[#ff876c] text-xs font-semibold">{initials}</span><span>{authorName}</span></div>}
              <StatementTextPreview tag="h3" text={initialData.title} className={`mx-auto font-bold tracking-tight text-white ${device === "mobile" ? "text-3xl" : device === "tablet" ? "text-4xl" : "text-4xl sm:text-6xl"} [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold`} />
              {lessons.length > 0 && <Button type="button" variant="outline" onClick={startLearning} className="mt-8 min-w-36 rounded-full border-white bg-white text-slate-950 hover:bg-slate-100">Start learning</Button>}
            </div>
          </section>
          <div className={`mx-auto max-w-5xl px-5 ${device === "mobile" ? "py-8" : "py-12 sm:px-10 sm:py-16"}`}>
            {initialData.description.trim() && <section aria-label="Course description" className="mx-auto mb-14 max-w-3xl text-slate-700">
              <StatementTextPreview tag="p" text={initialData.description} html={initialData.descriptionHtml} className="text-base leading-8 [&_h1]:my-4 [&_h2]:my-3 [&_h3]:my-2 [&_p]:my-3" />
            </section>}
            <section aria-labelledby="preview-course-content" className="mx-auto max-w-4xl">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">Course outline</p><h2 id="preview-course-content" className="mt-1 text-2xl font-bold tracking-tight">What you’ll learn</h2></div><span className="text-sm text-slate-500">{lessons.length} content {lessons.length === 1 ? "item" : "items"}</span></div>
              {lessons.length ? <div className="space-y-8">{sections.map((section) => {
                const sectionLessons = lessons.filter((lesson) => lesson.sectionId === section.id);
                if (!sectionLessons.length) return null;
                return <section key={section.id}><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{section.title}</h3><div className="divide-y divide-slate-200 border-y border-slate-200">{sectionLessons.map((lesson) => {
                  const Icon = lessonIcons[lesson.icon ?? "file"];
                  return <button key={lesson.id} type="button" onClick={() => selectLesson(lesson.id)} className="flex min-h-16 w-full items-center gap-3 px-2 py-3 text-left hover:bg-slate-50"><Icon size={17} className="shrink-0 text-slate-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{lesson.title}</span><span className="mt-1 block text-xs text-slate-500">{lesson.lessonType === "quiz" ? "Quiz" : "Lesson"}</span></span><ArrowRight size={16} className="shrink-0 text-slate-400" /></button>;
                })}</div></section>;
              })}</div> : <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">Course content will appear here when it is added.</p>}
            </section>
          </div>
        </div> : <div className="course-learn-enter relative flex h-full min-h-0">
          {device !== "mobile" && renderLessonMenu()}
          {device === "mobile" && mobileMenuOpen && <div className="absolute inset-0 z-40 flex"><button type="button" aria-label="Close course menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/40" />{renderLessonMenu(true)}</div>}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
              {device === "mobile" && <Button type="button" variant="ghost" size="icon" aria-label="Open course menu" onClick={() => setMobileMenuOpen(true)} className="size-8"><Menu size={18} /></Button>}
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">{initialData.title}</span>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{selectedLesson ? `${lessonIndex + 1} / ${lessons.length}` : "Course content"}</span>
            </div>
            <div ref={lessonContentScrollRef} className="min-h-0 flex-1 overflow-hidden overscroll-none scroll-smooth">
              {lessons.length ? lessons.map((lesson, index) => <article
                key={lesson.id}
                id={`preview-content-${lesson.id}`}
                ref={(node) => {
                  if (node) lessonArticleRefs.current.set(lesson.id, node);
                  else lessonArticleRefs.current.delete(lesson.id);
                }}
                className={`mx-auto flex h-full w-full flex-col overflow-hidden ${device === "mobile" ? "max-w-[640px] px-5 pt-6" : device === "tablet" ? "max-w-[840px] px-8 pt-8" : "max-w-[1000px] px-6 pt-10 sm:px-12"}`}
              >
                <div
                  ref={(node) => {
                    if (node) lessonBodyScrollRefs.current.set(lesson.id, node);
                    else lessonBodyScrollRefs.current.delete(lesson.id);
                  }}
                  onScroll={(event) => markContentAboveComplete(lesson, event.currentTarget)}
                  className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
                >
                  <StatementTextPreview tag="h3" text={lesson.title} html={lesson.titleHtml} className={`font-bold tracking-tight text-slate-900 ${device === "mobile" ? "text-3xl" : "text-4xl"} [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold`} />
                  {initialData.authorVisible && <div className="mt-4 flex items-center gap-2.5 text-xs font-medium text-slate-500"><span className="grid size-8 place-items-center rounded-full bg-[#ff876c] text-[10px] font-semibold text-white">{initials}</span><span>{authorName}</span><span className="ml-2 border-l border-slate-200 pl-3 uppercase tracking-wide">Content {index + 1} / {lessons.length}</span></div>}
                  {lesson.lessonType === "quiz" ? lesson.quizQuestions.length ? <div className="mt-10 space-y-6">{lesson.quizQuestions.map((question, questionIndex) => <QuizQuestionPreview key={question.id} question={question} index={questionIndex} />)}</div> : <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">This quiz has no questions yet.</div> : lesson.blocks.length ? <LessonBlocksPreview blocks={lesson.blocks} device={device} animate={lesson.id === selectedLessonId} revealedDividerIds={revealedDividerIds} completedDividerIds={completedDividerIds} onReveal={(dividerId, nextBlockId) => {
                    setRevealedDividerIds((previous) => new Set(previous).add(dividerId));
                    if (nextBlockId) setPendingContinueScroll({ lessonId: lesson.id, blockId: nextBlockId });
                  }} /> : <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">This content has no lesson material yet.</div>}
                </div>
                <nav aria-label={`Content ${index + 1} navigation`} className="mt-auto flex w-full shrink-0 items-center justify-between gap-3 pb-5 pt-6">
                  <Button type="button" variant="ghost" disabled={index <= 0} onClick={() => lessons[index - 1] && selectLesson(lessons[index - 1].id)} className="px-2 text-slate-700 hover:bg-slate-100"><ArrowLeft size={15} />Previous</Button>
                  {(lesson.lessonType === "quiz" || lesson.blocks.every((block) => block.type !== "divider" || block.data.style !== "continue" || revealedDividerIds.has(block.id))) && <Button type="button" variant="ghost" disabled={index >= lessons.length - 1} onClick={() => lessons[index + 1] && selectLesson(lessons[index + 1].id)} className="px-2 text-slate-700 hover:bg-slate-100">Next<ArrowRight size={15} /></Button>}
                </nav>
              </article>) : <div className="grid min-h-full place-items-center px-6 py-12 text-center"><div className="max-w-sm"><BookOpen size={34} className="mx-auto text-indigo-600" /><h2 className="mt-4 text-xl font-semibold">Your course is ready to explore</h2><p className="mt-2 text-sm leading-6 text-slate-500">Choose a content item from the course menu to preview it.</p></div></div>}
            </div>
          </div>
        </div>}
      </div>
    </div>
  </main>;
}
