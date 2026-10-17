/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditorClient } from "../app/courses/[courseId]/slides/edit/slide-editor-client";
import { SlidePlayerClient } from "../app/courses/[courseId]/slides/preview/slide-player-client";
import { createLearningBlock } from "../lib/slides/blocks";
import { composeLearningPage } from "../lib/slides/pages";
import { slideSnapshotSchema, type SlideRecord } from "../lib/slides/schema";
import { defaultSlideTheme, type SlideThemeSnapshot } from "../lib/slides/themes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, onSelect }: { open: boolean; onSelect: (asset: { fileUrl: string; originalName: string }) => void }) => open ? <button onClick={() => onSelect({ fileUrl: "/api/assets/507f1f77bcf86cd799439013/file", originalName: "Institution seal" })}>Pick owned institution image</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("slide master authoring and persistence", () => {
  let container: HTMLDivElement, root: Root, slides: SlideRecord[], theme: SlideThemeSnapshot;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    slides = [0, 1].map((order) => composeLearningPage({ ...slideSnapshotSchema.parse({ title: `Concept ${order + 1}`, order, revision: 0, objects: [] }), id: `page-${order}` }));
    const video = createLearningBlock("video"); if (video.kind !== "video") throw new Error("Expected video");
    slides[0].composition!.layers = [createLearningBlock("text"), { ...video, start: 2, end: 12, trimStart: 4, trimEnd: 14 }, createLearningBlock("quiz")];
    theme = { theme: defaultSlideTheme, revision: 0 };
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input), body = init?.body ? JSON.parse(String(init.body)) : {};
      if (path.endsWith("/theme")) { if (init?.method === "PATCH") theme = { theme: body.theme, revision: theme.revision + 1 }; return Response.json(theme); }
      if (path.endsWith("/reorder")) { slides = body.slideIds.map((id: string, order: number) => ({ ...slides.find((slide) => slide.id === id)!, order, revision: slides.find((slide) => slide.id === id)!.revision + 1 })); return Response.json(slides); }
      if (init?.method === "PATCH") { const id = path.split("/").at(-1)!; const saved = { ...slideSnapshotSchema.parse(body), id, revision: slides.find((slide) => slide.id === id)!.revision + 1 }; slides = slides.map((slide) => slide.id === id ? saved : slide); return Response.json(saved); }
      return Response.json(slides);
    }));
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const mount = () => act(() => root.render(<SlideEditorClient courseId="course" courseTitle="Institutional course" initialSlides={slides} initialTheme={theme} />));
  function button(label: string) { const element = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label); expect(element, label).toBeDefined(); return element!; }
  const click = async (label: string) => act(async () => { button(label).click(); for (let i = 0; i < 12; i++) await Promise.resolve(); });
  const save = async () => act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  async function input(label: string, value: string) { await act(async () => { const element = container.querySelector<HTMLInputElement>(`dialog[open] [aria-label="${label}"]`)!; expect(element, label).not.toBeNull(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); }); }
  const activeMaster = () => container.querySelector<HTMLElement>("[data-slide-viewport] [data-slide-master]")!;
  async function applyGreen() { await click("Theme"); await click("Use Institutional Green theme"); await click("Close dialog"); await save(); }

  it("applies the shared preset and logo, preserves every object/trim, reorders numbering and reloads", async () => {
    const content = JSON.stringify(slides.map((slide) => slide.composition)); mount(); await applyGreen();
    expect(activeMaster().textContent).toContain("Concept 1"); expect(activeMaster().querySelector("[data-master-number]")?.textContent).toBe("1");
    await click("Edit Slide Master"); await input("Module or lesson text", "Faculty of Science · Module 2");
    await click("Choose institution logo"); await click("Pick owned institution image"); await click("Apply master"); await save();
    expect(theme.theme.master?.header.logo.src).toContain("/api/assets/"); expect(theme.theme.master?.footer.text).toBe("Faculty of Science · Module 2");
    expect(JSON.stringify(slides.map((slide) => slide.composition))).toBe(content);
    await click("Move Concept 1 down"); expect(activeMaster().querySelector("[data-master-number]")?.textContent).toBe("2");
    expect(slides[1].id).toBe("page-0");
    act(() => root.unmount()); root = createRoot(container); mount();
    expect(activeMaster().querySelector("img")?.getAttribute("src")).toBe(theme.theme.master?.header.logo.src);
    expect(activeMaster().querySelector("[data-master-footer-text]")?.textContent).toBe("Faculty of Science · Module 2");
    expect(activeMaster().querySelector("[data-master-number]")?.textContent).toBe("1");
  });
  it("previews locally, cancels, supports undo/redo/reset and saves only on apply", async () => {
    mount(); await applyGreen(); const before = JSON.stringify(theme);
    await click("Edit Slide Master"); await input("Header color", "#123456");
    expect(container.querySelector<SVGPolygonElement>("dialog[open] [data-master-header] polygon")?.getAttribute("fill")).toBe("#123456");
    await click("Undo master edit"); expect(container.querySelector<HTMLInputElement>('dialog[open] [aria-label="Header color"]')?.value).toBe("#199b5b");
    await click("Redo master edit"); expect(container.querySelector<HTMLInputElement>('dialog[open] [aria-label="Header color"]')?.value).toBe("#123456");
    await save(); expect(JSON.stringify(theme)).toBe(before); await click("Cancel"); expect(JSON.stringify(theme)).toBe(before);
    await click("Edit Slide Master"); await input("Header color", "#123456"); await click("Reset preset"); await click("Apply master"); await save(); expect(theme.theme.master?.header.color).toBe("#199b5b");
    await click("Edit Slide Master"); await input("Header color", "#123456"); await click("Apply master"); await save(); expect(theme.theme.master?.header.color).toBe("#123456");
    await click("Undo theme"); await save(); expect(theme.theme.master?.header.color).toBe("#199b5b");
  });
  it("keeps per-slide overrides sparse, resets inheritance, and supports a hidden/manual number", async () => {
    mount(); await applyGreen(); await click("Edit this slide’s master"); await input("Header color", "#123456"); await click("Apply master"); await save();
    expect(slides[0].composition?.masterOverrides).toEqual({ header: { color: "#123456" } }); expect(slides[1].composition?.masterOverrides).toBeUndefined(); expect(theme.theme.master?.header.color).toBe("#199b5b");
    await click("Edit Slide Master"); await input("Module or lesson text", "Inherited footer update"); await click("Apply master"); await save();
    expect(activeMaster().querySelector("[data-master-footer-text]")?.textContent).toBe("Inherited footer update");
    expect(activeMaster().querySelector("polygon")?.getAttribute("fill")).toBe("#123456");
    await act(async () => { const element = container.querySelector<HTMLInputElement>('[aria-label="Slide number override"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, "A3"); element.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(activeMaster().querySelector("[data-master-number]")?.textContent).toBe("A3");
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Hide slide number"]')!.click()); expect(activeMaster().querySelector("[data-master-number]")).toBeNull();
    await click("Reset to master"); await save(); expect(slides[0].composition?.masterOverrides).toBeUndefined(); expect(slides[0].composition?.numbering).toBeUndefined(); expect(activeMaster().querySelector("polygon")?.getAttribute("fill")).toBe("#199b5b");
  });
  it("applies overrides to an older populated canvas without migrating its objects and matches learner preview", async () => {
    slides = [{ ...slideSnapshotSchema.parse({ title: "Legacy canvas", order: 0, revision: 0, objects: [{ id: "text", type: "text", content: "Keep this object", x: 80, y: 100, width: 600, height: 300 }] }), id: "legacy" }];
    const objects = JSON.stringify(slides[0].objects); mount(); await applyGreen();
    await click("Edit this slide’s master"); await input("Header color", "#123456"); await click("Apply master"); await save();
    expect(slides[0].masterOverrides).toEqual({ header: { color: "#123456" } }); expect(slides[0].composition).toBeUndefined(); expect(JSON.stringify(slides[0].objects)).toBe(objects);
    expect(activeMaster().querySelector("polygon")?.getAttribute("fill")).toBe("#123456");
    act(() => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<SlidePlayerClient title="Legacy canvas" slides={slides} theme={theme.theme} />));
    expect(container.querySelector("[data-master-title]")?.textContent).toBe("Legacy canvas"); expect(container.querySelector("[data-master-header] polygon")?.getAttribute("fill")).toBe("#123456");
    expect(container.textContent).toContain("Keep this object");
  });
  it("prevents a course master from invalidating another slide's inherited content bounds", async () => {
    slides[1].composition!.masterOverrides = { content: { y: 200 } };
    mount(); await applyGreen(); await click("Edit Slide Master"); await input("Content height", "600");
    expect(button("Apply master").disabled).toBe(true);
    expect(container.querySelector('dialog[open] [role="alert"]')?.textContent).toContain("Concept 2");
    await click("Cancel"); expect(theme.theme.master?.content.height).toBe(516);
  });
});
