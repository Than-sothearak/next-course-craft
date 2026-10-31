/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }] }) };

describe("presentation quiz slides", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close; delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const clickText = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!; return editorSnapshotSchema.parse(JSON.parse(call[1].body)); }

  it("adds a quiz slide with Q1 and Q2, score and feedback, then restores the editor", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await clickText("Quiz slide");
    expect(container.querySelector('[aria-label="Presentation quiz editor"]')).not.toBeNull();
    expect(button("Edit quiz question 1")).not.toBeNull();
    await input("Slide title", "Knowledge check");
    await input("Quiz passing score percentage", "80");
    await input("Question 1 prompt", "What is the right answer?");
    await input("Question 1 choice 1 text", "Right");
    await input("Question 1 choice 2 text", "Wrong");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Mark choice 1 correct for question 1"]')!.click());
    await input("Correct answer feedback", "Well done.");
    await input("Incorrect answer feedback", "Try again.");
    await clickText("Add question");
    expect(button("Edit quiz question 2")).not.toBeNull();
    await input("Question 2 prompt", "Choose the second answer.");
    await input("Question 2 choice 1 text", "No");
    await input("Question 2 choice 2 text", "Yes");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Mark choice 2 correct for question 2"]')!.click());
    const snapshot = await saved();
    const quiz = snapshot.lessons.find((lesson) => lesson.lessonType === "quiz")!;
    expect(quiz).toMatchObject({ title: "Knowledge check", passingScore: 80, quizQuestions: [{ prompt: "What is the right answer?", correctFeedback: "Well done.", incorrectFeedback: "Try again." }, { prompt: "Choose the second answer." }] });
    expect(quiz.quizQuestions[0].correctChoiceIds).toEqual([quiz.quizQuestions[0].choices[0].id]);
    expect(quiz.quizQuestions[1].correctChoiceIds).toEqual([quiz.quizQuestions[1].choices[1].id]);
    await act(async () => root.render(<EditorClient key="quiz-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await act(async () => button("Edit slide 2: Knowledge check").click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Quiz passing score percentage"]')?.value).toBe("80");
    expect(button("Edit quiz question 2")).not.toBeNull();
  });

  it("uses the presentation card and existing pass score logic in learner preview", async () => {
    const snapshot = editorSnapshotSchema.parse({ ...initialData, lessons: [{ ...initialData.lessons[0], lessonType: "quiz", passingScore: 100, quizQuestions: [
      { id: "q1", prompt: "First?", choices: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], correctChoiceIds: ["a"], correctFeedback: "Correct one", incorrectFeedback: "Wrong one" },
      { id: "q2", prompt: "Second?", choices: [{ id: "c", text: "Yes" }, { id: "d", text: "No" }], correctChoiceIds: ["c"], correctFeedback: "Correct two", incorrectFeedback: "Wrong two" },
    ] }, { ...initialData.lessons[0], id: "after", title: "After quiz", order: 1 }] });
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
    expect(container.querySelector('[data-presentation-quiz]')).not.toBeNull();
    expect(container.textContent).toContain("Q1 of 2");
    expect(container.textContent).toContain("Pass at 100%");
    expect(container.querySelector('[data-navigation-button="next"]')).toBeNull();
    expect(container.querySelector('[data-navigation-button="previous"]')).toBeNull();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="b"]')!.click());
    await clickText("Check answer");
    expect(container.textContent).toContain("Wrong one");
    await clickText("Next question");
    expect(container.textContent).toContain("Q2 of 2");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="c"]')!.click());
    await clickText("Check answer");
    expect(container.textContent).toContain("Score: 50% (1 of 2 correct)");
    expect(container.textContent).toContain("Keep trying");
    expect(container.querySelector('dialog[open]')?.textContent).toContain("Keep trying");
    expect(container.querySelector('dialog[open]')?.textContent).toContain("50%");
    expect(container.querySelector<HTMLButtonElement>('[data-navigation-button="next"]')?.disabled).toBe(true);
    await clickText("Try again");
    expect(container.querySelector('[data-navigation-button="next"]')).toBeNull();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="a"]')!.click());
    await clickText("Check answer");
    await clickText("Next question");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="c"]')!.click());
    await clickText("Check answer");
    expect(container.textContent).toContain("Assessment passed");
    const celebration = container.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(celebration.textContent).toContain("Congratulations!");
    expect(celebration.textContent).toContain("100%");
    expect(celebration.textContent).toContain("2 of 2 correct");
    expect(container.querySelector<HTMLButtonElement>('[data-navigation-button="next"]')?.disabled).toBe(false);
    await clickText("Continue to next slide");
    expect(container.querySelector('[aria-label="Slide: After quiz"]')?.getAttribute("data-slide-active")).toBe("true");
  });

  it("hides the standard footer link during a quiz and restores it after a result", async () => {
    const snapshot = editorSnapshotSchema.parse({ ...initialData, courseLayout: "standard", navigationMode: "free", lessons: [
      { ...initialData.lessons[0], lessonType: "quiz", passingScore: 100, quizQuestions: [
        { id: "q1", prompt: "Choose one", choices: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], correctChoiceIds: ["a"] },
      ] },
      { ...initialData.lessons[0], id: "after", title: "After quiz", order: 1 },
    ] });
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "standard-quiz" }} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
    const footer = () => container.querySelector('nav[aria-label="Next section from content 1"]')!;
    expect(footer().querySelector("button")).toBeNull();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="b"]')!.click());
    await clickText("Check answer");
    expect(container.querySelector('dialog[open]')?.textContent).toContain("Keep trying");
    expect(footer().querySelector("button")?.textContent).toContain("After quiz");
    await clickText("Try again");
    expect(footer().querySelector("button")).toBeNull();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="a"]')!.click());
    await clickText("Check answer");
    expect(container.querySelector('dialog[open]')?.textContent).toContain("Congratulations!");
    expect(footer().querySelector("button")?.textContent).toContain("After quiz");
  });
});
