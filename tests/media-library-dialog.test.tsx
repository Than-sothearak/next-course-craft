/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryDialog } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import type { MediaLibraryKind } from "@/lib/media/library";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const assets = [
  { id: "v", originalName: "Zebra.mp4", contentType: "video/mp4", size: 400, fileUrl: "/video.mp4", createdAt: "2026-01-03" },
  { id: "a", originalName: "Alpha.wav", contentType: "audio/wav", size: 200, fileUrl: "/audio.wav", createdAt: "2026-01-02" },
  { id: "t", originalName: "Notes.txt", contentType: "text/plain", size: 100, fileUrl: "/notes.txt", createdAt: "2026-01-01" },
];

describe("shared media picker", () => {
  let root: Root, container: HTMLDivElement;
  const select = vi.fn(), close = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ assets })));
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { Object.defineProperty(this, "paused", { configurable: true, value: true }); });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = (embedded = false, open = true, kind: MediaLibraryKind = "attachment") => act(async () => root.render(<MediaLibraryDialog courseId="course" kind={kind} open={open} embedded={embedded} onSelect={select} onClose={close} />));
  const click = (name: string) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!.click());
  const playing = (player: HTMLMediaElement) => { Object.defineProperty(player, "paused", { configurable: true, value: false }); player.dispatchEvent(new Event("play")); };
  const ids = () => [...container.querySelectorAll<HTMLElement>("[data-media-asset-id]")].map(item => item.dataset.mediaAssetId);
  const setFilter = (label: string, value: string) => act(async () => {
    const field = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
    if (field instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); }
  });

  it.each([false, true])("keeps preview controls independent from selection (embedded=%s)", async embedded => {
    await render(embedded);
    const video = container.querySelector("video")!, audio = container.querySelector("audio")!;
    expect(video.controls && audio.controls).toBe(true);
    expect(video.closest("button")).toBeNull(); expect(audio.closest("button")).toBeNull();
    await act(async () => { playing(video); playing(audio); });
    expect(video.paused).toBe(true); expect(audio.paused).toBe(false);
    expect(select).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    await click("Use Alpha.wav");
    expect(audio.paused).toBe(true);
    expect(select).toHaveBeenCalledExactlyOnceWith(assets[1]); expect(close).toHaveBeenCalledTimes(1);
  });

  it("pauses a preview when filtered out, externally closed, or unmounted", async () => {
    await render(true);
    const video = container.querySelector("video")!;
    await act(async () => playing(video));
    await setFilter("Filter media by file type", "audio/wav");
    expect(video.paused).toBe(true);
    const audio = container.querySelector("audio")!;
    await act(async () => playing(audio));
    await render(true, false);
    expect(audio.paused).toBe(true);
    await render(true);
    const reopened = container.querySelector("audio")!;
    await act(async () => playing(reopened));
    await act(async () => root.render(null));
    expect(reopened.paused).toBe(true);
  });

  it.each(["header", "footer", "backdrop", "Escape"])("pauses playback when closed using %s", async action => {
    await render();
    const video = container.querySelector("video")!;
    await act(async () => playing(video));
    if (action === "header") await click("Close media library");
    else await act(async () => {
      const backdrop = container.querySelector<HTMLElement>("[data-media-library]")!;
      if (action === "backdrop") backdrop.click();
      else if (action === "Escape") backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      else [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Close")!.click();
    });
    expect(video.paused).toBe(true); expect(close).toHaveBeenCalledTimes(1);
  });

  it("combines search, file type, sorting, and clear filters without selecting a file", async () => {
    await render();
    await setFilter("Sort media", "name-asc"); expect(ids()).toEqual(["a", "t", "v"]);
    await setFilter("Search media", "ALPHA audio"); expect(ids()).toEqual(["a"]);
    await setFilter("Filter media by file type", "video/mp4"); expect(ids()).toEqual([]);
    expect(container.textContent).toContain("No matching media");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Clear filters")!.click());
    expect(ids()).toEqual(["a", "t", "v"]); expect(select).not.toHaveBeenCalled();
  });

  it("searches older files loaded from later API pages", async () => {
    vi.mocked(fetch).mockImplementation(async url => String(url).includes("?cursor=") ? Response.json({ assets: assets.slice(1), nextCursor: null }) : Response.json({ assets: assets.slice(0, 1), nextCursor: "next-page" }));
    await render();
    expect(fetch).toHaveBeenCalledWith("/api/courses/course/assets?cursor=next-page", { cache: "no-store" });
    await setFilter("Search media", "notes"); expect(ids()).toEqual(["t"]);
  });

  it("reports a failed preview and still allows explicit file selection", async () => {
    await render();
    await act(async () => container.querySelector("video")!.dispatchEvent(new Event("error")));
    expect(container.textContent).toContain("cannot be previewed");
    await click("Use Zebra.mp4"); expect(select).toHaveBeenCalledExactlyOnceWith(assets[0]);
  });
});
