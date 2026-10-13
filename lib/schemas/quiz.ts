import { z } from "zod";

export const quizChoiceSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().max(500).default(""),
  imageSrc: z.string().max(2_048).default(""),
  imageAlt: z.string().max(500).default(""),
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  prompt: z.string().max(2_000).default(""),
  imageSrc: z.string().max(2_048).default(""),
  imageAlt: z.string().max(500).default(""),
  selectionMode: z.enum(["single", "multiple"]).default("single"),
  choices: z.array(quizChoiceSchema).min(2).max(8),
  correctChoiceIds: z.array(z.string().min(1).max(64)).max(8).default([]),
  correctFeedback: z.string().max(2_000).default(""),
  incorrectFeedback: z.string().max(2_000).default(""),
}).superRefine((question, context) => {
  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  if (choiceIds.size !== question.choices.length) {
    context.addIssue({ code: "custom", path: ["choices"], message: "Answer choice identifiers must be unique." });
  }
  const correctIds = new Set(question.correctChoiceIds);
  if (correctIds.size !== question.correctChoiceIds.length || question.correctChoiceIds.some((id) => !choiceIds.has(id))) {
    context.addIssue({ code: "custom", path: ["correctChoiceIds"], message: "Choose valid, unique correct answers." });
  }
  if (question.selectionMode === "single" && question.correctChoiceIds.length > 1) {
    context.addIssue({ code: "custom", path: ["correctChoiceIds"], message: "A single-choice question can have only one correct answer." });
  }
});

export const quizQuestionsSchema = z.array(quizQuestionSchema).max(100).superRefine((questions, context) => {
  const ids = new Set(questions.map((question) => question.id));
  if (ids.size !== questions.length) {
    context.addIssue({ code: "custom", message: "Question identifiers must be unique." });
  }
});

export type QuizChoice = z.infer<typeof quizChoiceSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
