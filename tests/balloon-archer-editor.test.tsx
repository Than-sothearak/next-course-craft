/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { balloonArcherBlockSchema } from "@/lib/schemas/block";
import { BlockTemplatePicker } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/block-template-picker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const block = balloonArcherBlockSchema.parse({ id: "archer", version: 1, type: "balloonArcher", data: {} });
const initial = (courseLayout: "standard" | "slides") => ({ courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout, sections: [{ id: "section", title: "Games", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Play", order: 0, blocks: [block] }] }) });
describe("Balloon Archer authoring", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (label: string) => act(async () => { const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`); if (!button) throw new Error(`Missing ${label}: ${container.textContent}`); button.click(); });
  const textClick = (text: string) => act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!; return editorSnapshotSchema.parse(JSON.parse(call[1].body)); }
  it("appears in the Standard block picker", async () => {
    const select = vi.fn(); await act(async () => root.render(<BlockTemplatePicker open onClose={() => {}} onSelect={select} initialCategory="Interactive" />));
    const card = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Balloon Archer") && button.textContent.includes("Pull, aim"))!;
    await act(async () => card.click()); expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: "interactive-balloon-archer", type: "balloonArcher" }));
  });
  it.each(["standard", "slides"] as const)("edits balloons, colors and revealed text in %s, with undo, saving, and reload", async (layout) => {
    await act(async () => root.render(<EditorClient initialData={initial(layout)} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select balloonArcher object from layers"); else await click("Open content settings");
    await input("Balloon Archer title", "Discover science"); await input("Balloon 1 word", "Gravity"); await input("Balloon 1 revealed text", "Gravity attracts objects toward each other.");
    await input("Balloon 1 left position", "35"); await input("Balloon 1 top position", "28"); await input("Balloon 1 color", "#22c55e");
    await textClick("Add balloon (3/12)"); expect(document.querySelector('[aria-label="Balloon 4 word"]')).not.toBeNull();
    await click("Delete balloon 2"); expect(document.querySelector('[aria-label="Balloon 4 word"]')).toBeNull();
    await click("Undo"); expect(document.querySelector('[aria-label="Balloon 4 word"]')).not.toBeNull(); await click("Redo");
    const snapshot = await saved(); const savedBlock = snapshot.lessons[0].blocks[0];
    expect(savedBlock).toMatchObject({ type: "balloonArcher", data: { title: "Discover science", balloons: [{ id: "explore", word: "Gravity", content: "Gravity attracts objects toward each other.", x: 35, y: 28, color: "#22c55e" }, expect.anything(), expect.anything()] } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "course" }} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select balloonArcher object from layers"); else await click("Open content settings");
    expect(document.querySelector<HTMLInputElement>('[aria-label="Balloon 1 word"]')?.value).toBe("Gravity");
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Balloon 1 revealed text"]')?.value).toContain("attracts objects");
    expect(container.querySelector('[data-balloon-archer="archer"]')).not.toBeNull();
  });
  it("inserts the game directly from the presentation toolbar", async () => {
    const data = initial("slides"); data.lessons[0].blocks = [];
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    await click("Balloon Archer"); const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: "balloonArcher", slideFrame: { width: 90 } });
    expect(snapshot.lessons[0].blocks[0].slideFrame!.height).toBeGreaterThan(50);
    expect(document.querySelector('[aria-label="Balloon Archer settings"]')).not.toBeNull();
  });
});
