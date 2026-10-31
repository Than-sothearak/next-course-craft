import { createClientId } from "@/lib/client-id";
import type { QuizChoice, QuizQuestion } from "@/lib/schemas/quiz";

export function createQuizChoice(): QuizChoice {
  return { id: createClientId(), text: "", imageSrc: "", imageAlt: "" };
}

export function createQuizQuestion(): QuizQuestion {
  return {
    id: createClientId(), prompt: "", imageSrc: "", imageAlt: "", selectionMode: "single",
    choices: [createQuizChoice(), createQuizChoice()], correctChoiceIds: [],
    correctFeedback: "", incorrectFeedback: "",
  };
}
