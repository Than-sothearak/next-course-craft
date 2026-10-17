/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditorClient } from "../app/courses/[courseId]/slides/edit/slide-editor-client";
import { createTemplateSlide } from "../lib/slides/templates";
import { defaultSlideTheme, slideThemePresets } from "../lib/slides/themes";
import { slideSnapshotSchema, type SlideRecord } from "../lib/slides/schema";
import type { SlideTemplateId } from "../lib/slides/template-definitions";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../app/courses/[courseId]/edit/_components/media-library-dialog", () => ({ MediaLibraryDialog: ({ open, onSelect }: { open: boolean; onSelect: (asset: { fileUrl: string; originalName: string }) => void }) => open ? <button aria-label="Pick course image" onClick={() => onSelect({ fileUrl: "/api/assets/507f1f77bcf86cd799439013/file", originalName: "Students learning" })}>Pick course image</button> : null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("template-first slide authoring", () => {
  let container: HTMLDivElement, root: Root, documents: SlideRecord[], patches: Array<Record<string, unknown>>, themeWrites: Array<Record<string, unknown>>, conflict: boolean;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    documents = []; patches = []; themeWrites = []; conflict = false;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input), body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (init?.method === "PATCH" && path.endsWith("/theme")) { themeWrites.push(body); return Response.json({ theme: body.theme, revision: Number(body.revision) + 1 }); }
      if (init?.method === "PATCH") {
        patches.push(body);
        if (conflict) return Response.json({ error: "This slide changed elsewhere." }, { status: 409 });
        const id = path.split("/").at(-1)!;
        const saved = { ...slideSnapshotSchema.parse(body), id, revision: Number(body.revision) + 1 };
        documents = documents.map((slide) => slide.id === id ? saved : slide); return Response.json(saved);
      }
      if (init?.method === "POST") {
        const slide = { ...createTemplateSlide(body.templateId as SlideTemplateId, documents.length), id: `slide-${documents.length + 1}` };
        documents.push(slide); return Response.json(slide, { status: 201 });
      }
      return Response.json(documents);
    }));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  function mount(id: SlideTemplateId = "cover") {
    documents = [{ ...createTemplateSlide(id, 0), id: "slide-1" }];
    act(() => root.render(<SlideEditorClient courseId="course" courseTitle="Designing better lessons" initialSlides={documents} initialTheme={{ theme: defaultSlideTheme, revision: 0 }} />));
  }
  function button(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label)!;
  }
  async function click(label: string) { await act(async () => { button(label).click(); for (let index = 0; index < 8; index++) await Promise.resolve(); }); }
  async function autosave() { await act(async () => { await vi.advanceTimersByTimeAsync(1_000); }); }
  async function editHeading(text: string) { await act(async () => { const heading = container.querySelector<HTMLElement>('[contenteditable="true"][aria-label="Heading"]')!; heading.textContent = text; heading.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" })); }); }

  it("adds a prebuilt layout as a block while preserving the page's existing content", async () => {
    mount();
    expect(button("Simple").getAttribute("aria-pressed")).toBe("true");
    await click("Add object");
    expect(container.querySelector("dialog[open]")?.textContent).toContain("Insert a prebuilt object");
    await click("Prebuilt object layoutEditable text, images and cards");
    expect(container.querySelector("dialog[open]")?.textContent).toContain("Add a prebuilt layout block");
    expect(container.querySelector("button button")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    await click("Use Text + Image template");
    await autosave();
    expect(documents).toHaveLength(1);
    expect(documents[0].composition?.layers[0]).toMatchObject({ kind: "template", content: { id: "cover" } });
    expect(documents[0].composition?.layers.slice(1).map((block) => block.kind)).toEqual(["text", "text", "text", "image"]);
    expect(documents[0].composition?.layers.slice(1).every((block) => block.placement)).toBe(true);
    expect(documents[0].schemaVersion).toBe(3);
    expect(container.querySelector('[data-slide-viewport] [data-object-canvas]')).not.toBeNull();
  });
  it("edits inline, autosaves, switches modes and viewports without resetting, and supports undo/redo", async () => {
    mount(); const original = documents[0].template!.slots.title;
    await editHeading("A teacher’s own heading");
    await click("Advanced"); await click("Mobile preview"); await click("Simple");
    expect(container.querySelector('[data-slide-viewport="mobile"]')).not.toBeNull();
    expect(container.querySelector('[contenteditable="true"][aria-label="Heading"]')?.textContent).toBe("A teacher’s own heading");
    await autosave();
    expect(documents[0].template!.slots.title).toEqual({ type: "text", content: "A teacher’s own heading" });
    expect(patches[0]).not.toHaveProperty("selectedSlot"); expect(patches[0]).not.toHaveProperty("viewport");
    await click("Undo slide edit"); await autosave(); expect(documents[0].template!.slots.title).toEqual(original);
    await click("Redo slide edit"); await autosave(); expect(documents[0].template!.slots.title).toEqual({ type: "text", content: "A teacher’s own heading" });
    expect(documents[0].revision).toBe(3);
  });
  it("replaces images through the shared course picker and saves accessibility text", async () => {
    mount("image-text"); await click("Choose image"); await click("Pick course image"); await autosave();
    expect(documents[0].template!.slots.image).toEqual({ type: "image", src: "/api/assets/507f1f77bcf86cd799439013/file", alt: "Students learning" });
    expect(container.querySelector('[data-slide-viewport] img')?.getAttribute("alt")).toBe("Students learning");
  });
  it("retains authored content while replacing a template and resets only its design", async () => {
    mount("image-text"); await editHeading("Keep this heading");
    await click("Choose image"); await click("Pick course image");
    await click("Design"); await click("Change template"); await click("Use Title + Description template"); await autosave();
    expect(documents[0].template!.slots.title).toEqual({ type: "text", content: "Keep this heading" });
    expect(documents[0].template!.retainedSlots.image).toMatchObject({ alt: "Students learning" });
    await click("Design"); await click("Change template"); await click("Use Text + Image template");
    await click("Design"); await click("Reset design"); await autosave();
    expect(documents[0].template!.slots.image).toMatchObject({ alt: "Students learning" });
    expect(documents[0].template!.slots.title).toMatchObject({ content: "Keep this heading" });
  });
  it("applies course themes without rewriting slide content", async () => {
    mount(); const original = structuredClone(documents[0]);
    await click("Theme"); await click("Use Dark Presentation theme"); await autosave();
    expect(themeWrites[0]).toMatchObject({ theme: slideThemePresets.find((preset) => preset.id === "dark")!.theme, revision: 0 });
    expect(documents[0]).toEqual(original); expect(patches).toHaveLength(0);
    const surface = container.querySelector<HTMLElement>('[data-slide-viewport] [data-slide-template]')!;
    expect(surface.style.getPropertyValue("--slide-primary")).toBe("#b4a5ff");
    await act(async () => container.querySelector<HTMLButtonElement>('dialog[open] button[aria-label="Close dialog"]')!.click());
    await click("Design");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Slide primary color"]')!.value).toBe("#b4a5ff");
  });
  it("keeps local content visible after a revision conflict and stops automatic retries", async () => {
    mount(); conflict = true; await editHeading("Do not discard this work"); await autosave();
    expect(container.querySelector('[contenteditable="true"][aria-label="Heading"]')?.textContent).toBe("Do not discard this work");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Your edits are kept in this tab");
    await autosave(); expect(patches).toHaveLength(1); expect(button("Download draft")).toBeTruthy();
  });
});
