"use client";

import { PreviewImage } from "../../../../preview-image";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { safeImageSource } from "../../preview-utils";
export function QuizQuestionPreview({
  question,
  index,
  selectedChoiceIds,
  answerState,
  onSelectionChange,
  onCheck,
}: {
  question: QuizQuestion;
  index: number;
  selectedChoiceIds: string[];
  answerState: boolean | null;
  onSelectionChange: (choiceIds: string[]) => void;
  onCheck: () => void;
}) {
  const hasAnswerKey = question.correctChoiceIds.length > 0;

  function toggleChoice(choiceId: string, selected: boolean) {
    onSelectionChange(
      question.selectionMode === "single"
        ? selected
          ? [choiceId]
          : []
        : selected
          ? [...selectedChoiceIds, choiceId]
          : selectedChoiceIds.filter((id) => id !== choiceId),
    );
  }

  const questionImage = safeImageSource(question.imageSrc);

  return (
    <section
      aria-labelledby={`quiz-question-${question.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--course-primary, #2f5f9f)" }}>
        Question {index + 1}
      </p>
      <h2
        id={`quiz-question-${question.id}`}
        className="mt-2 text-xl font-semibold leading-snug text-slate-900"
      >
        {question.prompt || "Question prompt"}
      </h2>
      {questionImage && (
        <PreviewImage
          src={questionImage}
          alt={question.imageAlt}
          className="mt-4 max-h-[420px] w-auto rounded-xl object-contain"
        />
      )}
      <fieldset className="mt-5 space-y-3">
        <legend className="sr-only">
          {question.selectionMode === "single"
            ? "Choose one answer"
            : "Choose all answers that apply"}
        </legend>
        {question.choices.map((choice, choiceIndex) => {
          const choiceImage = safeImageSource(choice.imageSrc);
          return (
            <div
              key={choice.id}
              className="rounded-xl transition-colors"
              style={selectedChoiceIds.includes(choice.id) ? { backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 9%, white)" } : undefined}
            >
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm">
                <input
                  type={
                    question.selectionMode === "single" ? "radio" : "checkbox"
                  }
                  name={`answer-${question.id}`}
                  value={choice.id}
                  checked={selectedChoiceIds.includes(choice.id)}
                  onChange={(event) =>
                    toggleChoice(choice.id, event.target.checked)
                  }
                  className="mt-0.5 size-4 shrink-0"
                  style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
                />
                <span className="min-w-0 flex-1">
                  {choice.text || (
                    <span className="text-slate-400">
                      Answer {choiceIndex + 1}
                    </span>
                  )}
                </span>
              </label>
              {choiceImage && (
                <div className="pb-3 pl-11 pr-4">
                  <PreviewImage
                    src={choiceImage}
                    alt={choice.imageAlt}
                    className="max-h-56 w-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      <Button
        type="button"
        onClick={onCheck}
        disabled={!selectedChoiceIds.length || !hasAnswerKey}
        className="mt-5"
        style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
      >
        Check answer
      </Button>
      {!hasAnswerKey && (
        <p role="status" className="mt-3 text-sm text-amber-700">
          The answer key has not been set for this question.
        </p>
      )}
      {answerState !== null && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${answerState ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
        >
          {answerState
            ? question.correctFeedback || "Correct!"
            : question.incorrectFeedback ||
              "That answer is not correct. Try again."}
        </p>
      )}
    </section>
  );
}
