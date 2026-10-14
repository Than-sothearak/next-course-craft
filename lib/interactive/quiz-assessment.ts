import type { QuizQuestion } from "@/lib/schemas/quiz";

export type QuizAnswers = Record<string, string[]>;

export type QuizAttemptResult = {
  correctCount: number;
  questionCount: number;
  score: number;
  passingScore: number;
  passed: boolean;
};

export function validateQuizAssessments(
  lessons: readonly {
    title: string;
    lessonType?: string;
    quizQuestions?: readonly QuizQuestion[];
  }[],
) {
  for (const lesson of lessons) {
    if (lesson.lessonType !== "quiz") continue;
    if (!lesson.quizQuestions?.length) return `Quiz "${lesson.title}" needs at least one question before publishing.`;
    for (const [index, question] of lesson.quizQuestions.entries()) {
      const questionName = `Question ${index + 1} in "${lesson.title}"`;
      if (typeof question.prompt !== "string" || !question.prompt.trim()) return `${questionName} needs a prompt before publishing.`;
      if (!Array.isArray(question.correctChoiceIds) || !question.correctChoiceIds.length) return `${questionName} needs at least one correct answer before publishing.`;
      if (!Array.isArray(question.choices) || question.choices.some((choice) => {
        const hasText = typeof choice.text === "string" && choice.text.trim();
        const hasImage = typeof choice.imageSrc === "string" && choice.imageSrc.trim();
        return !hasText && !hasImage;
      })) {
        return `${questionName} has an answer choice without text or an image.`;
      }
    }
  }
  return null;
}

export function isQuizAnswerCorrect(
  question: QuizQuestion,
  selectedChoiceIds: readonly string[],
) {
  if (!question.correctChoiceIds.length || !selectedChoiceIds.length) return false;
  const selected = new Set(selectedChoiceIds);
  const correct = new Set(question.correctChoiceIds);
  return selected.size === correct.size && [...selected].every((id) => correct.has(id));
}

export function evaluateQuizAttempt(
  questions: readonly QuizQuestion[],
  answers: QuizAnswers,
  requestedPassingScore = 70,
): QuizAttemptResult | null {
  if (!questions.length) return null;
  if (questions.some((question) => !question.correctChoiceIds.length || !answers[question.id]?.length)) return null;

  const correctCount = questions.filter((question) =>
    isQuizAnswerCorrect(question, answers[question.id] ?? []),
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passingScore = Math.max(0, Math.min(100, Math.round(requestedPassingScore)));

  return {
    correctCount,
    questionCount: questions.length,
    score,
    passingScore,
    passed: score >= passingScore,
  };
}
