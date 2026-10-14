"use client";

import Image from "next/image";
import { useId, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, ImagePlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LessonTitleEditor } from "./lesson-title-editor";
import { SortableItem } from "./sortable-item";

const simpleInputClass =
  "h-9 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";
const simpleTextareaClass =
  "min-h-16 resize-y rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

function newId() {
  return crypto.randomUUID();
}

function imagePreviewSource(value: string) {
  const source = value.trim();
  return /^https?:\/\//i.test(source) ||
    (source.startsWith("/") && !source.startsWith("//"))
    ? source
    : "";
}

function createQuestion(): QuizQuestion {
  return {
    id: newId(),
    prompt: "",
    imageSrc: "",
    imageAlt: "",
    selectionMode: "single",
    choices: [
      { id: newId(), text: "", imageSrc: "", imageAlt: "" },
      { id: newId(), text: "", imageSrc: "", imageAlt: "" },
    ],
    correctChoiceIds: [],
    correctFeedback: "",
    incorrectFeedback: "",
  };
}

export function QuizEditor({
  title,
  titleHtml,
  onTitleChange,
  onTitleValidityChange,
  passingScore,
  onPassingScoreChange,
  questions,
  onChange,
}: {
  title: string;
  titleHtml?: string;
  onTitleChange: (title: string, html: string) => void;
  onTitleValidityChange: (valid: boolean) => void;
  passingScore: number;
  onPassingScoreChange: (passingScore: number) => void;
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}) {
  const dndId = `quiz-questions-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const choiceSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    () => questions[0]?.id ?? null,
  );
  const [imageQuestionId, setImageQuestionId] = useState<string | null>(null);
  const [imageChoiceIds, setImageChoiceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [feedbackType, setFeedbackType] = useState<"correct" | "incorrect">(
    "correct",
  );
  const activeQuestion =
    questions.find((question) => question.id === activeQuestionId) ??
    questions[0] ??
    null;

  function updateQuestion(
    questionId: string,
    change: (question: QuizQuestion) => QuizQuestion,
  ) {
    onChange(
      questions.map((question) =>
        question.id === questionId ? change(question) : question,
      ),
    );
  }

  function addQuestion() {
    const question = createQuestion();
    onChange([...questions, question]);
    setActiveQuestionId(question.id);
  }

  function deleteQuestion(questionId: string) {
    const index = questions.findIndex((question) => question.id === questionId);
    const remaining = questions.filter(
      (question) => question.id !== questionId,
    );
    onChange(remaining);
    if (activeQuestionId === questionId)
      setActiveQuestionId(
        remaining[Math.min(index, remaining.length - 1)]?.id ?? null,
      );
  }

  function reorderQuestions(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = questions.findIndex(
      (question) => `quiz-question-${question.id}` === event.active.id,
    );
    const to = questions.findIndex(
      (question) => `quiz-question-${question.id}` === event.over?.id,
    );
    if (from >= 0 && to >= 0) onChange(arrayMove(questions, from, to));
  }

  if (!activeQuestion) {
    return (
      <section
        aria-label="Quiz questions"
        className="flex min-h-[calc(100vh-68px)] bg-white"
      >
        <aside
          aria-label="Question order"
          className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-[#f5f5f5] px-3 py-4 md:block"
        >
          <h2 className="mb-4 border-b border-slate-300 px-2 pb-3 text-[11px] font-bold uppercase tracking-wide text-slate-800">
            Question order
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addQuestion}
            className="h-9 px-2 text-xs text-slate-600"
          >
            <Plus size={14} />
            Add question
          </Button>
        </aside>
        <div className="min-w-0 flex-1 px-5 py-2 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-[720px]">
            <LessonTitleEditor
              title={title}
              html={titleHtml}
              onChange={onTitleChange}
              onValidityChange={onTitleValidityChange}
            />
            <label className="mb-8 mt-3 flex w-fit items-center gap-2 text-xs text-slate-500">
              <span>Pass at</span>
              <Input
                type="number"
                aria-label="Quiz passing score percentage"
                min={0}
                max={100}
                step={1}
                value={passingScore}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isInteger(value) && value >= 0 && value <= 100) onPassingScoreChange(value);
                }}
                className="h-8 w-16 rounded-none border-0 border-b border-slate-200 bg-transparent px-1 text-center text-sm text-slate-900 shadow-none focus-visible:border-slate-300 focus-visible:outline-none focus-visible:ring-0"
              />
              <span>%</span>
            </label>
            <div className="grid min-h-[42vh] place-items-center">
              <Button type="button" variant="ghost" onClick={addQuestion}>
                <Plus size={15} />
                Add question
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const activeIndex = questions.findIndex(
    (question) => question.id === activeQuestion.id,
  );
  const questionImageOpen =
    imageQuestionId === activeQuestion.id || Boolean(activeQuestion.imageSrc);

  function reorderChoices(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = activeQuestion.choices.findIndex(
      (choice) => `quiz-choice-${choice.id}` === event.active.id,
    );
    const to = activeQuestion.choices.findIndex(
      (choice) => `quiz-choice-${choice.id}` === event.over?.id,
    );
    if (from >= 0 && to >= 0)
      updateQuestion(activeQuestion.id, (current) => ({
        ...current,
        choices: arrayMove(current.choices, from, to),
      }));
  }

  function setCorrectChoice(choiceId: string, checked: boolean) {
    updateQuestion(activeQuestion.id, (current) => ({
      ...current,
      correctChoiceIds:
        current.selectionMode === "single"
          ? checked
            ? [choiceId]
            : []
          : checked
            ? [...current.correctChoiceIds, choiceId]
            : current.correctChoiceIds.filter((id) => id !== choiceId),
    }));
  }

  return (
    <section
      aria-label="Quiz questions"
      className="mt-0 flex min-h-[calc(100vh-68px)] bg-white"
    >
      <aside
        aria-label="Question order"
        className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-[#f5f5f5] px-3 py-4 md:block"
      >
        <h2 className="mb-4 border-b border-slate-300 px-2 pb-3 text-[11px] font-bold uppercase tracking-wide text-slate-800">
          Question order
        </h2>
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={reorderQuestions}
        >
          <SortableContext
            items={questions.map((question) => `quiz-question-${question.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {questions.map((question, index) => (
                <SortableItem
                  key={question.id}
                  id={`quiz-question-${question.id}`}
                  alwaysShowHandle
                  handleClassName="text-[#2f5f9f] hover:bg-blue-100 hover:text-[#1d4e89]"
                  className="group/question-row border-b border-slate-200"
                >
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      onClick={() => setActiveQuestionId(question.id)}
                      aria-current={
                        activeQuestion.id === question.id ? "true" : undefined
                      }
                      className={`min-h-14 min-w-0 flex-1 px-2 py-3 text-left text-xs leading-4 ${activeQuestion.id === question.id ? "bg-[#e7e7e7] text-black" : "text-slate-700 hover:bg-white/70"}`}
                    >
                      {question.prompt.trim() || `Question ${index + 1}`}
                    </button>
                    <details className="relative self-center">
                      <summary
                        aria-label={`Question ${index + 1} actions`}
                        className="grid size-8 cursor-pointer list-none place-items-center text-slate-500 hover:bg-slate-200 [&::-webkit-details-marker]:hidden"
                      >
                        <MoreHorizontal size={15} />
                      </summary>
                      <div className="absolute right-1 top-full z-30 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => deleteQuestion(question.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 size={13} />
                          Delete question
                        </button>
                      </div>
                    </details>
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addQuestion}
          disabled={questions.length >= 100}
          className="mt-2 h-9 px-2 text-xs text-slate-600"
        >
          <Plus size={14} />
          Add question
        </Button>
      </aside>

      <div className="min-w-0 flex-1 px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[720px]">
          <LessonTitleEditor
            title={title}
            html={titleHtml}
            onChange={onTitleChange}
            onValidityChange={onTitleValidityChange}
          />
          <label className="mb-8 mt-3 flex w-fit items-center gap-2 text-xs text-slate-500">
            <span>Pass at</span>
            <Input
              type="number"
              aria-label="Quiz passing score percentage"
              min={0}
              max={100}
              step={1}
              value={passingScore}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (event.target.value && Number.isInteger(value) && value >= 0 && value <= 100) onPassingScoreChange(value);
              }}
              className="h-8 w-16 rounded-none border-0 border-b border-slate-200 bg-transparent px-1 text-center text-sm text-slate-900 shadow-none focus-visible:border-slate-300 focus-visible:outline-none focus-visible:ring-0"
            />
            <span>%</span>
          </label>
          <div className="mb-5 flex items-center gap-2 md:hidden">
            <Select
              aria-label="Question order"
              value={activeQuestion.id}
              onChange={(event) => setActiveQuestionId(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              {questions.map((question, index) => (
                <option key={question.id} value={question.id}>
                  {question.prompt.trim() || `Question ${index + 1}`}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addQuestion}
              disabled={questions.length >= 100}
              className="shrink-0"
            >
              <Plus size={14} />
              Add
            </Button>
          </div>
          <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="pt-1 text-sm font-semibold tabular-nums text-slate-400">
              {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <Textarea
              aria-label={`Question ${activeIndex + 1}`}
              value={activeQuestion.prompt}
              maxLength={2_000}
              onChange={(event) =>
                updateQuestion(activeQuestion.id, (current) => ({
                  ...current,
                  prompt: event.target.value,
                }))
              }
              placeholder="Write your question..."
              rows={1}
              className={`${simpleTextareaClass} min-h-8 border-b border-slate-200 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-200`}
            />
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Add question image"
                title="Add image"
                onClick={() =>
                  setImageQuestionId(
                    questionImageOpen ? null : activeQuestion.id,
                  )
                }
                className="size-8 text-slate-500"
              >
                <ImagePlus size={15} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete question ${activeIndex + 1}`}
                title="Delete question"
                onClick={() => deleteQuestion(activeQuestion.id)}
                className="size-8 text-slate-500 md:hidden"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
          {questionImageOpen && (
            <div className="ml-[55px] mt-2 max-w-sm">
              <Input
                type="url"
                aria-label={`Question ${activeIndex + 1} image URL`}
                value={activeQuestion.imageSrc}
                maxLength={2_048}
                onChange={(event) =>
                  updateQuestion(activeQuestion.id, (current) => ({
                    ...current,
                    imageSrc: event.target.value,
                  }))
                }
                placeholder="Image URL"
                className={`${simpleInputClass} border-b border-slate-200 focus-visible:border-slate-200`}
              />
              {activeQuestion.imageSrc && (
                <Input
                  aria-label={`Question ${activeIndex + 1} image description`}
                  value={activeQuestion.imageAlt}
                  maxLength={500}
                  onChange={(event) =>
                    updateQuestion(activeQuestion.id, (current) => ({
                      ...current,
                      imageAlt: event.target.value,
                    }))
                  }
                  placeholder="Image description"
                  className={`${simpleInputClass} border-b border-slate-200 focus-visible:border-slate-200`}
                />
              )}
            </div>
          )}
          {imagePreviewSource(activeQuestion.imageSrc) && (
            <Image
              src={imagePreviewSource(activeQuestion.imageSrc)}
              alt={activeQuestion.imageAlt}
              width={960}
              height={540}
              unoptimized
              className="ml-[55px] mt-3 max-h-56 w-auto rounded-sm object-contain"
            />
          )}

          <div className="mt-12 grid grid-cols-[48px_minmax(0,1fr)_150px] items-end gap-3 border-b border-slate-200 pb-2 text-[10px] font-semibold text-slate-800 sm:grid-cols-[84px_minmax(0,1fr)_150px]">
            <span>Correct</span>
            <span>Choice text</span>
            <Select
              aria-label={`Question ${activeIndex + 1} choice mode`}
              value={activeQuestion.selectionMode}
              onChange={(event) => {
                const selectionMode = event.target
                  .value as QuizQuestion["selectionMode"];
                updateQuestion(activeQuestion.id, (current) => ({
                  ...current,
                  selectionMode,
                  correctChoiceIds:
                    selectionMode === "single"
                      ? current.correctChoiceIds.slice(0, 1)
                      : current.correctChoiceIds,
                }));
              }}
              className="h-7 w-full rounded-none border-0 bg-transparent px-0 text-[10px] font-semibold shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
            </Select>
          </div>

          <DndContext
            id={`quiz-choices-${activeQuestion.id}`}
            sensors={choiceSensors}
            collisionDetection={closestCenter}
            onDragEnd={reorderChoices}
          >
            <SortableContext
              items={activeQuestion.choices.map(
                (choice) => `quiz-choice-${choice.id}`,
              )}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {activeQuestion.choices.map((choice, index) => {
                  const imageOpen =
                    imageChoiceIds.has(choice.id) || Boolean(choice.imageSrc);
                  return (
                    <SortableItem
                      key={choice.id}
                      id={`quiz-choice-${choice.id}`}
                      overlayHandle
                      alwaysShowHandle
                      centerHandle
                      className="relative border-b border-slate-200 py-3"
                      contentClassName="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[84px_minmax(0,1fr)_auto]"
                    >
                      <label
                        className="mt-1 grid size-8 cursor-pointer place-items-center justify-self-center rounded-full hover:bg-slate-50"
                        title="Mark as correct answer"
                      >
                        <input
                          aria-label={`Mark choice ${index + 1} correct for question ${activeIndex + 1}`}
                          type={
                            activeQuestion.selectionMode === "single"
                              ? "radio"
                              : "checkbox"
                          }
                          name={`correct-${activeQuestion.id}`}
                          checked={activeQuestion.correctChoiceIds.includes(
                            choice.id,
                          )}
                          onChange={(event) =>
                            setCorrectChoice(choice.id, event.target.checked)
                          }
                          className="sr-only"
                        />
                        {activeQuestion.correctChoiceIds.includes(choice.id) ? (
                          <Check size={15} className="text-slate-700" />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="size-4 rounded-full border border-slate-300"
                          />
                        )}
                      </label>
                      <div className="min-w-0">
                        <Input
                          type="text"
                          aria-label={`Question ${activeIndex + 1} choice ${index + 1} text`}
                          value={choice.text}
                          maxLength={500}
                          onChange={(event) =>
                            updateQuestion(activeQuestion.id, (current) => ({
                              ...current,
                              choices: current.choices.map((item) =>
                                item.id === choice.id
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder={`Answer choice ${index + 1}…`}
                          className={`${simpleInputClass} border-b border-transparent text-sm focus-visible:border-slate-200`}
                        />
                        {imageOpen && (
                          <div className="mt-1 space-y-1">
                            <Input
                              type="url"
                              aria-label={`Question ${activeIndex + 1} choice ${index + 1} image URL`}
                              value={choice.imageSrc}
                              maxLength={2_048}
                              onChange={(event) =>
                                updateQuestion(
                                  activeQuestion.id,
                                  (current) => ({
                                    ...current,
                                    choices: current.choices.map((item) =>
                                      item.id === choice.id
                                        ? {
                                            ...item,
                                            imageSrc: event.target.value,
                                          }
                                        : item,
                                    ),
                                  }),
                                )
                              }
                              placeholder="Image URL"
                              className={`${simpleInputClass} border-b border-slate-200 focus-visible:border-slate-200`}
                            />
                            {choice.imageSrc && (
                              <Input
                                aria-label={`Question ${activeIndex + 1} choice ${index + 1} image description`}
                                value={choice.imageAlt}
                                maxLength={500}
                                onChange={(event) =>
                                  updateQuestion(
                                    activeQuestion.id,
                                    (current) => ({
                                      ...current,
                                      choices: current.choices.map((item) =>
                                        item.id === choice.id
                                          ? {
                                              ...item,
                                              imageAlt: event.target.value,
                                            }
                                          : item,
                                      ),
                                    }),
                                  )
                                }
                                placeholder="Image description"
                                className={`${simpleInputClass} border-b border-slate-200 focus-visible:border-slate-200`}
                              />
                            )}
                          </div>
                        )}
                        {imagePreviewSource(choice.imageSrc) && (
                          <Image
                            src={imagePreviewSource(choice.imageSrc)}
                            alt={choice.imageAlt}
                            width={480}
                            height={320}
                            unoptimized
                            className="mt-2 max-h-32 w-auto rounded-sm object-contain"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Add image to answer choice ${index + 1}`}
                          title="Add image"
                          onClick={() =>
                            setImageChoiceIds((previous) => {
                              const next = new Set(previous);
                              if (next.has(choice.id)) next.delete(choice.id);
                              else next.add(choice.id);
                              return next;
                            })
                          }
                          className="size-8 text-slate-500"
                        >
                          <ImagePlus size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove choice ${index + 1}`}
                          title="Remove choice"
                          disabled={activeQuestion.choices.length <= 2}
                          onClick={() =>
                            updateQuestion(activeQuestion.id, (current) => ({
                              ...current,
                              choices: current.choices.filter(
                                (item) => item.id !== choice.id,
                              ),
                              correctChoiceIds: current.correctChoiceIds.filter(
                                (id) => id !== choice.id,
                              ),
                            }))
                          }
                          className="size-8 text-slate-400 hover:text-rose-700"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              updateQuestion(activeQuestion.id, (current) => ({
                ...current,
                choices: [
                  ...current.choices,
                  { id: newId(), text: "", imageSrc: "", imageAlt: "" },
                ],
              }))
            }
            disabled={activeQuestion.choices.length >= 8}
            className="mt-1 h-10 justify-start px-0 text-xs text-slate-500"
          >
            <Plus size={14} />
            Add a choice (optional)…
          </Button>

          <div className="mt-8 grid grid-cols-[48px_minmax(0,1fr)_150px] items-start gap-3 border-b border-slate-200 pb-3 text-[10px] font-semibold text-slate-800 sm:grid-cols-[84px_minmax(0,1fr)_150px]">
            <span className="col-span-2 pt-2">Feedback</span>
            <Select
              aria-label="Feedback response type"
              value={feedbackType}
              onChange={(event) =>
                setFeedbackType(event.target.value as "correct" | "incorrect")
              }
              className="h-7 w-full rounded-none border-0 bg-transparent px-0 text-[10px] font-semibold shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <option value="correct">Correct response</option>
              <option value="incorrect">Incorrect response</option>
            </Select>
            <Textarea
              aria-label={`${feedbackType === "correct" ? "Correct" : "Incorrect"} answer feedback`}
              value={
                feedbackType === "correct"
                  ? activeQuestion.correctFeedback
                  : activeQuestion.incorrectFeedback
              }
              maxLength={2_000}
              onChange={(event) =>
                updateQuestion(activeQuestion.id, (current) =>
                  feedbackType === "correct"
                    ? { ...current, correctFeedback: event.target.value }
                    : { ...current, incorrectFeedback: event.target.value },
                )
              }
              placeholder="Enter answer feedback (optional)…"
              rows={1}
              className={`${simpleTextareaClass} col-span-3 min-h-10 text-sm placeholder:text-slate-400 sm:col-start-2 sm:col-span-2`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
