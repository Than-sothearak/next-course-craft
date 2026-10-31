/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const source = "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
const data = { courseId: "hidden-controls", ...editorSnapshotSchema.parse({ title: "Media requirements", description: "", revision: 1, courseLayout: "slides", navigationMode: "restricted", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "first", sectionId: "section", title: "Watch and listen", order: 0, blocks: [
    { id: "video", version: 1, type: "video", slidePlayback: { autoPlay: false, showControls: false }, data: { src: source, mimeType: "video/webm" } },
    { id: "cropped", version: 1, type: "video", slidePlayback: { autoPlay: false, showControls: false }, slideCrop: { source, x: 25, y: 0, width: 50, height: 100 }, slideMedia: { source, width: 1600, height: 900 }, data: { src: source, mimeType: "video/webm" } },
    { id: "audio", version: 1, type: "audio", slidePlayback: { autoPlay: false, showControls: false }, data: { src: "/api/assets/bbbbbbbbbbbbbbbbbbbbbbbb/file", fileName: "Instructions", mimeType: "audio/mpeg" } },
  ] },
  { id: "second", sectionId: "section", title: "Next slide", order: 1, blocks: [] },
] }) };

describe("hidden media controls and restricted progress", () => {
  let root: Root; let container: HTMLDivElement; let save: ReturnType<typeof vi.fn>;
  const scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16)); vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    save = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); if (scrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollTo); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const settle = () => act(async () => vi.advanceTimersByTimeAsync(100));
  const control = (label: string) => container.querySelector<HTMLButtonElement>(`[data-slide-active="true"] [data-slide-footer] [aria-label="${label}"]`)!;
  const players = () => [...container.querySelectorAll<HTMLMediaElement>('[data-slide-active="true"] [data-slide-media-player]')];
  async function assertHidden() {
    expect(players()).toHaveLength(3);
    for (const player of players()) {
      await act(async () => { player.dispatchEvent(Object.assign(new MouseEvent("pointerover", { bubbles: true }), { pointerType: "mouse" })); player.focus(); player.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true }), { pointerType: "touch" })); });
      expect(player.controls).toBe(false);
    }
    expect(container.querySelector("[data-cropped-video-controls]")).toBeNull();
    expect(container.querySelectorAll('[data-slide-playback-controls="visible"]')).toHaveLength(0);
  }

  it.each([false, true])("keeps controls off after unlocking, replay, navigation and restored progress (standalone=%s)", async (standalone) => {
    const render = (key: string, resume: LearnerProgressSnapshot | null = null) => act(async () => root.render(<CoursePreview key={key} initialData={data} authorName="" initialLessonId="first" standalone={standalone} persistLocalProgress={false} progressAdapter={{ load: () => resume, save }} />));
    await render("initial"); await settle(); expect(control("Next").disabled).toBe(true); await assertHidden();
    for (const player of players()) await act(async () => player.dispatchEvent(new Event("ended")));
    await settle(); expect(control("Next").disabled).toBe(false); await assertHidden();
    const progress = save.mock.calls.at(-1)![1] as LearnerProgressSnapshot;
    expect(progress.interactedContentIds).toEqual(expect.arrayContaining(["video:watched", "cropped:watched", "audio:listened"]));
    for (const player of players()) player.currentTime = 8;
    await act(async () => control("Restart slide").click()); expect(players().every((player) => player.currentTime === 0)).toBe(true); await assertHidden(); expect(control("Next").disabled).toBe(false);
    await act(async () => control("Next").click()); await settle(); await act(async () => control("Previous").click()); await settle(); await assertHidden(); expect(control("Next").disabled).toBe(false);
    await render("resumed", progress); await settle(); await assertHidden(); expect(control("Next").disabled).toBe(false);
  });
});
