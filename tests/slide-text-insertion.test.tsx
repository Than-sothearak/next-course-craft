/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { blockSchema } from "@/lib/schemas/block";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial = () => ({ courseId: "course", ...editorSnapshotSchema.parse({ title: "Slides", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Slide 1", order: 0, blocks: [] }] }) });
describe("presentation text insertion defaults", () => {
  it.each(["text-subheading", "text-paragraph", "text-lead"])("creates %s with zero padding, square corners and content fitting", (id) => { const template = blockTemplates.find((item) => item.id === id)!; const block = createSlideBlocksFromTemplate(template, "new")[0]; expect(blockSchema.safeParse(block).success).toBe(true); expect(block).toMatchObject({ blockPadding: 0, slideBorderRadius: 0, slideTextLayout: { paddingX: 0, paddingY: 0, fitToText: true } }); });
  it("uses one semantic 48px heading without a paragraph, while retaining normal lesson templates", () => {
    const template = blockTemplates.find((item) => item.id === "text-subheading")!, slide = createSlideBlocksFromTemplate(template, "heading")[0];
    expect(slide).toMatchObject({ type: "heading", data: { text: "Heading", level: 1 } }); if (slide.type !== "heading") throw new Error("Expected heading"); const html = new DOMParser().parseFromString(slide.data.html!, "text/html"); expect(html.querySelectorAll("h1")).toHaveLength(1); expect(html.querySelector("p")).toBeNull(); expect(html.querySelector<HTMLElement>("span")!.style.fontSize).toBe("48px");
    const standard = createBlocksFromTemplate(template, "standard")[0]; expect(standard).toMatchObject({ type: "richText", blockPadding: 40 }); expect(standard.data).toMatchObject({ html: expect.stringContaining("Use the paragraph below") });
  });
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) })); vi.stubGlobal("fetch", fetchMock); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  it.each(["Heading", "Text"])("inserts %s from the toolbar with saved styling, undo and reload", async (label) => {
    await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />)); await act(async () => container.querySelector<HTMLButtonElement>(`[data-slide-insert-toolbar] [aria-label="${label}"]`)!.click());
    const object = container.querySelector<HTMLElement>("[data-slide-object-frame]")!; expect(object.style.borderRadius).toBe("0px"); const text = object.querySelector<HTMLElement>("[data-slide-text-box]")!; expect(text.style.paddingTop).toBe("0px"); expect(text.style.paddingLeft).toBe("0px"); if (label === "Heading") { expect(object.querySelector("h1")).not.toBeNull(); expect(object.querySelector("p")).toBeNull(); }
    await act(async () => vi.advanceTimersByTimeAsync(1000)); const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")!; const snapshot = editorSnapshotSchema.parse(JSON.parse(call[1].body)); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: label === "Heading" ? "heading" : "richText", blockPadding: 0, slideBorderRadius: 0, slideTextLayout: { fitToText: true } });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click()); expect(container.querySelector("[data-slide-object-frame]")).toBeNull(); await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!.click()); expect(container.querySelector<HTMLElement>("[data-slide-object-frame]")!.style.borderRadius).toBe("0px");
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "course" }} authorName="Author" />)); expect(container.querySelector<HTMLElement>("[data-slide-text-box]")!.style.paddingLeft).toBe("0px");
  });
});
