// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorDraft, type Draft } from "@/app/courses/[courseId]/edit/_components/_components/use-editor-draft";

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
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("editor draft persistence", () => {
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

  it("waits for a successful save before navigating away", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    act(() => editor.updateDraft((draft) => ({ ...draft, description: "Unsaved description" })));
    act(() => editor.openRouteAfterSave("/courses/course/preview"));
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { finish(saved(8)); });
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/courses/course/preview");
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
});
