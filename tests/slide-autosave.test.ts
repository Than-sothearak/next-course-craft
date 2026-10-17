import { afterEach, describe, expect, it, vi } from "vitest";
import { SlideDraftStore } from "../lib/slides/draft-store";

type Draft = { id: string; revision: number; text: string };
const initial: Draft = { id: "slide", revision: 0, text: "Original" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
afterEach(() => vi.useRealTimers());

describe("slide autosave coordination", () => {
  it("keeps in-flight edits and uses the returned revision for the next write", async () => {
    const first = deferred<Draft>();
    const persist = vi.fn<(value: Draft) => Promise<Draft>>().mockImplementationOnce(() => first.promise).mockImplementation(async (value) => ({ ...value, revision: value.revision + 1 }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "First edit" }));
    const pending = store.flush();
    store.update("slide", (value) => ({ ...value, text: "Typed while saving" }));
    first.resolve({ ...initial, text: "First edit", revision: 1 });
    expect(await pending).toBe(true);
    expect(persist.mock.calls.map(([value]) => [value.text, value.revision])).toEqual([["First edit", 0], ["Typed while saving", 1]]);
    expect(store.getSnapshot()).toMatchObject({ items: [{ text: "Typed while saving", revision: 2 }], dirtyIds: [], saving: false });
  });
  it("shares a running save rather than issuing overlapping revision writes", async () => {
    const waiting = deferred<Draft>(), persist = vi.fn(() => waiting.promise);
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "Edit" }));
    const first = store.flush(), second = store.flush();
    expect(first).toBe(second); expect(persist).toHaveBeenCalledTimes(1);
    waiting.resolve({ ...initial, text: "Edit", revision: 1 }); await first;
  });
  it("preserves a conflicting local draft and stops automatic retries", async () => {
    const persist = vi.fn<(value: Draft) => Promise<Draft>>().mockRejectedValue(Object.assign(new Error("Changed elsewhere"), { status: 409 }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "My local work" }));
    expect(await store.flush()).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ items: [{ text: "My local work", revision: 0 }], dirtyIds: ["slide"], failure: { conflict: true, message: "Changed elsewhere" } });
    expect(await store.flush()).toBe(false); expect(persist).toHaveBeenCalledTimes(1);
    await store.flush(true); expect(persist).toHaveBeenCalledTimes(2);
  });
  it("can retry a failed network request without losing the latest local edit", async () => {
    const persist = vi.fn<(value: Draft) => Promise<Draft>>().mockRejectedValueOnce(new Error("Offline")).mockImplementation(async (value) => ({ ...value, revision: 1 }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "First" })); await store.flush();
    store.update("slide", (value) => ({ ...value, text: "Latest" }));
    expect(await store.flush(true)).toBe(true);
    expect(persist.mock.calls[1][0].text).toBe("Latest"); expect(store.getSnapshot().failure).toBeNull();
  });
  it("resumes autosaving after the author corrects invalid content", async () => {
    const persist = vi.fn<(value: Draft) => Promise<Draft>>().mockRejectedValueOnce(Object.assign(new Error("Enter a slide name"), { status: 400 })).mockImplementation(async (value) => ({ ...value, revision: 1 }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "" })); await store.flush();
    expect(store.getSnapshot().failure?.validation).toBe(true);
    store.update("slide", (value) => ({ ...value, text: "Corrected" }));
    expect(store.getSnapshot().failure).toBeNull(); expect(await store.flush()).toBe(true);
  });
  it("undoes saved content using the current server revision and can redo it", async () => {
    const persist = vi.fn(async (value: Draft) => ({ ...value, revision: value.revision + 1 }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "Edited" })); await store.flush();
    store.undo("slide");
    expect(store.getSnapshot().items[0]).toEqual({ ...initial, revision: 1 });
    await store.flush(); expect(persist.mock.calls[1][0].revision).toBe(1);
    store.redo("slide"); expect(store.getSnapshot().items[0]).toEqual({ ...initial, text: "Edited", revision: 2 });
  });
  it("groups continuous typing into one undo operation", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01"));
    const store = new SlideDraftStore([initial], async (value) => value);
    store.update("slide", (value) => ({ ...value, text: "A" }), "title");
    vi.advanceTimersByTime(200); store.update("slide", (value) => ({ ...value, text: "AB" }), "title");
    store.undo("slide"); expect(store.getSnapshot().items[0].text).toBe("Original");
    expect(store.canUndo("slide")).toBe(false); store.redo("slide"); expect(store.getSnapshot().items[0].text).toBe("AB");
  });
  it("only leaves failed documents dirty after a partial save", async () => {
    const store = new SlideDraftStore([initial, { ...initial, id: "second" }], async (value) => { if (value.id === "second") throw new Error("Failed"); return { ...value, revision: 1 }; });
    for (const id of ["slide", "second"]) store.update(id, (value) => ({ ...value, text: "Edited" }));
    expect(await store.flush()).toBe(false); expect(store.getSnapshot().dirtyIds).toEqual(["second"]);
    expect(store.getSnapshot().items[0].revision).toBe(1);
  });
  it("accepts server normalization and ignores JSON key ordering", async () => {
    const persist = vi.fn(async (value: Draft) => ({ text: value.text.trim(), revision: value.revision + 1, id: value.id }));
    const store = new SlideDraftStore([initial], persist);
    store.update("slide", (value) => ({ ...value, text: "  Clean title  " }));
    await store.flush(); expect(persist).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().items[0].text).toBe("Clean title"); expect(store.getSnapshot().dirtyIds).toEqual([]);
  });
});
