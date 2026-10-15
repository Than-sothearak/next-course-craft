/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "../app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "../lib/editor/schemas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn(), forward: vi.fn() }) }));
vi.mock("../app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1,
  sections: [{ id: "a", title: "Pre Activities", order: 0 }, { id: "b", title: "Learn", order: 1 }, { id: "c", title: "Post Activities", order: 2 }],
  lessons: [{ id: "lesson", sectionId: "a", title: "Introduction", order: 0, blocks: [{ id: "block", version: 1, type: "richText", data: { html: "<p>Original content</p>" } }] }, { id: "destination", sectionId: "b", title: "Existing lesson", order: 0, blocks: [] }],
}) };

describe("course outline editing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
  const sourceMenu = () => container.querySelector('[aria-label="Content actions for Introduction"]')!.closest("details")!;

  it("duplicates and saves content without routing away from the course outline", async () => {
    await render();
    const menu = sourceMenu();
    menu.open = true;
    const duplicate = Array.from(menu.querySelectorAll("button")).find((button) => button.textContent === "Duplicate content")!;
    await act(async () => duplicate.click());
    expect(menu.open).toBe(false);
    expect(container.querySelector('[aria-label="Content actions for Introduction copy"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Course title"]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    const snapshot = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(editorSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const copy = snapshot.lessons.find((lesson: { title: string }) => lesson.title === "Introduction copy");
    expect(copy.sectionId).toBe("a");
    expect(copy.id).not.toBe("lesson");
    expect(copy.blocks[0].id).not.toBe("block");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(push).not.toHaveBeenCalled();
  });

  it("moves content to another section and saves the updated order without routing", async () => {
    await render();
    const menu = sourceMenu();
    menu.open = true;
    const select = menu.querySelector<HTMLSelectElement>('[aria-label="Move Introduction to section"]')!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "b", "c"]);
    await act(async () => { select.value = "b"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const movedMenu = sourceMenu();
    expect(movedMenu.closest("section")?.querySelector<HTMLInputElement>('[aria-label="Section title"]')?.value).toBe("Learn");
    expect(movedMenu.closest("section")?.textContent).toContain("Existing lesson");
    const snapshot = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(editorSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.lessons.find((lesson: { id: string }) => lesson.id === "lesson")).toMatchObject({ sectionId: "b", order: 1, blocks: initialData.lessons[0].blocks });
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Course title"]')).not.toBeNull();
  });
});
