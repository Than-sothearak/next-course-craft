/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { peelToRevealBlockSchema } from "@/lib/schemas/block";
import type { MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
vi.mock("@/app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, kind, onSelect }: { open: boolean; kind: string; onSelect: (asset: MediaLibraryAsset) => void }) => open ? <button aria-label="Choose test media" onClick={() => onSelect({ id: "a".repeat(24), originalName: "Discovery", fileUrl: `/api/assets/${"a".repeat(24)}/file`, contentType: kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/png", size: 100, createdAt: "2026-01-01" })}>Choose media</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const block = peelToRevealBlockSchema.parse({ id: "paper", type: "peelToReveal", version: 1, data: {} });
const initial = (courseLayout: "standard" | "slides") => ({ courseId: "course", ...editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout, sections: [{ id: "section", title: "Discover", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Discovery", order: 0, blocks: [block] }] }) });
describe("Peel to Reveal authoring workflows", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (label: string) => act(async () => { const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`); if (!button) throw new Error(`Missing ${label}`); button.click(); });
  const textClick = (text: string) => act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!; return editorSnapshotSchema.parse(JSON.parse(call[1].body)); }
  it.each(["standard", "slides"] as const)("edits replaceable content and physics in %s with undo, autosave and reload", async (layout) => {
    await act(async () => root.render(<EditorClient initialData={initial(layout)} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select peelToReveal object from layers"); else await click("Open content settings");
    const textEditor = document.querySelector<HTMLElement & { editor: Editor }>('[aria-label="Peel to Reveal settings"] [aria-label="Edit body text"]')!;
    await act(async () => textEditor.editor.commands.setContent('<p>A <strong>new discovery</strong> with <em>formatting</em>.</p>'));
    await input("Peel front title", "Uncover an idea"); await input("Peel paper color", "#ffeedd"); await select("Peel direction", "bottom-left"); await select("Peel physics preset", "soft"); await input("Peel animation duration (ms)", "1200");
    await select("New reveal content type", "link"); await textClick("Add content"); await input("Link text", "Learn more"); await input("Link URL", "https://example.com/discover");
    await select("New reveal content type", "image"); await textClick("Add content"); await click("Choose test media"); expect(document.querySelector('[aria-label="Revealed content 3 type"]')).not.toBeNull();
    await click("Delete revealed content 3"); await click("Undo"); expect(document.querySelector('[aria-label="Revealed content 3 type"]')).not.toBeNull(); await click("Redo");
    const snapshot = await saved(); const savedBlock = snapshot.lessons[0].blocks[0];
    expect(savedBlock).toMatchObject({ type: "peelToReveal", data: { title: "Uncover an idea", paperColor: "#ffeedd", direction: "bottom-left", physicsPreset: "soft", dragResistance: .18, animationDuration: 1200, blocks: [{ id: "reveal-text", type: "richText", data: { html: expect.stringContaining("<strong>new discovery</strong>") } }, { type: "link", data: { label: "Learn more", url: "https://example.com/discover" } }] } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "course" }} focusedLessonId="lesson" authorName="Author" />));
    if (layout === "slides") await click("Select peelToReveal object from layers"); else await click("Open content settings");
    expect(document.querySelector<HTMLInputElement>('[aria-label="Peel front title"]')?.value).toBe("Uncover an idea"); expect(document.querySelector<HTMLInputElement>('[aria-label="Link text"]')?.value).toBe("Learn more"); expect(container.querySelector('[data-peel-to-reveal="paper"]')).not.toBeNull();
  });
  it("inserts a slide object from the existing toolbar with live physics preview", async () => { const data = initial("slides"); data.lessons[0].blocks = []; await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />)); await click("Peel to Reveal"); const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: "peelToReveal", slideFrame: { width: 76 } }); expect(document.querySelector('[aria-label="Peel to Reveal settings"]')).not.toBeNull(); });
});
