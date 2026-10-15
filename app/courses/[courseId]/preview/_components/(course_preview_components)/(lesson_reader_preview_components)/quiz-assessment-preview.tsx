"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import {
  evaluateQuizAttempt,
  isQuizAnswerCorrect,
  type QuizAnswers,
  type QuizAttemptResult,
} from "@/lib/interactive/quiz-assessment";
import { QuizQuestionPreview } from "./(quiz_assessment_preview_components)/quiz-question-preview";
export function QuizAssessmentPreview({
  questions,
  passingScore,
  savedScore,
  wasPassed,
  onResult,
}: {
  questions: QuizQuestion[];
  passingScore: number;
  savedScore?: number;
  wasPassed: boolean;
  onResult: (result: QuizAttemptResult) => void;
}) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [gradedAnswers, setGradedAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const activeQuestion = questions[activeQuestionIndex];

  function updateAnswer(questionId: string, choiceIds: string[]) {
    setAnswers((previous) => ({ ...previous, [questionId]: choiceIds }));
    setGradedAnswers((previous) => {
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
    setResult(null);
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
      }
    }
  }

  function retry() {
    setActiveQuestionIndex(0);
    setAnswers({});
    setGradedAnswers({});
    setResult(null);
  }

  return (
    <div className="mx-auto mt-10 mb-16 w-full min-w-0 max-w-[720px] shrink-0 space-y-6 px-4">
      {wasPassed && result === null && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Quiz passed{savedScore === undefined ? "." : ` · Best score ${savedScore}%.`}
        </p>
      )}
      {!wasPassed && savedScore !== undefined && result === null && (
        <p className="text-sm text-slate-500">Best score: {savedScore}%</p>
      )}
      <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-500">
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
      </div>
      {activeQuestion && (
        <QuizQuestionPreview
          key={activeQuestion.id}
          question={activeQuestion}
          index={activeQuestionIndex}
          selectedChoiceIds={answers[activeQuestion.id] ?? []}
          answerState={gradedAnswers[activeQuestion.id] ?? null}
          onSelectionChange={(choiceIds) => updateAnswer(activeQuestion.id, choiceIds)}
          onCheck={() => checkQuestion(activeQuestion)}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={activeQuestionIndex === 0}
          onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
        >
          Previous question
        </Button>
        {activeQuestionIndex < questions.length - 1 && (
          <Button
            type="button"
            onClick={() => setActiveQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
            disabled={!activeQuestion || gradedAnswers[activeQuestion.id] === undefined}
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
          >
            Next question
          </Button>
        )}
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
