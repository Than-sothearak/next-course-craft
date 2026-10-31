/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "content", sectionId: "section", title: "Content", order: 0, blocks: [{ id: "text", version: 1, type: "richText", data: { html: "<p>Training</p>" } }] },
  { id: "quiz", sectionId: "section", title: "Quiz", order: 1, lessonType: "quiz", passingScore: 80, blocks: [], quizQuestions: [{ id: "q1", prompt: "Correct?", choices: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], correctChoiceIds: ["a"], correctFeedback: "Right", incorrectFeedback: "Wrong" }] },
] }) };

describe("duplicate presentation slide actions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const action = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const order = () => [...container.querySelectorAll<HTMLElement>('[data-sortable-slide]')].map((element) => element.dataset.sortableSlide);

  it("duplicates content and quiz slides beside their sources, selects the copies, and saves them", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await act(async () => action("Duplicate slide 1: Content").click());
    expect(order()).toHaveLength(3);
    expect(container.querySelector<HTMLButtonElement>('[aria-current="step"]')?.getAttribute("aria-label")).toBe("Edit slide 2: Content copy");
    await act(async () => action("Duplicate slide 3: Quiz").click());
    expect(order()).toHaveLength(4);
    expect(container.querySelector<HTMLButtonElement>('[aria-current="step"]')?.getAttribute("aria-label")).toBe("Edit slide 4: Quiz copy");
    await act(async () => action("Undo").click());
    expect(order()).toHaveLength(3);
    await act(async () => action("Redo").click());
    expect(order()).toHaveLength(4);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!;
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body));
    const sorted = [...snapshot.lessons].sort((a, b) => a.order - b.order);
    expect(sorted.map((lesson) => lesson.title)).toEqual(["Content", "Content copy", "Quiz", "Quiz copy"]);
    expect(sorted[1].blocks[0].id).not.toBe(sorted[0].blocks[0].id);
    expect(sorted[3].quizQuestions[0].correctChoiceIds).toEqual([sorted[3].quizQuestions[0].choices[0].id]);
    expect(sorted[3].quizQuestions[0].correctFeedback).toBe("Right");
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(order()).toHaveLength(4);
    expect(action("Duplicate slide 4: Quiz copy")).not.toBeNull();
  });
});
