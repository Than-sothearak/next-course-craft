"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Check, ClipboardList, FileText, ImagePlus, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  courseGenerationModelOptions,
  defaultCourseGenerationModel,
  type CourseGenerationInput,
  type CourseGenerationModel,
  type LearnGroupingMode,
  type GeneratedCourseDraft,
  type SourceGenerationJobSnapshot,
} from "@/lib/ai/course-generation-schemas";

import { advanceSourceGenerationJobUntil, isMissingGenerationJob, postSourceGenerationAction, responseError } from "./(course_generation_dialog_components)/generation-job-request";
import { GenerationPromptInput, starterGenerationPrompt } from "./(course_generation_dialog_components)/generation-prompt-input";

import { GenerationWaitingPanel } from "./(course_generation_dialog_components)/generation-waiting-panel";

const maximumSourceBytes = 12 * 1024 * 1024;
type ApplyMode = "append" | "replace";
type StructurePreviewTemplate = CourseGenerationInput["template"];
function CourseStructurePreview({
  template,
  courseTitle,
  courseDescription,
  learningLessonCount,
  onClose,
}: {
  template: StructurePreviewTemplate;
  courseTitle: string;
  courseDescription: string;
  learningLessonCount: number;
  onClose: () => void;
}) {
  const isTemplate = template === "preLearnPost";
  const sections = isTemplate
    ? [
        { title: "Pre activities", lessons: [{ title: "Course description", type: "Lesson" }, { title: "Lesson overview", type: "Lesson" }, { title: "Keyword", type: "Interactive" }, { title: "Pre-test", type: "Quiz" }] },
        { title: "Learn", lessons: Array.from({ length: learningLessonCount }, (_, index) => ({ title: `Learning lesson ${index + 1}`, type: "Lesson" })) },
        { title: "Post activities", lessons: [{ title: "Post-test", type: "Quiz" }, { title: "Lesson summary", type: "Lesson" }, { title: "Next lesson", type: "Lesson" }] },
      ]
    : [
        { title: "Getting started", lessons: [{ title: "Welcome", type: "Lesson" }, { title: "Core concepts", type: "Lesson" }] },
        { title: "Practice", lessons: [{ title: "Try it out", type: "Lesson" }, { title: "Knowledge check", type: "Quiz" }] },
        { title: "Wrap up", lessons: [{ title: "Summary", type: "Lesson" }] },
      ];

  return (
    <section
      role="region"
      aria-label={`${isTemplate ? "Pre / Learn / Post" : "Custom structure"} learner preview`}
      className="transition-opacity duration-150"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Learner preview</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-800">
            {isTemplate ? "Pre / Learn / Post activities" : "Custom course structure"}
          </h3>
        </div>
        <button
          type="button"
          aria-label="Close course structure preview"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X size={15} />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        <div className="flex h-8 items-center justify-between border-b border-slate-200 bg-white px-2.5">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
            <BookOpen size={12} className="text-indigo-600" /> Course Preview
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500">Learn</span>
        </div>
        <div className="grid min-h-[330px] grid-cols-[minmax(94px,0.72fr)_minmax(0,1.45fr)]">
          <aside className="min-w-0 border-r border-slate-200 bg-white">
            <div className="bg-indigo-700 px-2.5 py-2 text-white">
              <p className="line-clamp-2 text-[9px] font-semibold leading-3.5">{courseTitle.trim() || "Your course title"}</p>
              <div className="mt-2 flex items-center justify-between text-[7px] font-medium text-indigo-100">
                <span>0% complete</span>
                <span>0/{sections.reduce((count, section) => count + section.lessons.length, 0)}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/25"><div className="h-full w-0 bg-white" /></div>
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {sections.map((section, sectionIndex) => (
                <div key={section.title}>
                  <div className="bg-slate-50 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-slate-500">{section.title}</div>
                  {section.lessons.map((lesson, lessonIndex) => {
                    const active = sectionIndex === 0 && lessonIndex === 0;
                    const LessonIcon = lesson.type === "Quiz" ? ClipboardList : BookOpen;
                    return (
                      <div
                        key={lesson.title}
                        className={`flex min-h-7 items-center gap-1 px-2 py-1 ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600"}`}
                      >
                        <LessonIcon size={9} className="shrink-0" />
                        <span className={`min-w-0 flex-1 truncate text-[8px] ${active ? "font-semibold" : "font-medium"}`}>{lesson.title}</span>
                        {active && <Check size={9} className="shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          <main className="min-w-0 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-wide text-slate-400">
              <span>{sections[0].title}</span><span>·</span><span>Lesson 1 of {sections[0].lessons.length}</span>
            </div>
            <h4 className="mt-1.5 text-[13px] font-bold leading-4 text-slate-900">
              {isTemplate ? "Course description" : "Welcome"}
            </h4>
            <p className="mt-1.5 text-[8px] leading-3.5 text-slate-500">
              {isTemplate
                ? courseDescription.trim() || "A short introduction to the course and what learners will explore."
                : "Introduce the topic, explain why it matters, and show learners what they will be able to do."}
            </p>
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <p className="text-[9px] font-semibold text-slate-800">{isTemplate ? "What you’ll learn" : "Key idea"}</p>
              {isTemplate ? (
                <ul className="mt-1.5 space-y-1 text-[8px] leading-3 text-slate-600">
                  <li className="flex gap-1.5"><span className="text-indigo-500">•</span><span>Lesson overview with bold titles and text descriptions</span></li>
                  <li className="flex gap-1.5"><span className="text-indigo-500">•</span><span>Interactive keyword cards and quizzes</span></li>
                  <li className="flex gap-1.5"><span className="text-indigo-500">•</span><span>Learning lessons followed by a summary</span></li>
                </ul>
              ) : (
                <div className="mt-1.5 rounded-md bg-indigo-50 px-2 py-2 text-[8px] leading-3 text-indigo-800">
                  Generated lessons can mix explanations, interactive checks, steps, cards, and images.
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
              <span className="text-[7px] text-slate-400">
                {isTemplate
                  ? `1 of ${sections.reduce((count, section) => count + section.lessons.length, 0)} lessons`
                  : "1 of 5 example lessons"}
              </span>
              <span className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[8px] font-semibold text-white">
                Continue <ArrowRight size={9} />
              </span>
            </div>
          </main>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        Example learner view styled after the course preview page. Hover or focus another structure to compare.
      </p>
    </section>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

type GenerationProgressStatus = "complete" | "active" | "upcoming";
export type CourseGenerationProgressStage = {
  step: 1 | 2;
  title: string;
  status: GenerationProgressStatus;
  completed: number;
  total: number | null;
  detail: string;
};

export function getPromptCourseGenerationProgressStages(): [CourseGenerationProgressStage, CourseGenerationProgressStage] {
  return [
    { step: 1, title: "Prepare prompt", status: "complete", completed: 1, total: 1, detail: "Your prompt and generation settings are ready" },
    { step: 2, title: "Generate course", status: "active", completed: 0, total: null, detail: "Creating sections, lessons, and interactive blocks from your prompt" },
  ];
}

export function getCourseGenerationProgressStages(
  progress: Pick<SourceGenerationJobSnapshot, "status" | "sourcePageCount" | "completedWorkUnits" | "totalWorkUnits" | "learnProgress">,
): [CourseGenerationProgressStage, CourseGenerationProgressStage] {
  const sourceIsComplete = [
    "awaitingPrompt",
    "planning",
    "generatingPreActivities",
    "generatingLearn",
    "generatingPostActivities",
    "assembling",
    "completed",
  ].includes(progress.status);
  const courseHasStarted = [
    "planning",
    "generatingPreActivities",
    "generatingLearn",
    "generatingPostActivities",
    "assembling",
    "completed",
  ].includes(progress.status);
  const courseIsComplete = progress.status === "completed";
  const sourceTotal = progress.sourcePageCount === null
    ? progress.totalWorkUnits > 0 ? progress.totalWorkUnits : null
    : Math.ceil(progress.sourcePageCount / 5) + 1;
  const sourceCompleted = sourceTotal === null
    ? 0
    : sourceIsComplete
      ? sourceTotal
      : Math.min(sourceTotal, Math.max(0, progress.completedWorkUnits));
  const courseTotal = courseHasStarted && sourceTotal !== null && progress.totalWorkUnits > sourceTotal
    ? progress.totalWorkUnits - sourceTotal
    : null;
  const courseCompleted = courseIsComplete && courseTotal !== null
    ? courseTotal
    : courseTotal === null
      ? 0
      : Math.min(courseTotal, Math.max(0, progress.completedWorkUnits - (sourceTotal ?? 0)));

  const courseDetail = {
    planning: "Choosing lesson groups and titles",
    generatingPreActivities: "Creating Pre Activities",
    generatingLearn: progress.learnProgress
      ? `Writing the current lesson in smaller parts (${progress.learnProgress.completedParts}/${progress.learnProgress.totalParts} saved)`
      : "Writing Learn lessons",
    generatingPostActivities: "Creating Post Activities",
    assembling: "Building editable CourseCraft blocks",
    completed: "Your course draft is ready",
  }[progress.status] ?? "Starts after the source is prepared";
  const sourceDetail = sourceIsComplete
    ? `${progress.sourcePageCount ?? "All"} source pages are ready for course generation`
    : progress.status === "indexing"
      ? "Opening the file and indexing its pages"
      : "Reading source pages in groups of five";

  return [
    {
      step: 1,
      title: "Prepare source",
      status: sourceIsComplete ? "complete" : "active",
      completed: sourceCompleted,
      total: sourceTotal,
      detail: sourceDetail,
    },
    {
      step: 2,
      title: "Generate course",
      status: courseIsComplete ? "complete" : courseHasStarted ? "active" : "upcoming",
      completed: courseCompleted,
      total: courseTotal,
      detail: courseDetail,
    },
  ];
}

export function CourseGenerationDialog({
  open,
  onClose,
  courseId,
  courseTitle,
  courseDescription,
  existingLessonCount,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  existingLessonCount: number;
  onApply: (course: GeneratedCourseDraft, mode: ApplyMode) => void;
}) {
  const [prompt, setPrompt] = useState(starterGenerationPrompt);
  const [template, setTemplate] = useState<CourseGenerationInput["template"]>("preLearnPost");
  const [previewTemplate, setPreviewTemplate] = useState<StructurePreviewTemplate | null>(null);
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [lessonCount, setLessonCount] = useState("2");
  const [learnGroupingMode, setLearnGroupingMode] = useState<LearnGroupingMode>("smart");
  const [slidesPerContent, setSlidesPerContent] = useState("5");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [contentDepth, setContentDepth] = useState<CourseGenerationInput["contentDepth"]>("detailed");
  const [interactivity, setInteractivity] = useState<CourseGenerationInput["interactivity"]>("high");
  const [postTestCount, setPostTestCount] = useState("5");
  const [selectedModel, setSelectedModel] = useState<CourseGenerationModel>(defaultCourseGenerationModel);
  const [includeImages, setIncludeImages] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [sourceJobProgress, setSourceJobProgress] = useState<Pick<SourceGenerationJobSnapshot, "status" | "sourcePageCount" | "completedWorkUnits" | "totalWorkUnits" | "learnProgress"> | null>(null);
  const [result, setResult] = useState<GeneratedCourseDraft | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyMode>("append");
  const [generating, setGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [generationKind, setGenerationKind] = useState<"prompt" | "source">("prompt");
  const [loadingSavedDraft, setLoadingSavedDraft] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [generationInfo, setGenerationInfo] = useState<{ model: CourseGenerationModel; elapsedSeconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const structurePreviewTimerRef = useRef<number | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  function showStructurePreview(value: StructurePreviewTemplate) {
    if (structurePreviewTimerRef.current !== null) {
      window.clearTimeout(structurePreviewTimerRef.current);
      structurePreviewTimerRef.current = null;
    }
    setPreviewTemplate(value);
  }

  function scheduleStructurePreviewClose() {
    if (structurePreviewTimerRef.current !== null) window.clearTimeout(structurePreviewTimerRef.current);
    structurePreviewTimerRef.current = window.setTimeout(() => {
      setPreviewTemplate(null);
      structurePreviewTimerRef.current = null;
    }, 800);
  }

  useEffect(() => () => {
    if (structurePreviewTimerRef.current !== null) window.clearTimeout(structurePreviewTimerRef.current);
    generationControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!generating || generationStartedAt === null) return;
    const timer = window.setInterval(() => {
      setGenerationElapsedSeconds(Math.floor((Date.now() - generationStartedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [generating, generationStartedAt]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const savedJobId = window.localStorage.getItem(`course-generation:${courseId}`);
      activeJobIdRef.current = savedJobId;
      setGenerationJobId(savedJobId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, courseId]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !generating && !cancelling) {
        setResult(null);
        setError(null);
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    promptRef.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, generating, cancelling, onClose]);

  if (!open) return null;

  function clearGenerationJob(jobId: string) {
    if (window.localStorage.getItem(`course-generation:${courseId}`) === jobId) window.localStorage.removeItem(`course-generation:${courseId}`);
    if (activeJobIdRef.current === jobId) activeJobIdRef.current = null;
    setGenerationJobId((current) => current === jobId ? null : current);
    setSourceJobProgress(null);
  }

  async function cancelGeneration() {
    if (cancelling) return;
    const jobId = activeJobIdRef.current ?? generationJobId;
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setGenerating(false);
    setGenerationStartedAt(null);
    setGenerationInfo(null);
    setCancelling(true);
    setError(null);
    try {
      const job = jobId ? await postSourceGenerationAction(courseId, "cancelGeneration", jobId) : null;
      if (jobId) clearGenerationJob(jobId);
      if (job?.status === "completed" && job.course) {
        setResult(job.course);
        setGenerationNotice("This job had already completed. Its draft is ready to review.");
      } else {
        setGenerationNotice("Generation cancelled. You can start a new run. An AI request already sent may finish.");
      }
    } catch (cancelError) {
      if (isMissingGenerationJob(cancelError)) {
        if (jobId) clearGenerationJob(jobId);
        setGenerationNotice("The saved job is no longer available. Its reference was cleared; you can start a new run.");
      } else {
        setError(cancelError instanceof Error ? cancelError.message : "Could not cancel the saved job. Try Cancel job again.");
      }
    } finally {
      setCancelling(false);
    }
  }

  function buildGenerationFormData(action: "analyzeSource" | "generate", sourceFile?: File) {
    const formData = new FormData();
    formData.set("action", action);
    formData.set("prompt", prompt);
    formData.set("audience", audience);
    formData.set("level", level);
    formData.set("lessonCount", lessonCount);
    formData.set("template", template);
    if (template === "preLearnPost" && (sourceFile || file || generationJobId)) {
      formData.set("learnGroupingMode", learnGroupingMode);
      formData.set("slidesPerContent", slidesPerContent || "5");
    }
    formData.set("targetLanguage", targetLanguage);
    formData.set("contentDepth", contentDepth);
    formData.set("interactivity", interactivity);
    if (template === "preLearnPost") formData.set("postTestCount", postTestCount || "5");
    formData.set("includeImages", String(includeImages));
    formData.set("courseTitle", courseTitle);
    formData.set("courseDescription", courseDescription);
    formData.set("model", selectedModel);
    if (sourceFile) formData.set("file", sourceFile);
    return formData;
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating || cancelling) return;
    setError(null);
    setGenerationNotice(null);
    if (!prompt.trim() && !file && !generationJobId) {
      setError("Write a course prompt or attach a PDF or PowerPoint file.");
      return;
    }
    if (file && file.size > maximumSourceBytes) {
      setError("Source files must be 12 MB or smaller.");
      return;
    }
    const startedAt = Date.now();
    const model = selectedModel;
    const controller = new AbortController();
    const signal = controller.signal;
    generationControllerRef.current = controller;
    activeJobIdRef.current = generationJobId;
    let completed = false;
    setGenerating(true);
    setGenerationKind(file || generationJobId ? "source" : "prompt");
    setSourceJobProgress(null);
    setGenerationStartedAt(startedAt);
    setGenerationElapsedSeconds(0);
    setGenerationInfo(null);
    setResult(null);
    try {
      let jobId = generationJobId;
      let sourceIsIndexed = false;
      if (file && !jobId) {
        const response = await fetch(`/api/courses/${courseId}/generate`, {
          method: "POST",
          body: buildGenerationFormData("generate", file),
          signal,
        });
        if (!response.ok) throw new Error(await responseError(response));
        const created = await response.json() as SourceGenerationJobSnapshot;
        if (signal.aborted && created.jobId) {
          void postSourceGenerationAction(courseId, "cancelGeneration", created.jobId).catch(() => undefined);
        }
        signal.throwIfAborted();
        jobId = created.jobId;
        activeJobIdRef.current = jobId;
        setGenerationJobId(jobId);
        window.localStorage.setItem(`course-generation:${courseId}`, jobId);
        setSourceJobProgress(created);
        await advanceSourceGenerationJobUntil(courseId, jobId, ["awaitingPrompt"], (progress) => {
          setSourceJobProgress(progress);
        }, signal);
        sourceIsIndexed = true;
      }
      if (jobId) {
        let current = sourceIsIndexed
          ? null
          : await postSourceGenerationAction(courseId, "getGeneration", jobId, undefined, signal);
        if (current) setSourceJobProgress(current);
        if (current?.status === "completed") {
          if (!current.course) throw new Error("Generation completed without a saved course draft.");
          setResult(current.course);
          completed = true;
          clearGenerationJob(jobId);
          return;
        }
        if (current?.status === "failed") {
          current = await postSourceGenerationAction(courseId, "advanceGeneration", jobId, undefined, signal);
          setSourceJobProgress(current);
        }
        if (current?.status === "indexing" || current?.status === "extracting") {
          current = await advanceSourceGenerationJobUntil(courseId, jobId, ["awaitingPrompt"], (progress) => {
            setSourceJobProgress(progress);
          }, signal);
        }
        if (current?.status === "cancelled" || current?.status === "failed")
          throw new Error(current.errorMessage || "Course generation stopped. Retry this stage to continue.");
        const configured = await postSourceGenerationAction(
          courseId,
          "generate",
          jobId,
          buildGenerationFormData("generate"),
          signal,
        );
        setSourceJobProgress(configured);
        const completedJob = configured.status === "completed"
          ? configured
          : await advanceSourceGenerationJobUntil(
              courseId,
              jobId,
              ["completed"],
              (progress) => setSourceJobProgress(progress),
              signal,
            );
        if (!completedJob.course) throw new Error("Generation completed without a saved course draft.");
        setResult(completedJob.course);
        clearGenerationJob(jobId);
      } else {
        const formData = buildGenerationFormData("generate", file ?? undefined);
        const response = await fetch(`/api/courses/${courseId}/generate`, {
          method: "POST",
          body: formData,
          signal,
        });
        if (!response.ok) throw new Error(await responseError(response));
        const generated = await response.json() as GeneratedCourseDraft;
        signal.throwIfAborted();
        setResult(generated);
      }
      completed = true;
    } catch (requestError) {
      if (signal.aborted) return;
      if (isMissingGenerationJob(requestError)) {
        const missingId = activeJobIdRef.current;
        if (missingId) clearGenerationJob(missingId);
        setError(file
          ? "The saved generation job expired or was removed. Click Generate draft to restart with the selected file."
          : "The saved generation job expired or was removed. Upload the source again, or use your prompt to start a new run.");
      } else {
        setError(requestError instanceof Error ? requestError.message : "Course generation failed. Please try again.");
      }
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000);
        setGenerationElapsedSeconds(elapsedSeconds);
        setGenerationStartedAt(null);
        if (completed) setGenerationInfo({ model, elapsedSeconds });
        setGenerating(false);
      }
    }
  }

  async function loadLastCompletedDraft() {
    setError(null);
    setLoadingSavedDraft(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/generate`);
      if (!response.ok) throw new Error(await responseError(response));
      const job = await response.json() as SourceGenerationJobSnapshot | null;
      if (!job?.course) throw new Error("No completed draft is available for this course. Source drafts are kept for 24 hours.");
      setResult(job.course);
      setSourceJobProgress(job);
      setGenerationInfo(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The saved draft could not be loaded.");
    } finally {
      setLoadingSavedDraft(false);
    }
  }

  const canApply = Boolean(result);
  const generationStages = sourceJobProgress
    ? getCourseGenerationProgressStages(sourceJobProgress)
    : generationKind === "prompt"
      ? getPromptCourseGenerationProgressStages()
      : getCourseGenerationProgressStages({ status: "indexing", sourcePageCount: null, completedWorkUnits: 0, totalWorkUnits: 0 });
  function closeDialog() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="dialog-backdrop-in fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !generating && !cancelling) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-generation-title"
        className="dialog-panel-in flex max-h-[min(900px,calc(100dvh-24px))] w-full max-w-4xl flex-col overflow-clip rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(900px,calc(100dvh-48px))]"
      >
        <header className="flex shrink-0 flex-col items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:gap-4 sm:px-6">
          <div>
            <h2 id="course-generation-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Sparkles size={18} className="text-indigo-600" /> Generate course with AI
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Turn a prompt, course outline, PDF, or PowerPoint into editable lessons and blocks.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            {(generating || generationJobId || cancelling) && <Button type="button" variant="outline" size="sm" disabled={cancelling} onClick={() => void cancelGeneration()}>{cancelling ? "Cancelling…" : generationKind === "source" || generationJobId ? "Cancel job" : "Cancel generation"}</Button>}
            <Button type="button" variant="ghost" size="icon" aria-label="Close course generation" disabled={generating || cancelling} onClick={closeDialog}>
              <X size={18} />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:overflow-clip">
          <form onSubmit={generate} className="space-y-4 border-b border-slate-100 p-5 sm:p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <GenerationPromptInput value={prompt} onChange={setPrompt} inputRef={promptRef} disabled={generating || cancelling} />

            <label className="block text-sm font-medium text-slate-700">
              Source slides (optional)
              <span className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm font-normal text-slate-600 hover:border-indigo-300">
                <Upload size={16} className="shrink-0 text-indigo-600" />
                <span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose PDF or PowerPoint"}</span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  aria-label="Upload PDF or PowerPoint source"
                  className="sr-only"
                  disabled={generating || cancelling}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    if (generationJobId) {
                      void postSourceGenerationAction(courseId, "cancelGeneration", generationJobId).catch(() => undefined);
                      window.localStorage.removeItem(`course-generation:${courseId}`);
                    }
                    setGenerationJobId(null);
                    activeJobIdRef.current = null;
                    setSourceJobProgress(null);
                    setFile(selected);
                    setResult(null);
                    setGenerationInfo(null);
                    setError(null);
                    if (!selected) return;
                    if (selected.size > maximumSourceBytes) {
                      setError("Source files must be 12 MB or smaller.");
                      return;
                    }
                  }}
                />
              </span>
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                PDF or PPTX up to 12 MB. The file is processed when you generate the course. Convert legacy PPT files to PDF or PPTX first.
              </span>
            </label>
            {file && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={generating || cancelling}
                onClick={() => {
                  setFile(null);
                  if (generationJobId) {
                    void postSourceGenerationAction(courseId, "cancelGeneration", generationJobId).catch(() => undefined);
                    window.localStorage.removeItem(`course-generation:${courseId}`);
                  }
                  setGenerationJobId(null);
                  activeJobIdRef.current = null;
                  setSourceJobProgress(null);
                  setResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="-mt-3 px-1 text-xs text-slate-500"
              >
                Remove source file
              </Button>
            )}

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Course structure</legend>
              <div className="mt-1.5 space-y-2" role="radiogroup" aria-describedby="course-structure-preview-hint">
                <label
                  onMouseEnter={() => showStructurePreview("preLearnPost")}
                  onMouseLeave={scheduleStructurePreviewClose}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${template === "preLearnPost" ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"}`}
                >
                  <input
                    type="radio"
                    name="course-structure"
                    value="preLearnPost"
                    checked={template === "preLearnPost"}
                    onChange={() => setTemplate("preLearnPost")}
                    onFocus={() => showStructurePreview("preLearnPost")}
                    onBlur={scheduleStructurePreviewClose}
                    className="mt-0.5 size-4 shrink-0 accent-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-800">
                      Pre / Learn / Post activities
                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">Template</span>
                    </span>
                    <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">
                      Description, overview, interactive keywords, quizzes, learning lessons, summary, and next lesson.
                    </span>
                  </span>
                </label>
                <label
                  onMouseEnter={() => showStructurePreview("custom")}
                  onMouseLeave={scheduleStructurePreviewClose}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${template === "custom" ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"}`}
                >
                  <input
                    type="radio"
                    name="course-structure"
                    value="custom"
                    checked={template === "custom"}
                    onChange={() => setTemplate("custom")}
                    onFocus={() => showStructurePreview("custom")}
                    onBlur={scheduleStructurePreviewClose}
                    className="mt-0.5 size-4 shrink-0 accent-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-800">Custom course structure</span>
                    <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">
                      Let AI organize sections and lessons around your prompt or source material.
                    </span>
                  </span>
                </label>
              </div>
              <p id="course-structure-preview-hint" className="mt-1 text-[10px] leading-4 text-slate-400">
                Hover or focus a structure to preview its learner view.
              </p>
            </fieldset>

            <label className="block text-sm font-medium text-slate-700">
              OpenAI model
              <Select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value as CourseGenerationModel)}
                disabled={generating || cancelling}
                className="mt-1.5"
              >
                {courseGenerationModelOptions.map((modelOption) => (
                  <option key={modelOption.value} value={modelOption.value}>
                    {modelOption.label} · {modelOption.description}
                  </option>
                ))}
              </Select>
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                Choose the model for course writing. Generated images use the configured image model.
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Learner audience (optional)
              <Input value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={300} placeholder="For example, new customer support hires" className="mt-1.5" />
            </label>

            <div className={`grid gap-3 ${template === "preLearnPost" && file ? "grid-cols-1" : "grid-cols-2"}`}>
              <label className="block text-sm font-medium text-slate-700">
                Level
                <Select value={level} onChange={(event) => setLevel(event.target.value as typeof level)} className="mt-1.5">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </label>
              {!(template === "preLearnPost" && file) && (
                <label className="block text-sm font-medium text-slate-700">
                  {template === "preLearnPost" ? "Learning lessons" : "Lessons"}
                  <Select value={lessonCount} onChange={(event) => setLessonCount(event.target.value)} className="mt-1.5">
                    {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? "lesson" : "lessons"}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Target language
                <Select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  className="mt-1.5"
                >
                  <option value="English">English</option>
                  <option value="Khmer">Khmer</option>
                </Select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Explanation depth
                <Select value={contentDepth} onChange={(event) => setContentDepth(event.target.value as typeof contentDepth)} className="mt-1.5">
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                  <option value="veryDetailed">Very detailed</option>
                </Select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Interactivity
                <Select value={interactivity} onChange={(event) => setInteractivity(event.target.value as typeof interactivity)} className="mt-1.5">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </label>
              {template === "preLearnPost" && (
                <label className="block text-sm font-medium text-slate-700">
                  Post-test questions
                  <Input type="number" min={1} max={20} value={postTestCount} onChange={(event) => setPostTestCount(event.target.value)} className="mt-1.5" />
                </label>
              )}
            </div>
            {template === "preLearnPost" && file && (
              <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-sm font-medium text-slate-700">Learn content grouping</legend>
                <div role="radiogroup" aria-label="Learn content grouping mode" className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="learn-grouping-mode"
                      value="smart"
                      checked={learnGroupingMode === "smart"}
                      onChange={() => setLearnGroupingMode("smart")}
                      className="mt-0.5 size-4 accent-indigo-600"
                    />
                    <span>
                      <span className="font-medium">Smart Mode</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Organize around topic boundaries, usually about five slides per content item.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="learn-grouping-mode"
                      value="fixed"
                      checked={learnGroupingMode === "fixed"}
                      onChange={() => setLearnGroupingMode("fixed")}
                      className="mt-0.5 size-4 accent-indigo-600"
                    />
                    <span className="font-medium">Fixed Mode</span>
                  </label>
                </div>
                {learnGroupingMode === "fixed" && (
                  <label className="block text-sm font-medium text-slate-700">
                    Slides per Learn content item
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={slidesPerContent}
                      onChange={(event) => setSlidesPerContent(event.target.value)}
                      className="mt-1.5 max-w-28"
                    />
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">The final item can contain fewer slides when the source does not divide evenly.</span>
                  </label>
                )}
              </fieldset>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} className="mt-0.5 size-4 accent-indigo-600" />
              <span>
                <span className="flex items-center gap-1.5 font-medium"><ImagePlus size={15} className="text-indigo-600" /> Generate up to 8 images automatically</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">AI adds an image block when a visual helps and saves generated images to this course’s private media storage.</span>
              </span>
            </label>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {generationNotice && <p role="status" className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{generationNotice}</p>}
            {generationJobId && !generating && !cancelling && <p className="text-xs leading-5 text-slate-500">A saved generation is available. Generate draft resumes it; Cancel job starts fresh.</p>}

            <Button type="submit" disabled={generating || loadingSavedDraft || cancelling} className="w-full justify-center">
              {generating ? <><Sparkles size={16} aria-hidden="true" /> Building course draft…</> : <><Sparkles size={16} /> Generate draft</>}
            </Button>
            <Button type="button" variant="outline" disabled={generating || loadingSavedDraft || cancelling} onClick={() => void loadLastCompletedDraft()} className="w-full justify-center">
              {loadingSavedDraft ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
              {loadingSavedDraft ? "Loading saved draft…" : "Load last completed draft"}
            </Button>
          </form>

          <aside
            className="min-h-64 p-5 sm:p-6 lg:overflow-y-auto"
            onMouseEnter={() => {
              if (structurePreviewTimerRef.current !== null) {
                window.clearTimeout(structurePreviewTimerRef.current);
                structurePreviewTimerRef.current = null;
              }
            }}
            onMouseLeave={scheduleStructurePreviewClose}
          >
            {generating ? (
              <GenerationWaitingPanel
                stages={generationStages}
                kind={generationKind}
                elapsedSeconds={generationElapsedSeconds}
                modelLabel={courseGenerationModelOptions.find((option) => option.value === selectedModel)?.label ?? selectedModel}
              />
            ) : file && !result ? (
              <section aria-label="Source file ready" className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100"><FileText size={18} /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Source file ready</p>
                    <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">{file.name}</h3>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-600">
                  Choose <span className="font-semibold text-slate-800">Generate draft</span> to build the course directly from this file. You can add a prompt to guide the result.
                </p>
              </section>
            ) : !result ? (
              previewTemplate ? (
                <CourseStructurePreview
                  template={previewTemplate}
                  courseTitle={courseTitle}
                  courseDescription={courseDescription}
                  learningLessonCount={file ? 2 : Number(lessonCount)}
                  onClose={() => {
                    if (structurePreviewTimerRef.current !== null) window.clearTimeout(structurePreviewTimerRef.current);
                    structurePreviewTimerRef.current = null;
                    setPreviewTemplate(null);
                  }}
                />
              ) : (
                <div className="grid h-full min-h-52 content-center justify-items-center text-center">
                  <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><BookOpen size={22} /></span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-800">Your draft outline will appear here</h3>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">The generated lessons use the course blocks already available in the editor.</p>
                </div>
              )
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileText size={17} /></span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Draft ready</p>
                    <h3 className="mt-0.5 text-base font-semibold text-slate-900">{result.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{result.description}</p>
                  </div>
                </div>
                {generationInfo && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Generated with {courseGenerationModelOptions.find((option) => option.value === generationInfo.model)?.label ?? generationInfo.model}
                    {" · "}Finished in {formatDuration(generationInfo.elapsedSeconds)}
                  </p>
                )}
                {result.sourceCoverage && (
                  <div
                    role="status"
                    className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${result.sourceCoverage.complete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {result.sourceCoverage.complete
                      ? `Source coverage checks passed for all ${result.sourceCoverage.items.length} indexed elements.`
                      : `${result.sourceCoverage.items.filter((item) => item.preservationStatus === "preserved").length} of ${result.sourceCoverage.items.length} indexed source elements passed coverage checks. Review partial and unresolved items before publishing.`}
                  </div>
                )}
                <div className="mt-5 space-y-4">
                  {result.sections.map((section) => (
                    <section key={section.id} className="rounded-xl border border-slate-200 p-3.5">
                      <h4 className="text-sm font-semibold text-slate-800">{section.title}</h4>
                      <ol className="mt-2 space-y-2">
                        {result.lessons.filter((lesson) => lesson.sectionId === section.id).map((lesson) => (
                          <li key={lesson.id} className="flex items-start justify-between gap-3 text-xs leading-5 text-slate-700">
                            <span>{lesson.title}</span>
                            <span className="shrink-0 text-slate-400">
                              {lesson.lessonType === "quiz" ? `${lesson.quizQuestions.length} questions` : `${lesson.blocks.length} blocks`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
                {result.template === "preLearnPost" && (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Includes {result.learningLessonCount} learning lessons, four pre-activity lessons, and three post-activity lessons.
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  {result.lessons.length} lessons · {result.lessons.reduce((count, lesson) => count + lesson.blocks.length, 0)} blocks
                  {result.lessons.some((lesson) => lesson.lessonType === "quiz")
                    ? ` · ${result.lessons.reduce((count, lesson) => count + lesson.quizQuestions.length, 0)} quiz questions`
                    : ""}
                  {result.generatedImageCount > 0 ? ` · ${result.generatedImageCount} images saved` : ""}
                </p>

                {existingLessonCount > 0 && (
                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Add this draft to your course
                    <Select value={applyMode} onChange={(event) => setApplyMode(event.target.value as ApplyMode)} className="mt-1.5">
                      <option value="append">Add as new sections, keep existing lessons</option>
                      <option value="replace">Replace existing course content</option>
                    </Select>
                  </label>
                )}
                {applyMode === "replace" && existingLessonCount > 0 && (
                  <p className="mt-2 text-xs leading-5 text-amber-700">Replacing removes the current sections and lessons. You can undo the change in the editor.</p>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (!result) return;
                    onApply(result, existingLessonCount > 0 ? applyMode : "replace");
                    setResult(null);
                    setError(null);
                  }}
                  disabled={!canApply || generating || loadingSavedDraft || cancelling}
                  className="mt-4 w-full justify-center"
                >
                  {applyMode === "replace" && existingLessonCount > 0 ? "Replace and save course" : existingLessonCount > 0 ? "Add lessons and save" : "Use generated course and save"}
                </Button>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
