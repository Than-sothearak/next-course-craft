/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("saved theme defaults and block gradients", () => {
  let root: Root, container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  const data = () => ({ courseId: "theme", ...editorSnapshotSchema.parse({ title: "Theme", description: "", revision: 1, sections: [{ id: "s", title: "Learn", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks: [{ id: "body", type: "richText", version: 1, data: { html: "<p>Keep this text</p>" } }] }] }) });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 2 }) }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const click = (label: string) => act(async () => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());

  it("undoes and redoes defaults, saves gradient backgrounds, and retains both in reload/export snapshots", async () => {
    await act(async () => root.render(<EditorClient initialData={data()} focusedLessonId="l" authorName="Author" />));
    await click("Toggle Advanced settings");
    const field = document.querySelector<HTMLInputElement>('[aria-label="Default normal text size"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "18");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector('main')?.style.getPropertyValue("--course-body-size")).toBe("18px");
    await click("Undo");
    expect(container.querySelector('main')?.style.getPropertyValue("--course-body-size")).toBe("");
    await click("Redo");
    expect(container.querySelector('main')?.style.getPropertyValue("--course-body-size")).toBe("18px");
    await click("Format block");
    await click("Use theme brand to accent background");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const saved = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(saved).toBeDefined();
    const snapshot = parseScorm12Snapshot(JSON.parse(saved![1].body));
    expect(snapshot.theme.typography?.bodySize).toBe(18);
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ backgroundColor: "linear-gradient(90deg, #2f5f9f 0%, #ff876c 100%)", data: { html: "<p>Keep this text</p>" } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "theme" }} focusedLessonId="l" authorName="Author" />));
    expect(container.querySelector('main')?.style.getPropertyValue("--course-body-size")).toBe("18px");
    expect(container.querySelector('[data-editor-block-id="body"] [style*="background-image"]')).not.toBeNull();
  });
});
