/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({ title: "Course title", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", subtitle: "Welcome" } },
  { id: "content", sectionId: "section", title: "Content", order: 1, blocks: [{ id: "video", version: 1, type: "video", data: { src: "/clip.webm", mimeType: "video/webm" } }] },
  { id: "quiz", sectionId: "section", title: "Quiz", order: 2, lessonType: "quiz", blocks: [] },
] }) };
const asset = { id: "123456789012345678901234", originalName: "Intro.mp3", contentType: "audio/mpeg", fileUrl: "/api/assets/123456789012345678901234/file", size: 1200, createdAt: "2026-01-01" };

describe("cover settings and editor footer navigation", () => {
  let root: Root; let container: HTMLDivElement; let fetchMock: ReturnType<typeof vi.fn>; let play: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets: [asset] } : { revision: 2 } })); vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const click = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const select = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); return editorSnapshotSchema.parse(JSON.parse(fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT")![1].body)); }
  const render = () => act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));

  it("sets independent element positions and pixel offsets, then saves and restores them", async () => {
    await render(); await act(async () => button("Cover content bottom left").click());
    await select("Title position", "top-left"); await input("Title horizontal offset", "12.34");
    await select("Subtitle position", "middle-right"); await select("Start button position", "bottom-right"); await input("Start button vertical offset", "-20");
    const snapshot = await saved();
    expect(snapshot.lessons[0].slideCover).toMatchObject({ contentPosition: "bottom-left", titleLayout: { position: "top-left", offsetX: 12.34 }, subtitleLayout: { position: "middle-right" }, buttonLayout: { position: "bottom-right", offsetY: -20 } });
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Title position"]')?.value).toBe("top-left");
    expect(container.querySelector('[data-slide-canvas] [data-cover-position="button"]')).not.toBeNull();
  });

  it("keeps welcome notices in cover settings and removes the cover audio controls", async () => {
    await render(); expect(container.querySelector('[aria-label="Instruction audio trigger"]')).toBeNull(); await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Show cover notice"]')!.click());
    await input("Cover notice title", "Before you start"); await input("Cover notice text", "Click Next after reading each slide."); await select("Cover notice trigger", "start");
    await click("Preview welcome notice"); expect(container.querySelector("dialog[open]")?.textContent).toContain("Before you start"); await click("Got it");
    expect(play).not.toHaveBeenCalled();
    const snapshot = await saved(); expect(snapshot.lessons[0].slideCover?.instructions).toMatchObject({ noticeEnabled: true, noticeTrigger: "start", noticeTitle: "Before you start" });
  });

  it("navigates cover, content, and quiz slides and restarts media without changing authored content", async () => {
    await render();
    const next = () => [...container.querySelectorAll<HTMLButtonElement>('[data-slide-canvas] button')].find((button) => button.textContent === "Next")!;
    const previous = () => [...container.querySelectorAll<HTMLButtonElement>('[data-slide-canvas] button')].find((button) => button.textContent === "Previous")!;
    expect(previous().disabled).toBe(true); await act(async () => next().click());
    const media = container.querySelector<HTMLMediaElement>('[data-slide-media-player="video"]')!; media.currentTime = 4;
    await act(async () => button("Restart slide").click()); expect(media.currentTime).toBe(0); expect(play).toHaveBeenCalled();
    await act(async () => next().click()); expect(next().disabled).toBe(true); expect(previous().disabled).toBe(false);
    await act(async () => previous().click()); expect(container.querySelector('[data-slide-object-id="video"]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("adds an audio instruction block on the cover, configures its display and restores it after saving", async () => {
    await render(); await click("Audio instruction"); await act(async () => button("Toggle Content & interaction settings").click());
    await click("Choose or upload instruction audio"); await act(async () => button("Use Intro.mp3").click());
    const toggle = (label: string) => container.querySelector<HTMLInputElement>('[aria-label="Audio instruction ' + label + '"]')!;
    await act(async () => toggle("autoplay on slide").click()); await act(async () => toggle("show icon").click());
    await input("Audio instruction text", "Listen before starting");
    const canvas = () => container.querySelector('[data-slide-canvas] [data-slide-cover-objects]')!;
    expect(canvas().querySelector("[data-audio-instruction] button svg")).toBeNull(); expect(canvas().textContent).toContain("Listen before starting");
    await act(async () => toggle("show text").click()); expect(canvas().querySelector("[data-audio-instruction] button")).toBeNull();
    await act(async () => button("Undo").click()); expect(canvas().textContent).toContain("Listen before starting");
    const snapshot = await saved(); expect(snapshot.lessons[0].blocks[0]).toMatchObject({ type: "audioInstruction", data: { src: asset.fileUrl, autoPlay: true, showIcon: false, showText: true, label: "Listen before starting" } });
    await act(async () => root.render(<EditorClient key="audio-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(canvas().textContent).toContain("Listen before starting"); expect(play).not.toHaveBeenCalled();
  });

  it("converts existing cover audio into a removable block without restoring it after deletion", async () => {
    const legacy = structuredClone(initialData); legacy.lessons[0].slideCover!.instructions = { audioSrc: asset.fileUrl, audioName: "Intro.mp3", audioTrigger: "cover", noticeEnabled: false, noticeTitle: "Welcome", noticeText: "Read", noticeTrigger: "cover", firstVisitOnly: true };
    await act(async () => root.render(<EditorClient initialData={legacy} authorName="Author" />));
    const frame = container.querySelector('[data-slide-canvas] [data-slide-object-id]')!;
    expect(frame.querySelector("audio")?.getAttribute("src")).toBe(asset.fileUrl);
    await act(async () => frame.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    await act(async () => button("Toggle Content & interaction settings").click());
    await act(async () => button("Remove instruction audio file").click());
    expect(container.querySelector('[data-slide-canvas] audio')?.hasAttribute("src")).toBe(false); await act(async () => button("Undo").click());
    await act(async () => button("Delete object").click()); const snapshot = await saved();
    expect(snapshot.lessons[0].blocks).toEqual([]); expect(snapshot.lessons[0].slideCover?.instructions?.audioSrc).toBe("");
    await act(async () => root.render(<EditorClient key="deleted-audio-reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(container.querySelector('[data-slide-canvas] audio')).toBeNull();
  });

  it("configures and previews all three navigation tips from the editor footer", async () => {
    await render(); await click("Master slide"); await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Enable navigation guide"]')!.click());
    await input("Next button guide text", "Use Next to continue."); await act(async () => button("Show navigation guide").click());
    const tip = () => container.querySelector('[role="dialog"][aria-label="Navigation guide"]');
    expect(tip()?.textContent).toContain("Use Next to continue.");
    await click("Next tip"); expect(tip()?.textContent).toContain("Return to a previous slide");
    await click("Next tip"); await act(async () => tip()!.querySelector<HTMLButtonElement>('[data-guide-advance]')!.click()); expect(tip()).toBeNull();
    expect((await saved()).slideMaster?.navigationGuide).toMatchObject({ enabled: true, firstVisitOnly: true, nextText: "Use Next to continue." });
  });
});
