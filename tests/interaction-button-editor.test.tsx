/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Explore", order: 0, blocks: [] }] }) };
const assets = ([{ id: "a", name: "Diagram.png", mime: "image/png" }, { id: "b", name: "Video.webm", mime: "video/webm" }, { id: "c", name: "Voice.mp3", mime: "audio/mpeg" }]).map(({ id, name, mime }) => ({ id: id.repeat(24), originalName: name, contentType: mime, fileUrl: `/api/assets/${id.repeat(24)}/file`, size: 1200, createdAt: "2026-01-01" }));

describe("interaction button presentation authoring", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets } : { revision: 2 } })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const clickLabel = (label: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const clickText = (text: string, within: ParentNode = container) => act(async () => [...within.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const popup = () => [...container.querySelectorAll<HTMLDialogElement>("dialog[open]")].find((dialog) => dialog.textContent?.includes("Edit popup mini slide"))!;
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }
  async function start() { await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />)); await clickText("Interaction button"); await clickLabel("Toggle Content & interaction settings"); }

  it("adds and configures a button, supports undo, and saves and restores settings", async () => {
    await start();
    expect(container.querySelector('[data-slide-canvas] [aria-label="Learn more"]')).not.toBeNull();
    await clickLabel("Interaction icon headphones"); await clickLabel("Undo"); expect(container.querySelector('[aria-label="Interaction icon info"]')?.getAttribute("aria-pressed")).toBe("true"); await clickLabel("Redo");
    await input("Interaction button label", "Listen to a hint"); await clickLabel("Interaction button radar");
    await select("Interaction popup animation", "slide"); await input("Interaction popup width", "960"); await input("Interaction popup height", "540");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: "interactionButton", data: { label: "Listen to a hint", icon: "headphones", radarEnabled: false, popup: { animation: "slide", width: 960, height: 540 } } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector('[data-slide-canvas] [aria-label="Listen to a hint"]')?.classList.contains("labeled-graphic-radar")).toBe(false);
  });

  it("edits a mini slide with text, image, video and audio, applies once and can undo or cancel", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    await clickText("Text", popup());
    await clickText("Image", popup()); await clickLabel("Use Diagram.png");
    await clickText("Video", popup()); await clickLabel("Use Video.webm");
    await clickText("Audio", popup()); await clickLabel("Use Voice.mp3");
    expect(popup().querySelectorAll('[data-slide-object-id]')).toHaveLength(5);
    await clickText("Apply popup", popup()); expect(popup()).toBeUndefined();
    const snapshot = await saved(), block = snapshot.lessons[0].blocks[0];
    expect(block).toMatchObject({ data: { popup: { blocks: [{ type: "richText" }, { type: "richText" }, { type: "image", data: { src: assets[0].fileUrl } }, { type: "video", data: { src: assets[1].fileUrl } }, { type: "audio", data: { src: assets[2].fileUrl, fileName: "Voice.mp3" } }] } } });
    await clickLabel("Undo"); expect(container.textContent).toContain("Edit popup mini slide (1 objects)"); await clickLabel("Redo");
    await clickText("Edit popup mini slide (5 objects)"); await clickText("Text", popup()); await clickText("Cancel", popup());
    expect(container.textContent).toContain("Edit popup mini slide (5 objects)");
  });

  it("selects a custom trigger image and links an existing block", async () => {
    const initial = structuredClone(data); initial.lessons[0].blocks = editorSnapshotSchema.parse({ ...data, lessons: [{ ...data.lessons[0], blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "More information", level: 2 } }] }] }).lessons[0].blocks;
    await act(async () => root.render(<EditorClient initialData={initial} authorName="Author" />));
    await clickText("Interaction button"); await clickLabel("Toggle Content & interaction settings");
    await select("Interaction button appearance", "image"); await clickText("Choose or upload button image"); await clickLabel("Use Diagram.png");
    await select("Interaction button action", "block"); await select("Interaction target block", "heading");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[1]).toMatchObject({ data: { trigger: "image", imageSrc: assets[0].fileUrl, action: "block", targetBlockId: "heading" } });
    expect(container.querySelector('[data-slide-canvas] [aria-haspopup="dialog"] img')?.getAttribute("src")).toBe(assets[0].fileUrl);
  });

  it("saves fixed button size and alignment with undo and reload", async () => {
    await start(); await input("Interaction button size", "96.25");
    await clickLabel("Interaction button position bottom right");
    expect(container.querySelector('[data-slide-canvas] [data-interaction-button-container]')?.getAttribute("data-button-position")).toBe("bottom-right");
    await clickLabel("Undo"); expect(container.querySelector('[aria-label="Interaction button position center"]')?.getAttribute("aria-pressed")).toBe("true"); await clickLabel("Redo");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { buttonSize: 96.25, position: "bottom-right", iconSize: 40 } });
    await act(async () => root.render(<EditorClient key="sizing-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector('[data-slide-canvas] [data-interaction-button-container]')?.getAttribute("data-button-position")).toBe("bottom-right");
  });

  it("accepts button and decimal icon sizes typed one digit at a time", async () => {
    await start();
    const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    await act(async () => field("Interaction button size").focus());
    for (const value of ["", "1", "12", "128"]) { await input("Interaction button size", value); expect(field("Interaction button size").value).toBe(value); }
    await act(async () => field("Interaction icon size").focus());
    for (const value of ["", "2", "24", "24.5"]) { await input("Interaction icon size", value); expect(field("Interaction icon size").value).toBe(value); }
    await act(async () => field("Interaction icon size").blur());
    expect(container.querySelector('[data-slide-canvas] [aria-haspopup="dialog"] svg')?.getAttribute("width")).toBe("24.5");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { buttonSize: 128, iconSize: 24.5 } });
    await act(async () => root.render(<EditorClient key="typed-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector('[data-slide-canvas] [aria-haspopup="dialog"] svg')?.getAttribute("width")).toBe("24.5");
  });
});
