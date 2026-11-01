/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { hangingRopeCardsBlockSchema } from "@/lib/schemas/block";
import type { MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
vi.mock("@/app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, kind, onSelect }: { open: boolean; kind: string; onSelect: (asset: MediaLibraryAsset) => void }) => open ? <button aria-label="Choose rope test media" onClick={() => onSelect({ id: "a".repeat(24), originalName: "Discovery", fileUrl: `/api/assets/${"a".repeat(24)}/file`, contentType: kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/png", size: 100, createdAt: "2026-01-01" })}>Choose media</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const block = hangingRopeCardsBlockSchema.parse({ id: "ropes", type: "hangingRopeCards", version: 1, data: {} });
const initial = (courseLayout: "standard" | "slides") => ({ courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout, sections: [{ id: "section", title: "Discover", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Discovery", order: 0, blocks: [block] }] }) });
describe("Hanging Rope Cards authoring", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (label: string) => act(async () => { const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`); if (!button) throw new Error(`Missing ${label}`); button.click(); });
  const textClick = (text: string) => act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!; return editorSnapshotSchema.parse(JSON.parse(call[1].body)); }
  it.each(["standard", "slides"] as const)("edits cards, formatted discoveries and physics in %s with undo, saving and reload", async (layout) => {
    await act(async () => root.render(<EditorClient initialData={initial(layout)} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select hangingRopeCards object from layers"); else await click("Open content settings");
    const editor = document.querySelector<HTMLElement & { editor: Editor }>('[aria-label="Hanging Rope Cards settings"] [aria-label="Edit body text"]')!.editor;
    await act(async () => editor.commands.setContent('<p>A <strong>rope discovery</strong> with <em>formatting</em>.</p>'));
    await input("Rope card title", "Gravity"); await input("Rope selected card color", "#dbeafe"); await input("Rope target left", "60"); await select("Rope reveal behavior", "open"); await select("Rope physics preset", "soft"); await input("Rope reveal duration (ms)", "1200");
    await select("New reveal content type", "image"); await textClick("Add content"); await click("Choose rope test media");
    await textClick("Add hanging card (3/6)"); await click("Delete hanging card"); await click("Undo"); expect(document.querySelector<HTMLSelectElement>('[aria-label="Edit hanging card"]')!.options.length).toBe(4); await click("Redo");
    const snapshot = await saved(), savedBlock = snapshot.lessons[0].blocks[0];
    expect(savedBlock).toMatchObject({ type: "hangingRopeCards", data: { revealMode: "open", physicsPreset: "soft", springStiffness: 75, animationDuration: 1200, cards: [{ id: "rope-1", title: "Gravity", color: "#dbeafe", targetX: 60, blocks: [{ type: "richText", data: { html: expect.stringContaining("<strong>rope discovery</strong>") } }, { type: "image", data: { src: `/api/assets/${"a".repeat(24)}/file` } }] }, expect.anything(), expect.anything()] } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "course" }} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select hangingRopeCards object from layers"); else await click("Open content settings");
    expect(document.querySelector<HTMLInputElement>('[aria-label="Rope card title"]')?.value).toBe("Gravity"); expect(container.querySelector('[data-hanging-rope-cards="ropes"]')).not.toBeNull();
  });
  it("inserts from the slide toolbar using normal object frames", async () => { const data = initial("slides"); data.lessons[0].blocks = []; await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />)); await click("Hanging Rope Cards"); const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: "hangingRopeCards", slideFrame: { width: 90 } }); expect(document.querySelector('[aria-label="Hanging Rope Cards settings"]')).not.toBeNull(); });
});
