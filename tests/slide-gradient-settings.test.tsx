/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { gradientColor } from "@/lib/color";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const blockInputs = [
  { id: "graphic", type: "labeledGraphic", data: { src: "/diagram.png", alt: "Diagram", markers: [{ id: "point", label: "Point", description: "Detail", x: 25, y: 50 }] } },
  { id: "cards", type: "flipCard", data: { cards: [{ id: "card", frontLabel: "Question", backLabel: "Answer", front: { type: "text", text: "Front" }, back: { type: "text", text: "Back" } }] } },
  { id: "chart", type: "chart", data: { chartType: "column", title: "Results", fields: [{ id: "field", label: "Value", value: 5 }] } },
  { id: "divider", type: "divider", data: { style: "line" } },
  { id: "process", type: "processSteps", data: { steps: [{ id: "one", title: "One", body: "First" }, { id: "two", title: "Two", body: "Second" }] } },
];
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Gradients", order: 0, blocks: blockInputs.map((block) => ({ ...block, version: 1, slideFrame: { x: 10, y: 10, width: 80, height: 80, z: 0 } })) }] }) };

describe("presentation object gradients", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  async function gradient(label: string) { await act(async () => button(`${label} gradient`).click()); await input(label === "Chart color picker" ? "Chart color hex code" : `${label} hex code`, "#2563eb"); await input(`${label} end hex code`, "#f97316"); await input(`${label} gradient angle`, "135"); }

  it("saves object fills and internal colors, retains undo, and renders gradients in both learners", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    const controls = [["labeledGraphic", "Graphic marker color"], ["flipCard", "Card background color"], ["chart", "Chart color picker"], ["divider", "Divider line color"], ["processSteps", "Process step accent color"]];
    for (const [type, label] of controls) {
      await act(async () => button(`Select ${type} object from layers`).click()); await gradient("Object background color"); await gradient(label);
    }
    await act(async () => button("Undo").click()); await act(async () => button("Redo").click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const snapshot = editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body));
    const expected = gradientColor("#2563eb", "#f97316", 135);
    for (const block of snapshot.lessons[0].blocks) expect(block.slideBackground).toEqual({ color: expected, opacity: 100 });
    expect(snapshot.lessons[0].blocks.map((block) => block.data)).toMatchObject([{ markerColor: expected }, { cardBackgroundColor: expected }, { color: expected }, { lineColor: expected }, { accentColor: expected }]);
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" standalone={standalone} persistLocalProgress={false} />));
      for (const object of container.querySelectorAll<HTMLElement>('[data-slide-object-id]')) expect(object.style.backgroundImage).toContain("linear-gradient");
      expect(container.querySelector<HTMLElement>('[aria-label="Point: show explanation"]')?.style.backgroundImage).toContain("linear-gradient");
      expect(container.querySelector('figure svg linearGradient')).not.toBeNull();
      expect(container.querySelector<HTMLElement>('[data-process-style]')?.style.getPropertyValue("--process-paint")).toBe(expected);
    }
  });
});
