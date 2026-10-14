import { describe, expect, it } from "vitest";
import { evaluateQuizAttempt, isQuizAnswerCorrect, validateQuizAssessments } from "../lib/interactive/quiz-assessment";
import type { QuizQuestion } from "../lib/schemas/quiz";

const questions: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "Pick one",
    imageSrc: "",
    imageAlt: "",
    selectionMode: "single",
    choices: [
      { id: "a", text: "A", imageSrc: "", imageAlt: "" },
      { id: "b", text: "B", imageSrc: "", imageAlt: "" },
    ],
    correctChoiceIds: ["a"],
    correctFeedback: "Correct",
    incorrectFeedback: "Try again",
  },
  {
    id: "q2",
    prompt: "Pick both",
    imageSrc: "",
    imageAlt: "",
    selectionMode: "multiple",
    choices: [
      { id: "c", text: "C", imageSrc: "", imageAlt: "" },
      { id: "d", text: "D", imageSrc: "", imageAlt: "" },
      { id: "e", text: "E", imageSrc: "", imageAlt: "" },
    ],
    correctChoiceIds: ["c", "d"],
    correctFeedback: "Correct",
    incorrectFeedback: "Try again",
  },
];

describe("quiz assessment grading", () => {
  it("scores single and multiple choice answers by exact answer set", () => {
    expect(isQuizAnswerCorrect(questions[1], ["d", "c"])).toBe(true);
    expect(isQuizAnswerCorrect(questions[1], ["c"])).toBe(false);
    expect(isQuizAnswerCorrect(questions[1], ["c", "d", "e"])).toBe(false);
  });

  it("applies the author passing score and returns a percentage", () => {
    expect(evaluateQuizAttempt(questions, { q1: ["a"], q2: ["c", "d"] }, 90)).toEqual({
      correctCount: 2,
      questionCount: 2,
      score: 100,
      passingScore: 90,
      passed: true,
    });
    expect(evaluateQuizAttempt(questions, { q1: ["a"], q2: ["c"] }, 70)).toMatchObject({ score: 50, passed: false });
  });

  it("does not grade incomplete questions or quizzes without answer keys", () => {
    expect(evaluateQuizAttempt(questions, { q1: ["a"] })).toBeNull();
    expect(evaluateQuizAttempt([{ ...questions[0], correctChoiceIds: [] }], { q1: ["a"] })).toBeNull();
    expect(evaluateQuizAttempt([], {})).toBeNull();
  });

  it("blocks publishing an assessment until every question can be graded", () => {
    expect(validateQuizAssessments([{ title: "Final quiz", lessonType: "quiz", quizQuestions: questions }])).toBeNull();
    expect(validateQuizAssessments([{ title: "Final quiz", lessonType: "quiz", quizQuestions: [] }])).toContain("needs at least one question");
    expect(validateQuizAssessments([{ title: "Final quiz", lessonType: "quiz", quizQuestions: [{ ...questions[0], correctChoiceIds: [] }] }])).toContain("needs at least one correct answer");
    expect(validateQuizAssessments([{ title: "Reading", lessonType: "content", quizQuestions: [] }])).toBeNull();
  });
});
