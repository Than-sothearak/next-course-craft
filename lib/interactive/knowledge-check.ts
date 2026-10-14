export type KnowledgeCheckResult = {
  correct: boolean;
  feedback: string;
};

export function evaluateKnowledgeCheckAnswer({
  selectedOptionIndex,
  correctOptionIndex,
  correctFeedback,
  incorrectFeedback,
}: {
  selectedOptionIndex: number | null;
  correctOptionIndex: number;
  correctFeedback: string;
  incorrectFeedback: string;
}): KnowledgeCheckResult | null {
  if (selectedOptionIndex === null) return null;

  const correct = selectedOptionIndex === correctOptionIndex;
  const configuredFeedback = correct ? correctFeedback : incorrectFeedback;
  return {
    correct,
    feedback: configuredFeedback.trim() || (correct ? "Correct!" : "Not quite. Try again."),
  };
}
