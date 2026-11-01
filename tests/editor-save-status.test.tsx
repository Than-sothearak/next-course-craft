/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { EditorSaveStatus } from "@/app/courses/[courseId]/edit/_components/_components/editor-save-status";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" },
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "first", sectionId: "section", title: "First", order: 0, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Save state", level: 2 }, slideFrame: { x: 10, y: 20, width: 40, height: 30, z: 0 }, slideTextLayout: { fitToText: false } }] }],
}) };
const response = (status = 200) => new Response(JSON.stringify(status === 200 ? { revision: 2 } : { error: "The course could not be saved." }), { status });

describe("editor navbar save status", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    fetchMock = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const status = () => container.querySelector<HTMLElement>("[data-editor-save-status]")!;
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  async function edit() {
    await act(async () => button("Select heading object from layers").click());
    const field = container.querySelector<HTMLInputElement>('[aria-label="Left (px)"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "120"); field.dispatchEvent(new Event("input", { bubbles: true })); });
  }

  it("shows saved, pending and active saving states inside the navbar until the request completes", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    await render();
    expect(status().closest("header[data-presentation-editor-header]")).not.toBeNull();
    expect(status().dataset.editorSaveStatus).toBe("saved"); expect(status().title).toBe("All changes saved");
    await edit();
    expect(status().dataset.editorSaveStatus).toBe("pending"); expect(status().textContent).toBe("Unsaved changes");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(status().dataset.editorSaveStatus).toBe("saving"); expect(status().getAttribute("aria-busy")).toBe("true");
    expect(status().querySelector("svg")?.classList.contains("animate-spin")).toBe(true);
    await act(async () => finish(response()));
    expect(status().dataset.editorSaveStatus).toBe("saved"); expect(status().getAttribute("aria-busy")).toBe("false");
    expect(container.querySelectorAll("[data-editor-save-status]")).toHaveLength(1);
  });

  it.each([500, 409])("shows a save problem for HTTP %s with the existing recovery action", async (code) => {
    fetchMock.mockResolvedValueOnce(response(code));
    await render(); await edit(); await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(status().dataset.editorSaveStatus).toBe(code === 409 ? "conflict" : "error");
    expect(status().title).toContain("The course could not be saved.");
    expect(status().querySelector("svg")?.classList.contains("animate-spin")).toBe(false);
    const action = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === (code === 409 ? "Reload course" : "Retry save"));
    expect(action).toBeDefined();
    if (code === 500) {
      await act(async () => action!.click());
      expect(status().dataset.editorSaveStatus).toBe("saved");
    } else {
      await act(async () => vi.advanceTimersByTimeAsync(2000)); expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps one save indicator in the navbar when opening presentation settings", async () => {
    await render(); await act(async () => button("Presentation settings").click());
    expect(status().closest("header")).not.toBeNull(); expect(container.querySelectorAll("[data-editor-save-status]")).toHaveLength(1);
    expect(status().classList.contains("fixed")).toBe(false);
  });

  it("reports invalid titles and pending edits instead of showing a saved check", async () => {
    await act(async () => root.render(<EditorSaveStatus saveState="saved" hasUnsavedChanges={false} validationMessage="Check course title" />));
    expect(status().dataset.editorSaveStatus).toBe("invalid"); expect(status().textContent).toBe("Check course title");
    await act(async () => root.render(<EditorSaveStatus saveState="saved" hasUnsavedChanges />));
    expect(status().dataset.editorSaveStatus).toBe("pending"); expect(status().textContent).toBe("Unsaved changes");
  });
});
