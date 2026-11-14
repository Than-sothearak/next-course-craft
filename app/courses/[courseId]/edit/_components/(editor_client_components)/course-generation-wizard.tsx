"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CourseCardImagePreview } from "@/components/course-card-image-preview";
import { Progress } from "@/components/ui/progress";
import { createClientId } from "@/lib/client-id";
import { courseGenerationInputSchema, courseGenerationModelOptions, defaultCourseGenerationModel, type CourseGenerationInput, type SourceGenerationJobSnapshot } from "@/lib/ai/course-generation-schemas";
import { courseOutlineSchema, type CourseOutline, type GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import type { useEditorDraft } from "../_components/use-editor-draft";
import { GenerationPromptInput, starterGenerationPrompt } from "./(course_generation_dialog_components)/generation-prompt-input";
import { sessionRequest, type SavedSessionResponse } from "./generation-session-request";
import { advanceSourceGenerationJobUntil, postCourseGenerationForm, postSourceGenerationAction, responseError } from "./(course_generation_dialog_components)/generation-job-request";

const steps = ["Source material", "Course details", "Course outline", "Lesson drafts"];
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}{children}</label>;
}
function GenerationSwitch({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60">
    <span>{label}</span>
    <Checkbox
      role="switch"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
    />
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-indigo-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
  </label>;
}
export function CourseGenerationWizard({ open, onClose, courseId, courseTitle, courseDescription, existingLessonCount, runServerMutation, onStarted, savedSession }: {
  open: boolean; onClose: () => void; courseId: string; courseTitle: string; courseDescription: string; existingLessonCount: number;
  runServerMutation: ReturnType<typeof useEditorDraft>["runServerMutation"];
  onStarted: (session: GenerationSessionSnapshot) => void; savedSession: GenerationSessionSnapshot | null;
}) {
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);
  const closeDescriptionId = useId();
  const [step, setStep] = useState(savedSession?.status === "outline" ? 2 : 0);
  const [input, setInput] = useState<CourseGenerationInput>(savedSession?.status === "outline" ? savedSession.input : { prompt: starterGenerationPrompt, audience: "", level: "beginner", lessonCount: 5, template: "custom", learnGroupingMode: "smart", slidesPerContent: 5, targetLanguage: "English", contentDepth: "detailed", interactivity: "high", postTestCount: 5, includeImages: false, generateCoverImage: false, courseTitle, courseDescription, model: defaultCourseGenerationModel });
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<SourceGenerationJobSnapshot | null>(null);
  const [planned, setPlanned] = useState<GenerationSessionSnapshot | null>(savedSession?.status === "outline" ? savedSession : null);
  const [outline, setOutline] = useState<CourseOutline | null>(savedSession?.status === "outline" ? savedSession.outline : null);
  const [newSectionId, setNewSectionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const sourceChoiceRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!open || source || sourceChoiceRef.current) return;
    const jobId = savedSession?.status === "outline" ? savedSession.sourceJobId : window.localStorage.getItem(`course-generation-source:${courseId}`);
    if (!jobId) return;
    let disposed = false;
    void postSourceGenerationAction(courseId, "getGeneration", jobId).then((value) => { if (!disposed) setSource(value); }).catch(() => { window.localStorage.removeItem(`course-generation-source:${courseId}`); });
    return () => { disposed = true; };
  }, [open, courseId, source, savedSession]);
  function requestClose() {
    if (step === 2 && outline) { setCloseConfirmationOpen(true); return; }
    onClose();
  }
  function change<K extends keyof CourseGenerationInput>(key: K, value: CourseGenerationInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setOutline(null); setError("");
  }
  async function work(label: string, task: (signal: AbortSignal) => Promise<void>) {
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setBusyLabel(label); setError("");
    try { await task(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Please retry this step."); }
    finally { setBusy(false); abortRef.current = null; }
  }
  async function prepareSource() {
    if (!input.prompt.trim() && !file && !source) { setError("Write a course prompt or upload source material."); return; }
    if ((!file && !source) || source?.status === "awaitingPrompt") { setStep(1); return; }
    await work("Reading your source material…", async (signal) => {
      let current = source;
      if (!current) {
        const form = new FormData();
        Object.entries(input).forEach(([key, value]) => { if (value !== undefined) form.set(key, String(value)); });
        form.set("action", "analyzeSource"); if (file) form.set("file", file);
        const response = await postCourseGenerationForm(courseId, form, signal);
        if (!response.ok) throw new Error(await responseError(response));
        current = await response.json() as SourceGenerationJobSnapshot; setSource(current);
        window.localStorage.setItem(`course-generation-source:${courseId}`, current.jobId);
      } else if (current.status === "failed") {
        const form = new FormData();
        Object.entries(input).forEach(([key, value]) => { if (value !== undefined) form.set(key, String(value)); });
        current = await postSourceGenerationAction(courseId, "generate", current.jobId, form, signal);
      }
      current = await advanceSourceGenerationJobUntil(courseId, current.jobId, ["awaitingPrompt"], setSource, signal);
      setSource(current); setStep(1);
    });
  }
  async function plan() {
    const parsed = courseGenerationInputSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
    await work(input.generateCoverImage ? "Planning the outline and preparing its card image…" : "Planning sections and learning objectives…", async (signal) => {
      const result = await sessionRequest(courseId, { action: "plan", input: parsed.data, sourceJobId: source?.jobId ?? planned?.sourceJobId }, signal);
      setPlanned(result); setOutline(result.outline); setStep(2);
    });
  }
  async function approve() {
    if (!planned || !outline) return;
    const parsed = courseOutlineSchema.safeParse(outline);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
    await work("Saving your approved outline…", async (signal) => {
      const result = await runServerMutation((revision) => sessionRequest<SavedSessionResponse>(courseId, { action: "approve", sessionId: planned.id, outline: parsed.data, mode: existingLessonCount ? mode : "replace", revision }, signal));
      window.localStorage.removeItem(`course-generation-source:${courseId}`);
      onStarted(result.session);
      onClose();
    });
  }
  function editOutline(update: (value: CourseOutline) => CourseOutline) { if (outline) setOutline(update(outline)); setError(""); }
  function addOutlineSection() {
    const id = createClientId();
    editOutline((value) => ({ ...value, sections: [...value.sections, { id, title: "New section", lessons: [{ id: createClientId(), title: "New lesson", objective: "Describe the learning objective", kind: "learn" }] }] }));
    setNewSectionId(id);
  }
  function moveOutlineSection(id: string, direction: -1 | 1) {
    editOutline((value) => {
      const from = value.sections.findIndex((section) => section.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= value.sections.length) return value;
      const sections = [...value.sections];
      [sections[from], sections[to]] = [sections[to], sections[from]];
      return { ...value, sections };
    });
  }
  function removeOutlineSection(id: string) {
    editOutline((value) => value.sections.length <= 1 ? value : { ...value, sections: value.sections.filter((section) => section.id !== id) });
  }
  function moveOutlineLesson(sectionId: string, lessonId: string, direction: -1 | 1) {
    editOutline((value) => ({ ...value, sections: value.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const from = section.lessons.findIndex((lesson) => lesson.id === lessonId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= section.lessons.length) return section;
      const lessons = [...section.lessons];
      [lessons[from], lessons[to]] = [lessons[to], lessons[from]];
      return { ...section, lessons };
    }) }));
  }
  const generating = savedSession?.status === "generating";
  const customOutline = (planned?.input.template ?? input.template) === "custom";
  const hasSource = Boolean(source || planned?.sourceJobId);
  return <><Dialog open={open} onClose={requestClose} title="Generate course with AI" busy={busy} closeOnOutsideClick={false} closeOnEscape={false} className="max-w-3xl" footer={<>
    {step > 0 && <Button variant="outline" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}>Back</Button>}
    <Button disabled={busy || generating} onClick={() => void (step === 0 ? prepareSource() : step === 1 ? plan() : approve())}>
      {busy && <LoaderCircle size={16} className="animate-spin" />}{step === 0 ? "Continue to course details" : step === 1 ? "Generate outline" : "Approve outline and generate lessons"}
    </Button>
  </>}>
    <ol aria-label="Course generation steps" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`rounded-lg border px-3 py-2 text-xs ${step === index ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-200 text-slate-500"}`}>{index + 1}. {label}</li>)}
    </ol>
    {generating && <p role="status" className="mb-4 text-sm">Lessons are already generating. Close this dialog to view progress in the editor.</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <fieldset disabled={busy || generating} className="min-w-0 space-y-5">
      {step === 0 && <>
        <GenerationPromptInput value={input.prompt} onChange={(prompt) => change("prompt", prompt)} inputRef={promptRef} disabled={busy || generating} />
        <GenerationSwitch
          label="Generate course cover image"
          checked={input.generateCoverImage}
          onChange={(checked) => change("generateCoverImage", checked)}
        />
        <Field label="Source material (optional PDF or PowerPoint)"><Input type="file" accept=".pdf,.pptx" onChange={(event) => { sourceChoiceRef.current = true; window.localStorage.removeItem(`course-generation-source:${courseId}`); setFile(event.target.files?.[0] ?? null); setSource(null); setPlanned(null); setOutline(null); }} /></Field>
        {source?.uncertainSourcePages?.length ? <p role="alert" className="text-sm text-amber-800">Some source content was difficult to read on pages {source.uncertainSourcePages.join(", ")}. Review the source and the generated lessons carefully.</p> : null}
        <p className="text-xs text-slate-500">Upload a PDF or PPTX up to 12 MB, or continue using only your prompt.</p>
        {source && <Button variant="outline" size="sm" onClick={() => { sourceChoiceRef.current = true; setSource(null); setFile(null); setPlanned(null); window.localStorage.removeItem(`course-generation-source:${courseId}`); }}>Remove source material</Button>}
        {source && <div className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-medium">{source.fileName} {source.sourcePageCount ? `· ${source.sourcePageCount} pages` : ""}</p><p className="mt-2 whitespace-pre-wrap text-slate-600">{source.summary || "Preparing the source…"}</p>{source.errorMessage && <p className="mt-2 text-rose-600">{source.errorMessage}</p>}</div>}
      </>}
      {step === 1 && <>
        {source?.uncertainSourcePages?.length ? <p role="alert" className="text-sm text-amber-800">Review uncertain source content on pages {source.uncertainSourcePages.join(", ")} before continuing.</p> : null}
        {source?.summary && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">Source summary</p><p className="mt-1 whitespace-pre-wrap text-slate-600">{source.summary}</p><p className="mt-2 text-xs text-slate-500">Review the source summary. Use Back to change your prompt or file.</p></div>}
        <Field label="Course title (optional)"><Input value={input.courseTitle} maxLength={160} onChange={(event) => change("courseTitle", event.target.value)} /></Field>
        <Field label="Course description (optional)"><Textarea value={input.courseDescription} maxLength={5_000} onChange={(event) => change("courseDescription", event.target.value)} /></Field>
        <Field label="Audience"><Input value={input.audience} maxLength={300} placeholder="Who is this course for?" onChange={(event) => change("audience", event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Level"><Select value={input.level} onChange={(event) => change("level", event.target.value as CourseGenerationInput["level"])}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></Select></Field>
          <Field label="Language"><Select value={input.targetLanguage} onChange={(event) => change("targetLanguage", event.target.value as CourseGenerationInput["targetLanguage"])}><option>English</option><option>Khmer</option></Select></Field>
          <Field label="Learning lessons"><Input type="number" min={1} max={20} value={input.lessonCount} onChange={(event) => change("lessonCount", Number(event.target.value))} /></Field>
          <Field label="Course structure"><Select value={input.template} onChange={(event) => change("template", event.target.value as CourseGenerationInput["template"])}><option value="custom">Custom</option><option value="preLearnPost">Pre / Learn / Post</option></Select></Field>
          <Field label="Explanation depth"><Select value={input.contentDepth} onChange={(event) => change("contentDepth", event.target.value as CourseGenerationInput["contentDepth"])}><option value="concise">Concise</option><option value="detailed">Detailed</option><option value="veryDetailed">Very detailed</option></Select></Field>
          <Field label="Interactivity"><Select value={input.interactivity} onChange={(event) => change("interactivity", event.target.value as CourseGenerationInput["interactivity"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
          <Field label="AI model"><Select value={input.model} onChange={(event) => change("model", event.target.value as CourseGenerationInput["model"])}>{courseGenerationModelOptions.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}</Select></Field>
          {input.template === "preLearnPost" && <Field label="Post-test questions"><Input type="number" min={1} max={20} value={input.postTestCount} onChange={(event) => change("postTestCount", Number(event.target.value))} /></Field>}
          {source && <><Field label="Source grouping"><Select value={input.learnGroupingMode} onChange={(event) => change("learnGroupingMode", event.target.value as CourseGenerationInput["learnGroupingMode"])}><option value="smart">Smart topics</option><option value="fixed">Fixed page groups</option></Select></Field><Field label="Pages per learning lesson"><Input type="number" min={1} max={500} value={input.slidesPerContent} onChange={(event) => change("slidesPerContent", Number(event.target.value))} /></Field></>}
        </div>
        <GenerationSwitch
          label="Generate supplemental images"
          checked={input.includeImages}
          onChange={(checked) => change("includeImages", checked)}
        />
        {source && <p className="text-xs text-slate-500">Source grouping determines the learning lesson count so every source page is covered.</p>}
      </>}
      {step === 2 && outline && <>
        <p className="text-sm text-slate-600">Review and correct the outline before lesson writing begins. Approval saves this outline and opens lesson drafts in the course editor.</p>
        {customOutline && <Button variant="outline" size="sm" disabled={outline.sections.length >= 10 || outline.sections.flatMap((section) => section.lessons).length >= 20} onClick={addOutlineSection}><Plus size={14} />Add section</Button>}
        {planned?.cover?.imageSrc && <CourseCardImagePreview imageSrc={planned.cover.imageSrc} imageAlt={planned.cover.imageAlt} title={outline.title} />}
        {planned?.coverWarning && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{planned.coverWarning}</p>}
        <Field label="Course title"><Input value={outline.title} maxLength={160} onChange={(event) => editOutline((value) => ({ ...value, title: event.target.value }))} /></Field>
        <Field label="Course description"><Textarea value={outline.description} maxLength={5_000} onChange={(event) => editOutline((value) => ({ ...value, description: event.target.value }))} /></Field>
        {outline.sections.map((section, sectionIndex) => <div key={section.id} data-outline-section-id={section.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
          <span data-outline-section-number className="text-lg font-bold text-slate-900">Section #{sectionIndex + 1}</span>
          {customOutline && <div role="group" aria-label={`Section actions for ${section.title}`} className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" aria-label={`Move section ${section.title} up`} disabled={sectionIndex === 0} onClick={() => moveOutlineSection(section.id, -1)}><ArrowUp size={14} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Move section ${section.title} down`} disabled={sectionIndex === outline.sections.length - 1} onClick={() => moveOutlineSection(section.id, 1)}><ArrowDown size={14} /></Button>
            <Button variant="ghost" size="icon" aria-label={`Remove section ${section.title}`} disabled={outline.sections.length <= 1} onClick={() => removeOutlineSection(section.id)}><Trash2 size={14} /></Button>
          </div>}
          </div>
          <Field label="Section title"><Input value={section.title} autoFocus={section.id === newSectionId} maxLength={160} onChange={(event) => editOutline((value) => ({ ...value, sections: value.sections.map((candidate) => candidate.id === section.id ? { ...candidate, title: event.target.value } : candidate) }))} /></Field>
          {section.lessons.map((lesson, index) => <div key={lesson.id} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{lesson.kind === "learn" ? `Lesson ${index + 1}` : "Template activity"}{lesson.sourceIndex !== undefined ? ` · Source group ${lesson.sourceIndex + 1}` : ""}</span>
              {lesson.kind === "learn" && <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Move ${lesson.title} up`} disabled={index === 0} onClick={() => moveOutlineLesson(section.id, lesson.id, -1)}><ArrowUp size={14} /></Button>
                <Button variant="ghost" size="icon" aria-label={`Move ${lesson.title} down`} disabled={index === section.lessons.length - 1} onClick={() => moveOutlineLesson(section.id, lesson.id, 1)}><ArrowDown size={14} /></Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${lesson.title}`} disabled={section.lessons.length <= 1 || (!customOutline && lesson.sourceIndex !== undefined)} onClick={() => editOutline((value) => ({ ...value, sections: value.sections.map((candidate) => candidate.id === section.id ? { ...candidate, lessons: candidate.lessons.filter((candidate) => candidate.id !== lesson.id) } : candidate) }))}><Trash2 size={14} /></Button>
              </div>}
            </div>
            <Field label="Lesson title"><Input value={lesson.title} maxLength={160} onChange={(event) => editOutline((value) => ({ ...value, sections: value.sections.map((candidate) => ({ ...candidate, lessons: candidate.lessons.map((candidate) => candidate.id === lesson.id ? { ...candidate, title: event.target.value } : candidate) })) }))} /></Field>
            {lesson.kind === "learn" && <Field label="Learning objective"><Textarea value={lesson.objective} maxLength={1_000} rows={2} onChange={(event) => editOutline((value) => ({ ...value, sections: value.sections.map((candidate) => ({ ...candidate, lessons: candidate.lessons.map((candidate) => candidate.id === lesson.id ? { ...candidate, objective: event.target.value } : candidate) })) }))} /></Field>}
          </div>)}
          {(customOutline || !hasSource) && section.lessons.every((lesson) => lesson.kind === "learn") && <Button variant="outline" size="sm" disabled={outline.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.kind === "learn").length >= 20} onClick={() => editOutline((value) => ({ ...value, sections: value.sections.map((candidate) => candidate.id === section.id ? { ...candidate, lessons: [...candidate.lessons, { id: createClientId(), title: "New lesson", objective: "Describe the learning objective", kind: "learn" }] } : candidate) }))}><Plus size={14} />Add lesson</Button>}
        </div>)}
        {existingLessonCount > 0 && <><Field label="How should this outline be applied?"><Select value={mode} onChange={(event) => setMode(event.target.value as "append" | "replace")}><option value="append">Add to existing lessons</option><option value="replace">Replace existing lessons</option></Select></Field>{mode === "replace" && <p className="text-sm text-rose-700">Approving this outline replaces your current {existingLessonCount} lessons.</p>}</>}
      </>}

    </fieldset>
    {busy && <div role="status" className="mt-5 space-y-2"><p className="text-sm text-slate-600">{busyLabel}</p><Progress aria-label={busyLabel} /></div>}
  </Dialog>
    {closeConfirmationOpen && <Dialog open role="alertdialog" title="Close course outline?" descriptionId={closeDescriptionId} onClose={() => setCloseConfirmationOpen(false)} closeOnOutsideClick={false} footer={<>
      <Button autoFocus onClick={() => setCloseConfirmationOpen(false)}>Continue editing</Button>
      <Button variant="destructive" onClick={() => { setCloseConfirmationOpen(false); onClose(); }}>Close</Button>
    </>}>
      <p id={closeDescriptionId} className="text-sm text-slate-600">Unsaved changes to this outline will be lost if you close. Would you like to close or continue editing?</p>
    </Dialog>}
  </>;
}
