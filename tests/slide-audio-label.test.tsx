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
const data = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Media", order: 0, blocks: [{ id: "audio", version: 1, type: "audio", data: { src: "/api/assets/123456789012345678901234/file", fileName: "Instructions.mp3", mimeType: "audio/mpeg" } }] }] }) };
describe("presentation audio file name setting", () => {
  let container: HTMLDivElement; let root: Root; let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetch);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  it("toggles the file name with undo, saving and reload, and hides it in preview and standalone learners", async () => {
    await act(async () => root.render(<EditorClient initialData={data} authorName="" />));
    await act(async () => container.querySelector('[data-slide-object-id="audio"]')!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    await click("Toggle Playback settings");
    const toggle = () => container.querySelector<HTMLInputElement>('[aria-label="Show audio file name"]')!;
    const canvas = () => container.querySelector('[data-slide-canvas]')!;
    expect(toggle().checked).toBe(true); expect(canvas().textContent).toContain("Instructions.mp3");
    await act(async () => toggle().click()); expect(toggle().checked).toBe(false); expect(canvas().textContent).not.toContain("Instructions.mp3"); expect(container.querySelector('[data-slide-thumbnail]')?.textContent).not.toContain("Instructions.mp3");
    await click("Undo"); expect(toggle().checked).toBe(true); expect(canvas().textContent).toContain("Instructions.mp3"); await click("Redo");
    await act(async () => vi.advanceTimersByTimeAsync(1000)); const snapshot = editorSnapshotSchema.parse(JSON.parse(fetch.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body));
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ slidePlayback: { showFileName: false }, data: { fileName: "Instructions.mp3" } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="" />)); expect(canvas().textContent).not.toContain("Instructions.mp3");
    for (const standalone of [false, true]) { await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />)); expect(canvas().textContent).not.toContain("Instructions.mp3"); expect(canvas().querySelector('audio')?.getAttribute("aria-label")).toBe("Instructions.mp3"); expect(canvas().querySelector('audio')?.controls).toBe(true); }
  });
});
