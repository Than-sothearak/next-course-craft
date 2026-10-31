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
const data = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: "free", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", subtitle: "Welcome" } },
  { id: "content", sectionId: "section", title: "Content", order: 1, blocks: [] }, { id: "quiz", sectionId: "section", title: "Quiz", order: 2, lessonType: "quiz", blocks: [] },
] }) };
describe("footer navigation appearance and chat tips", () => {
  let root: Root; let container: HTMLDivElement; let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ revision: 2 }) }); vi.stubGlobal("fetch", fetch);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const click = (label: string) => act(async () => button(label).click());
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const render = async (initial: typeof data = data) => { await act(async () => root.render(<EditorClient initialData={initial} authorName="" />)); await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === "Master slide")!.click()); };
  const navButton = (key: string) => container.querySelector<HTMLButtonElement>(`[data-slide-canvas] [data-navigation-button="${key}"]`)!;
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetch.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }

  it("saves shared and per-button designs, gradients, sizes, footer geometry, undo and reload", async () => {
    await render(); await input("Footer height (px)", "112"); await input("Footer text size (px)", "16"); await input("Footer content gap (px)", "12");
    await click("Navigation style Modern"); await input("Navigation button height (px)", "48");
    await select("Navigation button target", "next"); await click("Navigation style 3D raised"); await click("Navigation button fill color gradient"); await input("Navigation button fill color hex code", "#2563eb"); await input("Navigation button fill color end hex code", "#9333ea"); await input("Navigation button fill color gradient angle", "135"); await input("Navigation button corner radius (px)", "20");
    expect(navButton("restart").textContent).toBe(""); expect(navButton("restart").getAttribute("aria-label")).toBe("Restart slide");
    expect(navButton("previous").querySelector("svg")?.getAttribute("stroke")).toBe("currentColor");
    expect(navButton("previous").dataset.navigationButtonStyle).toBe("modern"); expect(navButton("next").dataset.navigationButtonStyle).toBe("threeD"); expect(navButton("next").style.backgroundImage).toContain("linear-gradient");
    await click("Undo"); expect(navButton("next").style.borderRadius).toBe("6px"); await click("Redo");
    const snapshot = await saved(); expect(snapshot.slideMaster?.footer).toMatchObject({ height: 112, fontSize: 16, contentGap: 12 }); expect(snapshot.slideMaster?.navigationButtons?.overrides?.next).toMatchObject({ backgroundColor: gradientColor("#2563eb", "#9333ea", 135), radius: 20 });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="" />)); expect(navButton("next").dataset.navigationButtonStyle).toBe("threeD"); expect(container.querySelector<HTMLElement>('[data-slide-footer]')!.style.height).toBe("112px");
    const editorNavigationWidth = container.querySelector<HTMLElement>('[data-slide-navigation-layout]')!.style.width;
    await act(async () => navButton("next").click()); expect(container.querySelector<HTMLElement>('[data-slide-object-region]')!.classList.contains("inset-0")).toBe(true);
    for (const standalone of [false, true]) { await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="" initialLessonId="content" standalone={standalone} persistLocalProgress={false} />)); expect(navButton("next").dataset.navigationButtonStyle).toBe("threeD"); expect(container.querySelector<HTMLElement>('[data-slide-footer]')!.style.height).toBe("112px"); expect(container.querySelector<HTMLElement>('[data-slide-active="true"] [data-slide-navigation-layout]')!.style.width).toBe(editorNavigationWidth); }
  });

  it("draws a chat arrow toward each described navigation button", async () => {
    await render(); await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Enable navigation guide"]')!.click()); await click("Show navigation guide");
    for (const key of ["next", "previous", "restart"]) {
      const tip = container.querySelector<HTMLElement>('[role="dialog"][aria-label="Navigation guide"]')!;
      expect(tip.querySelector('[data-navigation-tip-arrow]')).not.toBeNull(); expect(navButton(key).getAttribute("aria-describedby")).toBe(tip.id);
      await act(async () => tip.querySelector<HTMLButtonElement>('[data-guide-advance]')!.click());
    }
    expect(container.querySelector('[role="dialog"][aria-label="Navigation guide"]')).toBeNull();
  });

  it("grows the footer for large 3D controls and can reset an individual override", async () => {
    await render(); await click("Navigation style 3D raised"); await input("Navigation button height (px)", "72");
    expect(Number(container.querySelector<HTMLInputElement>('[aria-label="Footer height (px)"]')!.value)).toBeGreaterThanOrEqual(93);
    await select("Navigation button target", "next"); await click("Navigation style Glass"); expect(navButton("next").dataset.navigationButtonStyle).toBe("glass");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Use shared button style")!.click()); expect(navButton("next").dataset.navigationButtonStyle).toBe("threeD");
    await select("Navigation button target", "all"); await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Reset all button styles")!.click()); expect((await saved()).slideMaster?.navigationButtons).toBeUndefined();
  });

  it.each(["all", "next"])("keeps chosen solid and gradient colors across every style, undo and reload (target=%s)", async (target) => {
    await render(); await click("Navigation style Solid"); await select("Navigation button target", target);
    await input("Navigation button fill color hex code", "#e11d48"); await input("Navigation button text color hex code", "#fefce8"); await input("Navigation button border color hex code", "#0f172a");
    await click("Navigation style Modern");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Navigation button fill color hex code"]')!.value).toBe("#e11d48");
    await click("Navigation button fill color gradient"); await input("Navigation button fill color end hex code", "#f97316"); await input("Navigation button fill color gradient angle", "120");
    await click("Navigation button border color gradient"); await input("Navigation button border color end hex code", "#14b8a6");
    const expected = { backgroundColor: gradientColor("#e11d48", "#f97316", 120), textColor: "#fefce8", borderColor: gradientColor("#0f172a", "#14b8a6", 90) };
    for (const style of ["Outline", "Solid", "Soft", "Modern", "Glass", "3D raised"]) {
      await click(`Navigation style ${style}`);
      expect(navButton("next").style.color).toBe("rgb(254, 252, 232)");
      expect(button("Navigation style Solid").querySelector<HTMLElement>("span")!.style.backgroundImage).toContain("#e11d48");
      if (style !== "Outline") expect(navButton("next").style.backgroundImage).toMatch(/#f97316|rgba?\(249,\s*115,\s*22/);
    }
    await click("Undo"); expect(navButton("next").dataset.navigationButtonStyle).toBe("glass"); await click("Redo");
    const snapshot = await saved(), settings = snapshot.slideMaster!.navigationButtons!;
    expect(target === "all" ? settings : settings.overrides!.next).toMatchObject(expected);
    if (target === "next") { expect(settings.style).toBe("solid"); expect(settings.backgroundColor).not.toBe(expected.backgroundColor); }
    await act(async () => root.render(<EditorClient key="restored-colors" initialData={{ ...snapshot, courseId: "slides" }} authorName="" />));
    expect(navButton("next").dataset.navigationButtonStyle).toBe("threeD"); expect(navButton("next").style.backgroundImage).toContain("#f97316");
  });

  it("picks master theme colors and gradients independently for fill, text and border", async () => {
    const master = { accentColor: gradientColor("#0d9488", "#2563eb", 135), textColor: "#0f172a", backgroundColor: "#fffbeb" };
    await render({ ...data, ...editorSnapshotSchema.parse({ ...data, slideMaster: master }) });
    await click("Navigation style Solid"); await click("Use master accent for navigation button fill"); await click("Use master background for navigation button text"); await click("Use master text for navigation button border");
    await click("Navigation style Glass");
    expect(button("Use master accent for navigation button fill").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Navigation button fill color hex code"]')!.value).toBe("#0d9488");
    await select("Navigation button target", "restart"); await click("Use master accent for navigation button text"); await click("Navigation style 3D raised");
    expect(navButton("restart").querySelector("linearGradient")).not.toBeNull();
    const settings = (await saved()).slideMaster!.navigationButtons!;
    expect(settings).toMatchObject({ style: "glass", backgroundColor: master.accentColor, textColor: master.backgroundColor, borderColor: master.textColor });
    expect(settings.overrides!.restart).toMatchObject({ style: "threeD", backgroundColor: master.accentColor, textColor: master.accentColor, borderColor: master.textColor });
    expect(navButton("previous").style.color).toBe("rgb(255, 251, 235)");
  });
});
