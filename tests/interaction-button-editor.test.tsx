/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";

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
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const popup = () => [...container.querySelectorAll<HTMLDialogElement>("dialog[open]")].find((dialog) => dialog.textContent?.includes("Edit popup mini slide"))!;
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }
  async function start() { await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />)); await clickText("Interaction button"); }

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
    await clickText("Interaction button");
    await select("Interaction button appearance", "image"); await clickText("Choose or upload button image"); await clickLabel("Use Diagram.png");
    await select("Interaction button action", "block"); await select("Interaction target block", "heading");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[1]).toMatchObject({ data: { trigger: "image", imageSrc: assets[0].fileUrl, action: "block", targetBlockId: "heading" } });
    expect(container.querySelector('[data-slide-canvas] [aria-haspopup="dialog"] img')?.getAttribute("src")).toBe(assets[0].fileUrl);
  });

  it("provides eight resize handles and saves rotation on a popup object when applying", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    const editor = popup();
    expect(editor.querySelectorAll("[data-slide-resize-handle]")).toHaveLength(8);
    expect(editor.querySelector('[aria-label="Move richText object"]')).not.toBeNull();
    expect(editor.querySelector('[aria-label="Rotate richText object"]')).not.toBeNull();
    const field = editor.querySelector<HTMLInputElement>('[aria-label="Object rotation (degrees)"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "45");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(editor.querySelector<HTMLElement>("[data-slide-object-id]")?.style.rotate).toBe("45deg");
    await clickText("Apply popup", editor);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ slideFrame: { rotation: 45 } }] } } });
    await clickLabel("Undo");
    await clickText("Edit popup mini slide (1 objects)");
    expect(popup().querySelector<HTMLElement>("[data-slide-object-id]")?.style.rotate).toBe("");
    await clickText("Cancel", popup());
  });

  it("shares canvas alignment, snapping and borders with popup objects", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    const editor = popup();
    expect(editor.querySelector<HTMLInputElement>('[aria-label="Snap to guides"]')?.checked).toBe(true);
    expect(editor.querySelector('[aria-label="Snap to guides"]')?.closest('[aria-label="Popup canvas toolbar"]')).not.toBeNull();
    await act(async () => editor.querySelector<HTMLButtonElement>('[aria-label="Align object left"]')!.click());
    const width = editor.querySelector<HTMLInputElement>('[aria-label="Object border width"]')!;
    expect(width.value).toBe("0");
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "3"); width.dispatchEvent(new Event("input", { bubbles: true })); });
    await clickText("Apply popup", editor);
    expect((await saved()).lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ slideFrame: { x: 0 }, slideBorder: { width: 3 } }] } } });
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

  it("edits radar size and weight with undo, toggle, save and reload", async () => {
    await start();
    const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="Interaction button radar ${label}"]`)!;
    const trigger = () => container.querySelector<HTMLButtonElement>('[data-slide-canvas] [aria-label="Learn more"]')!;
    expect(field("size").value).toBe("3"); expect(field("weight").value).toBe("2");
    await input("Interaction button radar size", "7"); await input("Interaction button radar weight", "4");
    expect(trigger().style.getPropertyValue("--radar-size")).toBe("7px");
    expect(trigger().style.getPropertyValue("--radar-weight")).toBe("4px");
    await clickLabel("Undo"); expect(trigger().style.getPropertyValue("--radar-weight")).toBe("2px"); await clickLabel("Redo");
    await clickLabel("Interaction button radar");
    expect(field("size").disabled).toBe(true); expect(field("weight").disabled).toBe(true);
    expect(trigger().classList.contains("labeled-graphic-radar")).toBe(false);
    await clickLabel("Interaction button radar");
    expect(field("size").disabled).toBe(false); expect(field("weight").disabled).toBe(false);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { radarEnabled: true, radarSize: 7, radarWeight: 4 } });
    await act(async () => root.render(<EditorClient key="radar-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(trigger().style.getPropertyValue("--radar-size")).toBe("7px");
    expect(trigger().style.getPropertyValue("--radar-weight")).toBe("4px");
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

  it("accepts popup dimensions one digit at a time, restores empty drafts, and bounds values on blur", async () => {
    await start();
    const field = (name: string) => container.querySelector<HTMLInputElement>(`[aria-label="Interaction popup ${name}"]`)!;
    for (const [name, values] of [["width", ["", "1", "12", "128", "1280"]], ["height", ["", "3", "36", "360"]]] as const) {
      await act(async () => field(name).focus());
      for (const value of values) { await input(`Interaction popup ${name}`, value); expect(field(name).value).toBe(value); }
      await act(async () => field(name).blur());
    }
    await act(async () => field("height").focus()); await input("Interaction popup height", ""); await act(async () => field("height").blur());
    expect(field("height").value).toBe("360");
    await act(async () => field("width").focus()); await input("Interaction popup width", "9999"); await act(async () => field("width").blur());
    expect(field("width").value).toBe("1280");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { width: 1280, height: 360 } } });
    await act(async () => root.render(<EditorClient key="popup-size-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await clickLabel("Select interactionButton object from layers");
    expect(field("width").value).toBe("1280"); expect(field("height").value).toBe("360");
  });

  it("adds and configures ordinary slide blocks in a popup, applies once, saves, and reloads", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    for (const label of ["Heading", "Gallery", "Flip cards", "Interactive image", "Chart", "File", "Audio instruction"]) await clickText(label, popup());
    const templateDialog = () => [...popup().querySelectorAll<HTMLDialogElement>("dialog[open]")].find((dialog) => dialog.querySelector('[aria-label="Block categories"]'))!;
    for (const type of ["accordion", "processSteps", "knowledgeCheck", "survey", "statement", "link", "divider"] as const) {
      const template = blockTemplates.find((item) => item.type === type)!;
      await clickText("More blocks", popup());
      await clickText(template.category, templateDialog());
      await act(async () => [...templateDialog().querySelectorAll<HTMLButtonElement>("button")].find((item) => [...item.querySelectorAll("p")].some((paragraph) => paragraph.textContent === template.title))!.click());
    }
    expect(popup().querySelectorAll('[data-popup-editor-canvas] [data-slide-object-id]')).toHaveLength(15);
    const settings = popup().querySelector('[data-slide-object-settings]')!;
    expect(settings.querySelector('[aria-label="Position & size"]')).not.toBeNull();
    expect(settings.querySelector('[aria-label="Content & interaction"]')).not.toBeNull();
    await clickText("Apply popup", popup());
    const snapshot = await saved();
    const configured = snapshot.lessons[0].blocks[0];
    if (configured.type !== "interactionButton") throw new Error("Wrong type");
    expect(configured.data.popup.blocks.map((block) => block.type)).toEqual(["richText", "heading", "gallery", "flipCard", "labeledGraphic", "chart", "attachment", "audioInstruction", "accordion", "processSteps", "knowledgeCheck", "survey", "statement", "link", "divider"]);
    expect(configured.data.popup.blocks[1]).toMatchObject({ blockPadding: 0, slideBorderRadius: 0, slideTextLayout: { paddingX: 0, paddingY: 0, fitToText: true } });
    await clickLabel("Undo"); expect(container.textContent).toContain("Edit popup mini slide (1 objects)"); await clickLabel("Redo");
    await act(async () => root.render(<EditorClient key="popup-blocks-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    await clickLabel("Select interactionButton object from layers"); await clickText("Edit popup mini slide (15 objects)");
    expect(popup().querySelectorAll('[data-popup-editor-canvas] [data-slide-object-id]')).toHaveLength(15);
    await clickText("More blocks", popup());
    await act(async () => templateDialog().dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(popup().open).toBe(true); expect(templateDialog()).toBeUndefined();
    await clickText("Cancel", popup());
  });

  it("edits nested button mini slides without committing or closing their parent until Apply", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    const outer = popup();
    await clickText("Interaction button", outer);
    await clickText("Edit popup mini slide (1 objects)", outer);
    const nested = outer.querySelector<HTMLDialogElement>("dialog[open]")!;
    await clickText("Flip cards", nested);
    await clickText("Apply popup", nested);
    expect(outer.open).toBe(true); expect(outer.querySelector("dialog[open]")).toBeNull();
    expect(container.textContent).toContain("Edit popup mini slide (2 objects)");
    await clickText("Apply popup", outer);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ type: "richText" }, { type: "interactionButton", data: { popup: { blocks: [{ type: "richText" }, { type: "flipCard" }] } } }] } } });
  });

  it("uses the same animation settings and preview for popup objects", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)");
    const editor = popup(), effect = editor.querySelector<HTMLSelectElement>('[aria-label="Object entrance animation"]')!;
    expect(effect.value).toBe("slide-up");
    expect(editor.querySelector<HTMLInputElement>('[aria-label="Object animation duration"]')?.value).toBe("1000");
    const object = editor.querySelector<HTMLElement>('[data-popup-editor-canvas] [data-slide-object-id]')!;
    const animate = vi.fn(() => ({ cancel: vi.fn() })); Object.defineProperty(object, "animate", { configurable: true, value: animate });
    await act(async () => { effect.value = "slide-right"; effect.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => editor.querySelector<HTMLButtonElement>('[aria-label="Preview object animation"]')!.click());
    expect(animate).toHaveBeenCalledOnce();
    await clickText("Apply popup", editor);
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ slideAnimation: { effect: "slide-right", duration: 1000, delay: 0 } }] } } });
  });

  it("positions an audio guide inside a popup mini slide and keeps it when applying", async () => {
    await start(); await clickText("Edit popup mini slide (1 objects)"); await clickText("Audio instruction", popup());
    await act(async () => popup().querySelector<HTMLInputElement>('[aria-label="Audio instruction guide popup"]')!.click());
    const guide = popup().querySelector<HTMLElement>("[data-audio-guide]")!;
    expect(guide.parentElement?.hasAttribute("data-popup-editor-canvas")).toBe(true);
    await input("Audio guide explanation", "A custom guide within this mini slide.");
    await clickText("Apply popup", popup());
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ type: "richText" }, { type: "audioInstruction", data: { guide: { enabled: true, text: "A custom guide within this mini slide." } } }] } } });
  });
});
