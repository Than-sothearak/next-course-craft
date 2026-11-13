/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreviewRoute } from "@/app/courses/[courseId]/preview/course-preview-route";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction, actions }: { primaryAction: ReactNode; actions: ReactNode }) => <header>{actions}{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialData = { courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout: "standard", sections: [{ id: "section", title: "Section", order: 0 }], lessons: [
  { id: "first", sectionId: "section", title: "First lesson", order: 0, blocks: [] },
  { id: "second", sectionId: "section", title: "Current lesson", order: 1, blocks: [] },
  { id: "quiz", sectionId: "section", title: "Current quiz", order: 2, lessonType: "quiz", blocks: [], quizQuestions: [] },
] }) };

describe("editor previews the current lesson", () => {
  let root: Root, container: HTMLDivElement;
  const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ revision: 2 })));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  });
  const preview = () => container.querySelector<HTMLButtonElement>('[aria-label="Preview"]')!;

  it.each(["Preview", "Back"])("confirms %s while lesson generation is unfinished before starting navigation", async (label) => {
    const session = {
      id: "session", status: "generating", error: "Retry needed", completedLessonIds: [], currentLessonId: "first", readyToSave: false,
      input: courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 2, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" }),
      outline: { title: "Course", description: "", sections: [{ id: "section", title: "Section", lessons: [{ id: "first", title: "First lesson", objective: "Teach HTML", kind: "learn" }] }] },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.endsWith("/generation-session") ? session : { revision: 2 })));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" permissions={["ai.generate"]} />));
    const button = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
    await act(async () => button.click());
    expect(confirm).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => button.click());
    expect(push).toHaveBeenCalledExactlyOnceWith(label === "Preview" ? "/courses/course/preview/standard-mode" : "/dashboard");
  });

  it.each(["second", "quiz"])("opens the Standard lesson being edited (%s) directly in preview", async (lessonId) => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" focusedLessonId={lessonId} />));
    await act(async () => preview().click());
    expect(push).toHaveBeenCalledExactlyOnceWith(`/courses/course/preview/standard-mode?lessonId=${lessonId}`);
    const target = new URL(push.mock.calls[0][0], "https://example.test").searchParams.get("lessonId")!;
    await act(async () => root.render(<CoursePreviewRoute initialData={initialData} authorName="Author" initialLessonId={target} />));
    expect(container.querySelector(`#preview-content-${lessonId}`)?.getAttribute("aria-hidden")).toBe("false");
    expect(container.querySelector("#preview-content-first")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the course overview preview when no lesson is being edited", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await act(async () => preview().click());
    expect(push).toHaveBeenCalledExactlyOnceWith("/courses/course/preview/standard-mode");
  });

  it("saves pending changes before opening the same lesson's preview", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" focusedLessonId="second" />));
    const title = container.querySelector<HTMLElement & { editor: Editor }>('[contenteditable="true"][aria-label="Lesson title"]')!;
    await act(async () => title.editor.commands.setContent("<h1>Updated current lesson</h1>"));
    await act(async () => preview().click());
    expect(push).not.toHaveBeenCalled();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).lessons[1].title).toBe("Updated current lesson");
    await act(async () => finish(Response.json({ revision: 2 })));
    expect(push).toHaveBeenCalledExactlyOnceWith("/courses/course/preview/standard-mode?lessonId=second");
  });

  it("retains presentation preview navigation to the active slide", async () => {
    await act(async () => root.render(<EditorClient initialData={{ ...initialData, courseLayout: "slides" }} authorName="Author" initialPresentationLessonId="second" />));
    await act(async () => preview().click());
    expect(push).toHaveBeenCalledExactlyOnceWith("/courses/course/preview/presentation-mode?lessonId=second");
  });
});
