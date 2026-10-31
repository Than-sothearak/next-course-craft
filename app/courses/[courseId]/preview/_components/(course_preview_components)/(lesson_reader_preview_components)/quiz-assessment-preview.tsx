"use client";

import { useState } from "react";
import { CircleAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import {
  evaluateQuizAttempt,
  isQuizAnswerCorrect,
  type QuizAnswers,
  type QuizAttemptResult,
} from "@/lib/interactive/quiz-assessment";
import { QuizQuestionPreview } from "./(quiz_assessment_preview_components)/quiz-question-preview";
import { QuizQuestionProgress } from "@/app/courses/[courseId]/_components/slide-presentation/quiz-question-progress";
import { useSlidePresentationContext } from "../../slide-presentation/slide-presentation-context";
export function QuizAssessmentPreview({
  questions,
  passingScore,
  savedScore,
  wasPassed,
  onResult,
  onAttemptFinishedChange,
  presentation = false,
}: {
  questions: QuizQuestion[];
  passingScore: number;
  savedScore?: number;
  wasPassed: boolean;
  onResult: (result: QuizAttemptResult) => void;
  onAttemptFinishedChange?: (finished: boolean) => void;
  presentation?: boolean;
}) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [gradedAnswers, setGradedAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const activeQuestion = questions[activeQuestionIndex];
  const slidePresentation = useSlidePresentationContext();
  const slideIndex = slidePresentation?.slides.findIndex((slide) => slide.id === slidePresentation.selectedId) ?? -1;
  const nextSlide = slideIndex >= 0 ? slidePresentation?.slides[slideIndex + 1] : undefined;
  const nextLock = nextSlide && slidePresentation ? slidePresentation.getLockMessage(nextSlide.id) : null;

  function updateAnswer(questionId: string, choiceIds: string[]) {
    onAttemptFinishedChange?.(false);
    setAnswers((previous) => ({ ...previous, [questionId]: choiceIds }));
    setGradedAnswers((previous) => {
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
    setResult(null);
    setResultDialogOpen(false);
  }

  function checkQuestion(question: QuizQuestion) {
    const answerState = isQuizAnswerCorrect(question, answers[question.id] ?? []);
    const nextGrades = { ...gradedAnswers, [question.id]: answerState };
    setGradedAnswers(nextGrades);
    if (questions.every((item) => Object.hasOwn(nextGrades, item.id))) {
      const attempt = evaluateQuizAttempt(questions, answers, passingScore);
      if (attempt) {
        setResult(attempt);
        onResult(attempt);
        onAttemptFinishedChange?.(true);
        setResultDialogOpen(true);
      }
    }
  }

  function retry() {
    setActiveQuestionIndex(0);
    setAnswers({});
    setGradedAnswers({});
    setResult(null);
    setResultDialogOpen(false);
    onAttemptFinishedChange?.(false);
  }

  return (
    <div data-presentation-quiz={presentation || undefined} className={`mx-auto w-full min-w-0 max-w-[720px] shrink-0 px-4 ${presentation ? "my-3 space-y-3" : "mt-10 mb-16 space-y-6"}`}>
      {result && <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} title={result.passed ? "Congratulations!" : "Keep trying"} className="max-w-md">
        <div className="text-center">
          <span className={`mx-auto mb-4 grid size-16 place-items-center rounded-full ${result.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {result.passed ? <Trophy size={31} aria-hidden="true" /> : <CircleAlert size={31} aria-hidden="true" />}
          </span>
          <p className="text-sm text-slate-600">{result.passed ? "You passed the quiz" : "You did not reach the passing score yet"}</p>
          <p className={`mt-2 text-5xl font-bold tabular-nums ${result.passed ? "text-emerald-700" : "text-rose-700"}`} aria-label={`Score ${result.score} percent`}>{result.score}%</p>
          <p className="mt-3 text-sm text-slate-600">{result.correctCount} of {result.questionCount} correct · Passing score {result.passingScore}%</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => setResultDialogOpen(false)}>Review quiz</Button>
            {result.passed ? nextSlide && slidePresentation && <Button type="button" disabled={Boolean(nextLock)} title={nextLock ?? undefined} onClick={() => { setResultDialogOpen(false); slidePresentation.onSelect(nextSlide.id); }}>Continue to next slide</Button> : <Button type="button" onClick={retry}>Try again</Button>}
          </div>
        </div>
      </Dialog>}
      {wasPassed && result === null && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Quiz passed{savedScore === undefined ? "." : ` · Best score ${savedScore}%.`}
        </p>
      )}
      {!wasPassed && savedScore !== undefined && result === null && (
        <p className="text-sm text-slate-500">Best score: {savedScore}%</p>
      )}
      {presentation ? <QuizQuestionProgress index={activeQuestionIndex} total={questions.length} passingScore={passingScore} /> : <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-500">
        <span>Question {activeQuestionIndex + 1} of {questions.length}</span>
        <div
          role="progressbar"
          aria-label="Quiz question progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={activeQuestionIndex + 1}
          className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full transition-[width]" style={{ width: `${((activeQuestionIndex + 1) / questions.length) * 100}%`, backgroundColor: "var(--course-primary, #2f5f9f)" }} />
        </div>
      </div>}
      {activeQuestion && (
        <QuizQuestionPreview
          key={activeQuestion.id}
          question={activeQuestion}
          index={activeQuestionIndex}
          selectedChoiceIds={answers[activeQuestion.id] ?? []}
          answerState={gradedAnswers[activeQuestion.id] ?? null}
          presentation={presentation}
          showCheckButton={false}
          onSelectionChange={(choiceIds) => updateAnswer(activeQuestion.id, choiceIds)}
          onCheck={() => checkQuestion(activeQuestion)}
        />
      )}
      <div data-quiz-actions className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={activeQuestionIndex === 0}
          onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
        >
          Previous question
        </Button>
        {activeQuestion && (gradedAnswers[activeQuestion.id] === undefined ? <Button
          type="button"
          className="min-w-32"
          onClick={() => checkQuestion(activeQuestion)}
          disabled={!answers[activeQuestion.id]?.length || !activeQuestion.correctChoiceIds.length}
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
        >Check answer</Button> : activeQuestionIndex < questions.length - 1 ? <Button
          type="button"
          className="min-w-32"
          onClick={() => setActiveQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
        >Next question</Button> : result ? <Button
          type="button"
          className="min-w-32"
          onClick={() => setResultDialogOpen(true)}
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
        >View results</Button> : null)}
      </div>
      {result && activeQuestionIndex === questions.length - 1 && (
        <section
          aria-live="polite"
          className={`rounded-2xl border p-5 sm:p-7 ${result.passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
        >
          <p className={`text-xl font-semibold ${result.passed ? "text-emerald-900" : "text-rose-900"}`}>
            {result.passed ? "Assessment passed" : "Keep trying"}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Score: {result.score}% ({result.correctCount} of {result.questionCount} correct). Passing score: {result.passingScore}%.
          </p>
          <Button type="button" onClick={retry} className="mt-4">
            {result.passed ? "Retake quiz" : "Try again"}
          </Button>
        </section>
      )}
    </div>
  );
}
