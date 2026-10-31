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
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }] }) };
const asset = { id: "123456789012345678901234", originalName: "Header.png", contentType: "image/png", fileUrl: "/api/assets/123456789012345678901234/file", size: 3000, createdAt: "2026-01-01" };

describe("master slide header settings", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets: [asset] } : { revision: 2 } }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === text)!.click());
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const background = () => container.querySelector<HTMLElement>('[data-slide-canvas] [data-slide-header-background]')!;

  it("uses master theme colors until the header background is overridden", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await click("Master slide");
    await select("Header background style", "color");
    await click("Midnight");
    expect(background().style.backgroundColor).toBe("rgb(15, 23, 42)");
    expect(container.querySelector<HTMLElement>('[data-slide-canvas] [data-slide-header]')?.style.color).toBe("rgb(248, 250, 252)");
    await input("Header background color", "#123456");
    await click("Warm");
    expect(background().style.backgroundColor).toBe("rgb(18, 52, 86)");
    await click("Use theme header background");
    expect(background().style.backgroundColor).toBe("rgb(255, 247, 237)");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!;
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body));
    expect(snapshot.slideMaster?.header?.backgroundColor).toBeUndefined();
    await act(async () => root.render(<EditorClient key="theme-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(background().style.backgroundColor).toBe("rgb(255, 247, 237)");
  });

  it("applies the master header weight and size to the editable title", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await click("Master slide");
    const title = () => container.querySelector<HTMLInputElement>('[data-slide-canvas] [aria-label="Slide title"]')!;
    const header = () => container.querySelector<HTMLElement>('[data-slide-canvas] [data-slide-header]')!;
    expect(header().style.fontWeight).toBe("bold");
    expect(title().style.fontWeight).toBe("inherit");
    expect(title().classList.contains("font-bold")).toBe(false);
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Header bold"]')!.click());
    await input("Header font size", "44");
    expect(header().style.fontWeight).toBe("normal");
    expect(header().style.fontSize).toBe("44px");
    expect(title().style.fontWeight).toBe("inherit");
    expect(title().style.fontSize).toBe("inherit");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!;
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body));
    expect(snapshot.slideMaster?.header).toMatchObject({ fontWeight: "normal", fontSize: 44 });
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
    expect(container.querySelector<HTMLElement>('[data-slide-header]')?.style.fontWeight).toBe("normal");
    expect(container.querySelector<HTMLElement>('[data-slide-header]')?.style.fontSize).toBe("44px");
  });

  it("edits color and a course-owned image, supports undo and collapse, and restores the saved header in preview", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await click("Master slide");
    await input("Header background color", "#123456");
    expect(background().getAttribute("data-slide-header-background")).toBe("color");
    expect(background().style.backgroundColor).toBe("rgb(18, 52, 86)");
    await input("Header text color", "#ffffff");
    await select("Header background style", "image"); await click("Choose or upload header image");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Upload image"]')?.accept).toContain("image/png");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Use Header.png"]')!.click());
    await select("Header image position", "bottom"); await input("Header image overlay", "45");
    expect(background().querySelector("img")?.style.objectPosition).toBe("bottom");
    expect(container.querySelector('[data-slide-thumbnail-canvas] [data-slide-header-background] img')?.getAttribute("src")).toBe(asset.fileUrl);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Hide all Master slide settings"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show all Master slide settings"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Header image overlay"]')?.value).toBe("45");
    await click("Remove header image"); expect(background().querySelector("img")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
    expect(background().querySelector("img")?.getAttribute("src")).toBe(asset.fileUrl);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!;
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body));
    expect(snapshot.slideMaster?.header).toMatchObject({ background: "image", backgroundColor: "#123456", textColor: "#ffffff", imageSrc: asset.fileUrl, imagePosition: "bottom", overlayOpacity: 45 });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(background().querySelector("img")?.getAttribute("src")).toBe(asset.fileUrl);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="first" standalone={standalone} persistLocalProgress={false} />));
      expect(background().querySelector("img")?.getAttribute("src")).toBe(asset.fileUrl);
      expect(container.querySelector<HTMLElement>('[data-slide-header]')?.style.color).toBe("rgb(255, 255, 255)");
    }
  });

  it("saves a slide with no header title and keeps preview and navigation usable", async () => {
    await act(async () => root.render(<EditorClient initialData={{ ...initialData, lessons: [{ ...initialData.lessons[0], titleHtml: "<h1>Introduction</h1>" }] }} authorName="Author" />));
    await input("Slide title", "");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("");
    expect(container.querySelector('[data-slide-header]')?.textContent).toBe("");
    expect(container.querySelector('[data-slide-thumbnail-label]')?.textContent).toBe("1. Slide 1");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    const snapshot = editorSnapshotSchema.parse(JSON.parse(call![1].body));
    expect(snapshot.lessons[0].title).toBe("");
    expect(snapshot.lessons[0].titleHtml).toBeUndefined();
    await act(async () => root.render(<EditorClient key="reload-blank" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide title"]')?.value).toBe("");
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="first" standalone persistLocalProgress={false} />));
    expect(container.querySelector('[data-slide-header]')?.textContent).toBe("");
    expect(container.querySelector('[aria-label="Slide: Slide 1"]')).not.toBeNull();
  });

  it("accepts an empty presentation quiz title", async () => {
    const quizData = { ...initialData, lessons: [{ ...initialData.lessons[0], title: "", lessonType: "quiz" as const }] };
    await act(async () => root.render(<EditorClient initialData={quizData} authorName="Author" />));
    expect(container.querySelector('[data-slide-header]')?.textContent).toBe("");
    expect(container.textContent).not.toContain("Enter a lesson title before saving.");
    expect(container.querySelector('[aria-label="Edit slide 1: Slide 1"]')).not.toBeNull();
  });
});
