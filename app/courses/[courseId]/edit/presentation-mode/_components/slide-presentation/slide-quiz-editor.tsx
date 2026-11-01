"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQuizChoice, createQuizQuestion } from "@/lib/editor/quiz-question";
import { isQuizAnswerCorrect } from "@/lib/interactive/quiz-assessment";
import { resolveSlideSize, type SlideMaster, type SlideHeaderStyle } from "@/lib/editor/slide-design";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { QuizQuestionPreview } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(quiz_assessment_preview_components)/quiz-question-preview";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { QuizQuestionProgress } from "@/app/courses/[courseId]/_components/slide-presentation/quiz-question-progress";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import { SlideEditorInspector } from "./slide-editor-inspector";
import { SlideInspectorTabs, type SlideInspectorTab } from "./slide-inspector-tabs";
import { SlideHeaderTitleEditor } from "./slide-header-title-editor";
import { SlideHeaderTextSettings } from "./slide-header-text-settings";
import { SlideNumberSettingInput } from "./slide-number-setting-input";
import { SlideAppearanceSettings } from "./slide-appearance-settings";
import type { SlideAppearance } from "@/lib/editor/slide-design";

function QuizCanvasQuestion({ question, index, total, passingScore }: { question: QuizQuestion; index: number; total: number; passingScore: number }) {
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [answerState, setAnswerState] = useState<boolean | null>(null);
  return <div className="mx-auto my-3 w-full max-w-[720px] space-y-3 px-4">
    <QuizQuestionProgress index={index} total={total} passingScore={passingScore} />
    <QuizQuestionPreview question={question} index={index} selectedChoiceIds={selectedChoiceIds} answerState={answerState} presentation onSelectionChange={(ids) => { setSelectedChoiceIds(ids); setAnswerState(null); }} onCheck={() => setAnswerState(isQuizAnswerCorrect(question, selectedChoiceIds))} />
  </div>;
}

