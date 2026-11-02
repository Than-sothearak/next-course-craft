/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
vi.mock("@/app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, onSelect }: { open: boolean; onSelect: (asset: { fileUrl: string }) => void }) => open ? <button onClick={() => onSelect({ fileUrl: "/api/assets/123456789012345678901234/file" })}>Pick test background</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial = () => ({ courseId: "course", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas", footerText: "Brand", background: { type: "abstract", design: "waves" } }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "first", sectionId: "section", title: "First", order: 0, blocks: [{ id: "text", version: 1, type: "richText", data: { html: "<p>Existing editable content</p>" } }] },
  { id: "quiz", sectionId: "section", title: "Quiz", lessonType: "quiz", order: 1, blocks: [] },
] }) });

describe("slide-specific background and layout authoring", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const canvas = () => container.querySelector('[data-slide-canvas]')!;
  const click = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const toggle = (label: string) => act(async () => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.click());
  const textButton = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === text)!;
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const save = async () => { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); };
  it("edits one slide, preserves content, supports undo/reload, and renders the same blank image slide in preview", async () => {
    await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />));
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Slide background style"]')!;
    await act(async () => { select.value = "image"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => textButton("Choose or upload slide background image").click());
    await act(async () => textButton("Pick test background").click());
    expect(canvas().querySelector('[data-slide-master-background="image"] img')!.getAttribute("src")).toBe("/api/assets/123456789012345678901234/file");
    await input("Slide background overlay color hex code", "#ff8800"); await input("Slide background image overlay", "45");
    await act(async () => textButton("Replace slide background image").click()); await act(async () => textButton("Pick test background").click());
    expect(canvas().querySelector<HTMLElement>('[data-slide-master-background="image"] [data-slide-color-overlay]')?.style.backgroundColor).toBe("rgb(255, 136, 0)");
    await click("Blank slide"); expect(canvas().querySelector('[data-slide-header]')).toBeNull(); expect(canvas().querySelector('[data-slide-footer]')).toBeNull(); expect(canvas().querySelector('[data-slide-floating-navigation]')).toBeNull(); expect(canvas().textContent).toContain("Existing editable content");
    await click("Undo"); expect(canvas().querySelector('[data-slide-header]')).not.toBeNull(); expect(canvas().querySelector('[data-slide-footer]')).not.toBeNull(); await click("Redo");
    await toggle("Show navigation buttons"); expect(canvas().querySelector('[data-slide-floating-navigation]')).not.toBeNull(); expect(canvas().querySelector('[aria-label="Next"]')).not.toBeNull();
    await toggle("Show navigation buttons"); expect(canvas().querySelector('[data-slide-floating-navigation]')).toBeNull();
    await toggle("Show navigation buttons");
    const snapshot = await save(); expect(snapshot.lessons[0].slideAppearance).toMatchObject({ hideHeader: true, hideFooter: true, showNavigationButtons: true, background: { type: "image", overlayColor: "#ff8800", overlayOpacity: 45 } }); expect(snapshot.lessons[1].slideAppearance).toBeUndefined();
    await click("Edit slide 2: Quiz"); expect(canvas().querySelector('[data-slide-header]')).not.toBeNull(); expect(canvas().querySelector('[data-slide-footer]')).not.toBeNull(); expect(container.querySelector<HTMLInputElement>('[aria-label="Blank slide"]')!.checked).toBe(false);
    await click("Show slide footer"); expect(canvas().querySelector('[data-slide-footer]')).toBeNull(); expect(canvas().querySelector('[data-slide-header]')).not.toBeNull();
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "course" }} authorName="Author" />)); expect(canvas().querySelector('[data-slide-header]')).toBeNull(); expect(canvas().querySelector('[data-slide-footer]')).toBeNull();
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "course" }} authorName="Author" initialLessonId="first" standalone={standalone} persistLocalProgress={false} />));
      const active = container.querySelector('[data-slide-active="true"]')!;
      expect(active.querySelector('[data-slide-header]')).toBeNull(); expect(active.querySelector('[data-slide-footer]')).toBeNull(); expect(active.querySelector('[data-slide-master-background="image"] img')).not.toBeNull(); expect(active.querySelector('[data-slide-floating-navigation]')).not.toBeNull();
    }
  });
  it("adds an empty blank slide that accepts ordinary editable blocks", async () => {
    await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />));
    await act(async () => textButton("Blank slide").click());
    expect(canvas().querySelector('[data-slide-header]')).toBeNull(); expect(canvas().querySelector('[data-slide-footer]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-slide-insert-toolbar] [aria-label="Heading"]')!.click());
    expect(canvas().querySelector('[data-slide-object-frame] h1')?.textContent).toBe("Heading");
    const snapshot = await save(), slide = snapshot.lessons.at(-1)!;
    expect(slide.slideAppearance).toMatchObject({ hideHeader: true, hideFooter: true }); expect(slide.slideCover).toBeUndefined(); expect(slide.blocks[0].type).toBe("heading");
  });
});
