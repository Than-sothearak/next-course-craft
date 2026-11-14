// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorDraft, type Draft } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-draft";
import { changeCourseNavigationMode } from "@/lib/editor/progress-settings";
import { consumeDashboardRefreshPending } from "@/lib/editor/dashboard-refresh";
import { blockSchema } from "@/lib/schemas/block";

const initialDraft: Draft = {
  title: "Original course", description: "", authorVisible: true,
  theme: { preset: "ocean", primaryColor: "#2f5f9f", accentColor: "#ff876c", fontFamily: "sans" },
  navigationMode: "sequential", sections: [{ id: "section", title: "Learn", order: 0 }], lessons: [],
};
let root: Root;
let container: HTMLDivElement;
let editor: ReturnType<typeof useEditorDraft>;
let navigate: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let titleValidRef: { current: boolean };

function Harness() {
  const current = useEditorDraft({ initialDraft, initialRevision: 7, courseId: "course", titleValid: titleValidRef.current, titleValidRef, onNavigate: navigate });
  useEffect(() => { editor = current; });
  return null;
}
const saved = (revision: number) => new Response(JSON.stringify({ revision }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchMock = vi.fn(); navigate = vi.fn(); titleValidRef = { current: true };
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("editor draft persistence", () => {
  it("changes navigation and all block requirements in one undoable autosave", async () => {
    const block = blockSchema.parse({ id: "check", version: 1, type: "knowledgeCheck", requiredForProgress: false, data: { question: "Ready?", options: ["Yes", "No"] } });
    fetchMock.mockResolvedValue(saved(8));
    act(() => editor.updateDraft((draft) => ({ ...draft, lessons: [{ id: "lesson", sectionId: "section", title: "Lesson", order: 0, lessonType: "content", quizQuestions: [], blocks: [block] }] })));
    act(() => editor.updateDraft((draft) => changeCourseNavigationMode(draft, "restricted")));
    expect(editor.draft.lessons[0].blocks[0].requiredForProgress).toBe(true);
    act(() => editor.undo());
    expect(editor.draft.navigationMode).toBe("sequential");
    expect(editor.draft.lessons[0].blocks[0].requiredForProgress).toBe(false);
    act(() => editor.redo());
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ navigationMode: "restricted", lessons: [{ blocks: [{ requiredForProgress: true }] }] });
  });
  it("serializes overlapping edits and saves the latest draft with the returned revision", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; })).mockResolvedValueOnce(saved(9));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "First edit" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Latest edit" })));
    await act(async () => { finish(saved(8)); });
    expect(editor.hasUnsavedChanges).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ title: "First edit", revision: 7 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ title: "Latest edit", revision: 8 });
    expect(editor.hasUnsavedChanges).toBe(false);
  });

  it("signals the dashboard only after a successful autosave", async () => {
    fetchMock.mockResolvedValue(saved(8));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Updated course" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(consumeDashboardRefreshPending()).toBe(true);
    expect(consumeDashboardRefreshPending()).toBe(false);
  });

  it("reconciles cancelled lesson removals before later autosaves", async () => {
    const pending = { id: "pending", sectionId: "section", title: "Pending", order: 0, icon: "file" as const, lessonType: "content" as const, passingScore: 70, quizQuestions: [], blocks: [] };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...initialDraft, revision: 8 })));
    act(() => editor.updateDraft((draft) => ({ ...draft, lessons: [pending] })));
    await act(async () => editor.synchronizeServerSnapshot(["pending"]));
    expect(editor.draft.lessons).toEqual([]);
    expect(editor.hasUnsavedChanges).toBe(false);

    fetchMock.mockResolvedValueOnce(saved(9));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "After cancellation" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    const savedSnapshot = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(savedSnapshot.revision).toBe(8);
    expect(savedSnapshot.lessons).toEqual([]);
  });

  it("reports an empty course response clearly during cancellation sync", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(editor.synchronizeServerSnapshot(["pending"])).rejects.toThrow(
      "Could not synchronize the cancelled course lessons (request failed with status 500).",
    );
  });

  it("preserves local changes and stops autosave after a revision conflict", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Changed by a teammate." }), { status: 409 }));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Keep local changes" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(editor.saveState).toBe("conflict");
    expect(editor.saveMessage).toBe("Changed by a teammate.");
    expect(editor.draft.title).toBe("Keep local changes");
    await act(async () => { await editor.saveLatest(); await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(editor.hasUnsavedChanges).toBe(true);
  });

  it("waits for a successful save before returning to the course editor", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    act(() => editor.updateDraft((draft) => ({ ...draft, description: "Unsaved description" })));
    act(() => editor.openRouteAfterSave("/courses/course/edit/standard-mode"));
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { finish(saved(8)); });
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/courses/course/edit/standard-mode");
  });

  it("does not save an invalid title and can save after the title is corrected", async () => {
    titleValidRef.current = false;
    fetchMock.mockResolvedValue(saved(8));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(fetchMock).not.toHaveBeenCalled();
    titleValidRef.current = true;
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Valid title" })));
    await act(async () => { await editor.saveLatest(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(editor.saveState).toBe("saved");
  });

  it("tracks undo and redo relative to the last saved draft without mutating it", () => {
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Changed title" })));
    expect(editor.canUndo).toBe(true);
    act(() => editor.undo());
    expect(editor.draft.title).toBe("Original course");
    expect(editor.hasUnsavedChanges).toBe(false);
    expect(editor.canRedo).toBe(true);
    act(() => editor.redo());
    expect(editor.draft.title).toBe("Changed title");
    expect(initialDraft.title).toBe("Original course");
    expect(editor.hasUnsavedChanges).toBe(true);
  });
  it("serializes generated lesson saves and preserves edits typed while they finish", async () => {
    let finish!: (value: { editor: Draft & { revision: number } }) => void;
    let pending!: Promise<{ editor: Draft & { revision: number } }>;
    const generated = { ...initialDraft, lessons: [{ id: "lesson", sectionId: "section", title: "Generated lesson", lessonType: "content" as const, order: 0, quizQuestions: [], blocks: [] }] };
    await act(async () => {
      pending = editor.runServerMutation((revision) => { expect(revision).toBe(7); return new Promise((resolve) => { finish = resolve; }); });
    });
    act(() => editor.updateDraft((draft) => ({ ...draft, description: "Typed during lesson save" })));
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { finish({ editor: { ...generated, revision: 8 } }); await pending; });
    expect(editor.draft.lessons).toHaveLength(1);
    expect(editor.draft.description).toBe("Typed during lesson save");
    fetchMock.mockResolvedValue(saved(9));
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ revision: 8, description: "Typed during lesson save", lessons: generated.lessons });
    expect(editor.hasUnsavedChanges).toBe(false);
  });

  it("recovers the database revision after a lost generation save response", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...initialDraft, revision: 8, description: "Saved generated update" })));
    await act(async () => { await expect(editor.runServerMutation(async () => { throw new Error("Response lost"); })).rejects.toThrow("Response lost"); });
    expect(editor.draft.description).toBe("Saved generated update");
    fetchMock.mockResolvedValueOnce(saved(9));
    act(() => editor.updateDraft((draft) => ({ ...draft, title: "Author title" })));
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ revision: 8, title: "Author title" });
  });

  it("waits for an in-flight generated save before navigating to another lesson", async () => {
    let finish!: (value: { editor: Draft & { revision: number } }) => void;
    let pending!: Promise<{ editor: Draft & { revision: number } }>;
    await act(async () => { pending = editor.runServerMutation(() => new Promise((resolve) => { finish = resolve; })); });
    act(() => editor.openRouteAfterSave("/courses/course/edit/standard-mode/lessons/saved-lesson"));
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { finish({ editor: { ...initialDraft, revision: 8 } }); await pending; });
    expect(navigate).toHaveBeenCalledWith("/courses/course/edit/standard-mode/lessons/saved-lesson");
  });

});
