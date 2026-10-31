// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuizAssessmentPreview } from "../app/courses/[courseId]/preview/course-preview";
import type { QuizAttemptResult } from "../lib/interactive/quiz-assessment";
import type { QuizQuestion } from "../lib/schemas/quiz";

let container: HTMLDivElement;
let root: Root;

const question: QuizQuestion = {
  id: "question-1",
  prompt: "Which answer is correct?",
  imageSrc: "",
  imageAlt: "",
  selectionMode: "single",
  choices: [
    { id: "choice-a", text: "Correct answer", imageSrc: "", imageAlt: "" },
    { id: "choice-b", text: "Incorrect answer", imageSrc: "", imageAlt: "" },
  ],
  correctChoiceIds: ["choice-a"],
  correctFeedback: "Correct feedback.",
  incorrectFeedback: "Try once more.",
};

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
});

describe("learner quiz assessment", () => {
  it("shows a failed score, lets the learner retry, and records a passing result", () => {
    const results: QuizAttemptResult[] = [];
    act(() => root.render(createElement(QuizAssessmentPreview, {
      questions: [question],
      passingScore: 80,
      onResult: (result: QuizAttemptResult) => results.push(result),
      wasPassed: false,
    })));

    const answerContainer = container.querySelector<HTMLInputElement>('input[value="choice-a"]')?.closest("label")?.parentElement;
    expect(answerContainer?.className.split(" ")).not.toContain("border");

    const checkAnswer = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Check answer")!;
    act(() => container.querySelector<HTMLInputElement>('input[value="choice-b"]')!.click());
    act(() => checkAnswer().click());
    expect(container.querySelector('dialog[open]')?.textContent).toContain("Keep trying");
    expect(container.querySelector('dialog[open]')?.textContent).toContain("0 of 1 correct");
    expect(container.textContent).toContain("Keep trying");
    expect(container.textContent).toContain("Score: 0% (0 of 1 correct)");
    expect(container.textContent).toContain("Try once more.");

    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Try again")!.click());
    act(() => container.querySelector<HTMLInputElement>('input[value="choice-a"]')!.click());
    act(() => checkAnswer().click());
    expect(container.querySelector('dialog[open]')?.textContent).toContain("Congratulations!");
    expect(container.textContent).toContain("Assessment passed");
    expect(container.textContent).toContain("Score: 100% (1 of 1 correct)");
    expect(results.map((result) => result.passed)).toEqual([false, true]);
  });

  it("shows one question at a time and unlocks the next after checking the answer", () => {
    const secondQuestion: QuizQuestion = {
      ...question,
      id: "question-2",
      prompt: "What comes next?",
    };
    const results: QuizAttemptResult[] = [];
    act(() => root.render(createElement(QuizAssessmentPreview, {
      questions: [question, secondQuestion],
      passingScore: 50,
      onResult: (result: QuizAttemptResult) => results.push(result),
      wasPassed: false,
    })));

    expect(container.textContent).toContain("Question 1 of 2");
    expect(container.textContent).toContain("Which answer is correct?");
    expect(container.textContent).not.toContain("What comes next?");
    const actionRow = container.querySelector('[data-quiz-actions]')!;
    const nextButton = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Next question")!;
    const checkButton = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Check answer")!;
    expect(checkButton().parentElement).toBe(actionRow);
    expect(checkButton().disabled).toBe(true);
    expect(nextButton()).toBeUndefined();

    act(() => container.querySelector<HTMLInputElement>('input[value="choice-a"]')!.click());
    act(() => checkButton().click());
    expect(nextButton().parentElement).toBe(actionRow);
    expect(checkButton()).toBeUndefined();
    act(() => nextButton().click());

    expect(container.textContent).toContain("Question 2 of 2");
    expect(container.textContent).toContain("What comes next?");
    expect(container.textContent).not.toContain("Which answer is correct?");
    expect(checkButton().parentElement).toBe(actionRow);
    act(() => container.querySelector<HTMLInputElement>('input[value="choice-b"]')!.click());
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Check answer")!.click());

    expect(container.textContent).toContain("Score: 50% (1 of 2 correct)");
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });
});