export function SlideQuizEditor({ title, onTitleChange, headerStyle, onHeaderStyleChange, appearance, onAppearanceChange, courseId, questions, onChange, passingScore, onPassingScoreChange, master, number, total, zoom, onZoomChange, controls, masterSettings, coverSettings }: {
  title: string;
  onTitleChange: (title: string) => void;
  headerStyle?: SlideHeaderStyle;
  onHeaderStyleChange: (style?: SlideHeaderStyle) => void;
  appearance?: SlideAppearance;
  onAppearanceChange: (appearance?: SlideAppearance) => void;
  courseId: string;
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  passingScore: number;
  onPassingScoreChange: (score: number) => void;
  master?: SlideMaster;
  number: number;
  total: number;
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  controls: ReactNode;
  masterSettings: ReactNode;
  coverSettings: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => questions[0]?.id ?? null);
  const [headerSelected, setHeaderSelected] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<SlideInspectorTab>("object");
  const selectHeader = () => { setHeaderSelected(true); setInspectorTab("object"); };
  const active = questions.find((question) => question.id === selectedId) ?? questions[0] ?? null;
  const index = active ? questions.findIndex((question) => question.id === active.id) : -1;
  const updateQuestion = (change: (question: QuizQuestion) => QuizQuestion) => {
    if (active) onChange(questions.map((question) => question.id === active.id ? change(question) : question));
  };
  const moveQuestion = (direction: number) => {
    const next = index + direction;
    if (index < 0 || next < 0 || next >= questions.length) return;
    const updated = [...questions];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    onChange(updated);
  };
  const removeQuestion = () => {
    if (!active) return;
    const remaining = questions.filter((question) => question.id !== active.id);
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    onChange(remaining);
  };
  return <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1" aria-label="Presentation quiz editor">
    <SlideEditorCanvas fillAvailable label={`Quiz slide ${number} / ${total}`} size={resolveSlideSize(master)} zoom={zoom} onZoomChange={onZoomChange}>
      <SlideSurface master={master} appearance={appearance} headerTextStyle={headerStyle} title={<SlideHeaderTitleEditor title={title} selected={headerSelected} onSelect={selectHeader} onChange={onTitleChange} />} number={number} total={total} controls={controls} contentRegion>
        {active ? <QuizCanvasQuestion key={`${active.id}:${active.selectionMode}:${active.correctChoiceIds.join(",")}`} question={active} index={index} total={questions.length} passingScore={passingScore} /> : <div className="mx-auto mt-10 max-w-[720px] rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">Add the first question in Quiz settings.</div>}
      </SlideSurface>
    </SlideEditorCanvas>
    <SlideEditorInspector>
      <SlideInspectorTabs value={inspectorTab} onChange={setInspectorTab} objectLabel="Quiz" collapsibleObjectSettings={false} master={masterSettings} cover={coverSettings}>
        <SlideAppearanceSettings value={appearance} onChange={onAppearanceChange} master={master} courseId={courseId} />
        {headerSelected && <SlideHeaderTextSettings master={master} value={headerStyle} onChange={onHeaderStyleChange} />}
        <section aria-label="Quiz settings" className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block space-y-1 text-xs font-medium text-slate-600">Passing score (%)<SlideNumberSettingInput aria-label="Quiz passing score percentage" value={passingScore} min={0} max={100} onValueChange={onPassingScoreChange} /></label>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><h2 className="text-xs font-semibold text-slate-700">Questions</h2><span className="text-xs text-slate-500">{questions.length} / 100</span></div>
            <div className="grid grid-cols-3 gap-1.5" aria-label="Quiz question list">{questions.map((question, questionIndex) => <Button key={question.id} type="button" size="sm" variant={question.id === active?.id ? "secondary" : "outline"} aria-label={`Edit quiz question ${questionIndex + 1}`} aria-pressed={question.id === active?.id} onClick={() => { setHeaderSelected(false); setSelectedId(question.id); }} className="min-w-0 justify-start truncate px-2">Q{questionIndex + 1}</Button>)}</div>
            <Button type="button" size="sm" variant="outline" disabled={questions.length >= 100} onClick={() => { const question = createQuizQuestion(); onChange([...questions, question]); setSelectedId(question.id); }} className="w-full"><Plus size={14} />Add question</Button>
          </div>
          {active && <>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3"><h2 className="text-xs font-semibold text-slate-700">Q{index + 1} · Multiple choice</h2><div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move question earlier" disabled={index === 0} onClick={() => moveQuestion(-1)}><ArrowUp size={14} /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Move question later" disabled={index === questions.length - 1} onClick={() => moveQuestion(1)}><ArrowDown size={14} /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-rose-600" aria-label="Delete question" onClick={removeQuestion}><Trash2 size={14} /></Button>
            </div></div>
            <label className="block space-y-1 text-xs text-slate-600">Question prompt<Textarea aria-label={`Question ${index + 1} prompt`} maxLength={2000} value={active.prompt} onChange={(event) => updateQuestion((question) => ({ ...question, prompt: event.target.value }))} className="min-h-16" /></label>
            <label className="block space-y-1 text-xs text-slate-600">Question image URL<Input aria-label={`Question ${index + 1} image URL`} type="url" maxLength={2048} value={active.imageSrc} onChange={(event) => updateQuestion((question) => ({ ...question, imageSrc: event.target.value }))} /></label>
            {active.imageSrc && <label className="block space-y-1 text-xs text-slate-600">Image description<Input aria-label={`Question ${index + 1} image description`} maxLength={500} value={active.imageAlt} onChange={(event) => updateQuestion((question) => ({ ...question, imageAlt: event.target.value }))} /></label>}
            <label className="block space-y-1 text-xs text-slate-600">Answer mode<Select aria-label={`Question ${index + 1} choice mode`} value={active.selectionMode} onChange={(event) => updateQuestion((question) => { const selectionMode = event.target.value as QuizQuestion["selectionMode"]; return { ...question, selectionMode, correctChoiceIds: selectionMode === "single" ? question.correctChoiceIds.slice(0, 1) : question.correctChoiceIds }; })}><option value="single">Choose one</option><option value="multiple">Choose all that apply</option></Select></label>
            <div className="space-y-2" aria-label={`Question ${index + 1} answer choices`}>
              <h3 className="text-xs font-semibold text-slate-700">Choices</h3>
              {active.choices.map((choice, choiceIndex) => <div key={choice.id} className="space-y-2 rounded-md border border-slate-200 p-2">
                <div className="flex items-center gap-2"><label className="flex shrink-0 items-center gap-1 text-xs text-slate-600"><Checkbox aria-label={`Mark choice ${choiceIndex + 1} correct for question ${index + 1}`} checked={active.correctChoiceIds.includes(choice.id)} onChange={(event) => updateQuestion((question) => ({ ...question, correctChoiceIds: question.selectionMode === "single" ? event.target.checked ? [choice.id] : [] : event.target.checked ? [...question.correctChoiceIds, choice.id] : question.correctChoiceIds.filter((id) => id !== choice.id) }))} />Correct</label>
                  <Input aria-label={`Question ${index + 1} choice ${choiceIndex + 1} text`} maxLength={500} value={choice.text} placeholder={`Choice ${choiceIndex + 1}`} onChange={(event) => updateQuestion((question) => ({ ...question, choices: question.choices.map((item) => item.id === choice.id ? { ...item, text: event.target.value } : item) }))} />
                  <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 text-rose-600" aria-label={`Remove choice ${choiceIndex + 1}`} disabled={active.choices.length <= 2} onClick={() => updateQuestion((question) => ({ ...question, choices: question.choices.filter((item) => item.id !== choice.id), correctChoiceIds: question.correctChoiceIds.filter((id) => id !== choice.id) }))}><Trash2 size={13} /></Button>
                </div>
                <Input type="url" aria-label={`Question ${index + 1} choice ${choiceIndex + 1} image URL`} maxLength={2048} value={choice.imageSrc} placeholder="Choice image URL (optional)" onChange={(event) => updateQuestion((question) => ({ ...question, choices: question.choices.map((item) => item.id === choice.id ? { ...item, imageSrc: event.target.value } : item) }))} />
                {choice.imageSrc && <Input aria-label={`Question ${index + 1} choice ${choiceIndex + 1} image description`} maxLength={500} value={choice.imageAlt} placeholder="Image description" onChange={(event) => updateQuestion((question) => ({ ...question, choices: question.choices.map((item) => item.id === choice.id ? { ...item, imageAlt: event.target.value } : item) }))} />}
              </div>)}
              <Button type="button" variant="outline" size="sm" disabled={active.choices.length >= 8} onClick={() => updateQuestion((question) => ({ ...question, choices: [...question.choices, createQuizChoice()] }))} className="w-full"><Plus size={14} />Add choice</Button>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3"><h3 className="text-xs font-semibold text-slate-700">Answer feedback</h3>
              <label className="block space-y-1 text-xs text-slate-600">Correct answer<Textarea aria-label="Correct answer feedback" maxLength={2000} value={active.correctFeedback} onChange={(event) => updateQuestion((question) => ({ ...question, correctFeedback: event.target.value }))} className="min-h-14" /></label>
              <label className="block space-y-1 text-xs text-slate-600">Incorrect answer<Textarea aria-label="Incorrect answer feedback" maxLength={2000} value={active.incorrectFeedback} onChange={(event) => updateQuestion((question) => ({ ...question, incorrectFeedback: event.target.value }))} className="min-h-14" /></label>
            </div>
          </>}
        </section>
      </SlideInspectorTabs>
    </SlideEditorInspector>
  </div>;
}
