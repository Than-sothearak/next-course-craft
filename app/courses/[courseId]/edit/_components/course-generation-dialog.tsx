"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Check, ClipboardList, FileText, ImagePlus, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  courseGenerationModelOptions,
  defaultCourseGenerationModel,
  type CourseGenerationInput,
  type CourseGenerationModel,
  type GeneratedCourseDraft,
} from "@/lib/ai/course-generation-schemas";

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
                  <li className="flex gap-1.5"><span className="text-indigo-500">•</span><span>Lesson overview as a clear list</span></li>
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

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Use a stable message if the server did not return JSON.
  }
  return "Course generation failed. Please try again.";
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
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState<CourseGenerationInput["template"]>("preLearnPost");
  const [previewTemplate, setPreviewTemplate] = useState<StructurePreviewTemplate | null>(null);
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [lessonCount, setLessonCount] = useState("2");
  const [selectedModel, setSelectedModel] = useState<CourseGenerationModel>(defaultCourseGenerationModel);
  const [includeImages, setIncludeImages] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GeneratedCourseDraft | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyMode>("append");
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [generationInfo, setGenerationInfo] = useState<{ model: CourseGenerationModel; elapsedSeconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const structurePreviewTimerRef = useRef<number | null>(null);

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
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !generating) {
        setResult(null);
        setError(null);
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    promptRef.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, generating, onClose]);

  if (!open) return null;

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!prompt.trim() && !file) {
      setError("Write a course prompt or attach a PDF or PowerPoint file.");
      return;
    }
    if (file && file.size > maximumSourceBytes) {
      setError("Source files must be 12 MB or smaller.");
      return;
    }
    const startedAt = Date.now();
    const model = selectedModel;
    let completed = false;
    setGenerating(true);
    setGenerationStartedAt(startedAt);
    setGenerationElapsedSeconds(0);
    setGenerationInfo(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("prompt", prompt);
      formData.set("audience", audience);
      formData.set("level", level);
      formData.set("lessonCount", lessonCount);
      formData.set("template", template);
      formData.set("includeImages", String(includeImages));
      formData.set("courseTitle", courseTitle);
      formData.set("courseDescription", courseDescription);
      formData.set("model", model);
      if (file) formData.set("file", file);
      const response = await fetch(`/api/courses/${courseId}/generate`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(await responseError(response));
      setResult((await response.json()) as GeneratedCourseDraft);
      completed = true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Course generation failed. Please try again.");
    } finally {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000);
      setGenerationElapsedSeconds(elapsedSeconds);
      setGenerationStartedAt(null);
      if (completed) setGenerationInfo({ model, elapsedSeconds });
      setGenerating(false);
    }
  }

  const canApply = Boolean(result);
  function closeDialog() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="dialog-backdrop-in fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !generating) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-generation-title"
        className="dialog-panel-in flex max-h-[min(900px,calc(100dvh-24px))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(900px,calc(100dvh-48px))]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="course-generation-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Sparkles size={18} className="text-indigo-600" /> Generate course with AI
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Turn a prompt, course outline, PDF, or PowerPoint into editable lessons and blocks.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close course generation" disabled={generating} onClick={closeDialog}>
            <X size={18} />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:overflow-hidden">
          <form onSubmit={generate} className="space-y-4 border-b border-slate-100 p-5 sm:p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <label className="block text-sm font-medium text-slate-700">
              What should this course teach?
              <Textarea
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={5_000}
                placeholder="Describe the subject, key skills, or paste a lesson outline. You can leave this blank when uploading a source file."
                className="mt-1.5 min-h-32 resize-y"
              />
            </label>

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
                disabled={generating}
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
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setError(null);
                  }}
                />
              </span>
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                PDF, PPT, or PPTX up to 12 MB. PowerPoint files are read as text; export to PDF when slide diagrams matter.
              </span>
            </label>
            {file && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="-mt-3 px-1 text-xs text-slate-500"
              >
                Remove source file
              </Button>
            )}

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
                    <option value="2">2 lessons</option>
                    <option value="5">5 lessons</option>
                    <option value="8">8 lessons</option>
                    <option value="12">12 lessons</option>
                    <option value="20">20 lessons</option>
                  </Select>
                </label>
              )}
            </div>
            {template === "preLearnPost" && (
              <p className="-mt-2 text-xs leading-5 text-slate-500">
                Each Learn lesson covers 10 consecutive slides. A 20-slide file creates 2 Learn lessons; any remaining slides form a final shorter lesson.
              </p>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} className="mt-0.5 size-4 accent-indigo-600" />
              <span>
                <span className="flex items-center gap-1.5 font-medium"><ImagePlus size={15} className="text-indigo-600" /> Generate up to 3 images automatically</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">AI adds an image block when a visual helps and saves generated images to this course’s private media storage.</span>
              </span>
            </label>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            <Button type="submit" disabled={generating} className="w-full justify-center">
              {generating ? <><LoaderCircle size={16} className="animate-spin" /> Building course draft…</> : <><Sparkles size={16} /> Generate draft</>}
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
              <div className="grid h-full min-h-72 content-center justify-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 py-8 text-center">
                <div className="relative mb-5 grid size-28 place-items-center" aria-hidden="true">
                  <span className="absolute inset-1 rounded-full border border-indigo-200/70" />
                  <span className="absolute inset-1 rounded-full border-2 border-transparent border-t-indigo-500 motion-safe:animate-spin" />
                  <span className="absolute inset-3 rounded-full border border-dashed border-violet-300 motion-safe:animate-[spin_8s_linear_infinite_reverse]" />
                  <span className="absolute size-3 -translate-y-12 rounded-full bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,0.7)] motion-safe:animate-pulse" />
                  <span className="grid size-16 place-items-center rounded-2xl bg-white text-indigo-600 shadow-lg shadow-indigo-200/70 ring-1 ring-indigo-100">
                    <Sparkles size={27} className="motion-safe:animate-pulse" />
                  </span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">AI course generation</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Building your course draft</h3>
                <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">
                  Reading your material and shaping it into lessons and interactive blocks.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-indigo-100 bg-white/90 px-3 py-1.5 text-xs font-medium tabular-nums text-slate-700">
                    Elapsed {formatClock(generationElapsedSeconds)}
                  </span>
                  <span className="rounded-full border border-violet-100 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {courseGenerationModelOptions.find((option) => option.value === selectedModel)?.label ?? selectedModel}
                  </span>
                </div>
                <p role="status" className="mt-4 text-xs leading-5 text-slate-400">
                  This can take a few minutes when image generation is enabled. Keep this window open.
                </p>
              </div>
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
                  disabled={!canApply || generating}
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
