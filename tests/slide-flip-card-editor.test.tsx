/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { InteractiveFlipCard } from "@/app/courses/[courseId]/preview/interactive-blocks";
import { defaultFlipCardLayout } from "@/lib/editor/flip-cards";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial = () => ({ courseId: "slides", ...editorSnapshotSchema.parse({ title: "Cards", description: "", revision: 1, courseLayout: "slides", slideMaster: { objectLayout: "canvas" }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Practice", order: 0, blocks: [] }] }) });

describe("flip-card canvas authoring", () => {
  let root: Root, container: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets: [{ id: "asset", originalName: "Card.png", contentType: "image/png", size: 100, fileUrl: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", createdAt: "2026-01-01" }] } : { revision: 2 } }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close; });
  const click = (label: string) => act(async () => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const clickText = (text: string, scope: ParentNode = container) => act(async () => [...scope.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const input = (label: string, value: string) => act(async () => { const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  const select = (label: string, value: string) => act(async () => { const field = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
  async function start() { await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />)); await clickText("Flip cards"); }
  const cards = () => [...container.querySelectorAll<HTMLElement>('[data-slide-flip-card-editor] [data-flip-card-id]')];
  const choose = (index: number) => act(async () => cards()[index].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
  async function saved() { await act(async () => vi.advanceTimersByTimeAsync(1000)); const request = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT"); expect(request).toBeDefined(); return editorSnapshotSchema.parse(JSON.parse(request![1].body)); }

  it("edits both faces, duplicates independently, reorders, and saves with undo and reload", async () => {
    await start(); expect(cards()).toHaveLength(3);
    const ids = cards().map((card) => card.dataset.flipCardId);
    await choose(1);
    await input("Canvas card 2 front text", "New question");
    await click("Edit card back"); await input("Canvas card 2 back text", "New answer");
    await click("Duplicate selected card"); expect(cards()).toHaveLength(4);
    expect(cards()[2].dataset.flipCardId).not.toBe(ids[1]);
    await click("Move selected card right");
    const snapshot = await saved(), block = snapshot.lessons[0].blocks[0];
    if (block.type !== "flipCard") throw new Error("Wrong block");
    expect(block.data.cards[1]).toMatchObject({ id: ids[1], front: { text: "New question" }, back: { text: "New answer" } });
    expect(block.data.cards[3]).toMatchObject({ front: { text: "New question" }, back: { text: "New answer" } });
    await click("Undo"); expect(cards()[2].dataset.flipCardId).toBe(block.data.cards[3].id);
    await click("Redo"); expect(cards()[3].dataset.flipCardId).toBe(block.data.cards[3].id);
    await act(async () => root.render(<EditorClient key="reload" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    expect(cards()).toHaveLength(4);
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Canvas card 2 front text"]')?.value).toBe("New question");
  });

  it("inherits master colors, retains per-card overrides, resets them, and saves grid controls", async () => {
    await start();
    await input("Card background color hex code", "#112233");
    await input("Card 2 background color hex code", "#ff8800");
    await input("Card background color hex code", "#223344");
    expect(cards()[0].style.backgroundColor).toBe("rgb(34, 51, 68)"); expect(cards()[1].style.backgroundColor).toBe("rgb(255, 136, 0)");
    await click("Use master colors for card 2"); expect(cards()[1].style.backgroundColor).toBe("rgb(34, 51, 68)");
    await select("Flip card grid mode", "custom"); await select("Cards per row", "2");
    await input("Flip card object padding", "24"); await input("Flip card card padding", "20");
    await input("Flip card column gap", "18"); await input("Flip card row gap", "14");
    await select("Flip card text alignment", "left"); await input("Flip card corner radius", "8");
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { cardsPerRow: 2, presentationLayout: { mode: "custom", padding: 24, cardPadding: 20, columnGap: 18, rowGap: 14, textAlign: "left", borderRadius: 8 } } });
    for (const standalone of [false, true]) {
      await act(async () => root.render(<CoursePreview key={String(standalone)} initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" initialLessonId="slide" persistLocalProgress={false} standalone={standalone} />));
      const grid = container.querySelector<HTMLElement>('[data-slide-active="true"] [data-flip-card-grid]')!;
      expect(grid.dataset.flipCardColumns).toBe("2"); expect(grid.dataset.flipCardRows).toBe("2"); expect(grid.style.padding).toBe("24px");
    }
  });

  it("replaces one face from course media and previews without changing authored cards", async () => {
    await start(); await choose(0); await click("Edit card back"); await click("Replace selected card image");
    await click("Use Card.png");
    expect(container.querySelector('[aria-label="Replace card 1 back image"] img')?.getAttribute("src")).toBe("/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file");
    await click("Preview flip cards");
    expect(container.querySelector('[aria-label="Flip card 1 to reveal the back"]')).not.toBeNull();
    await click("Flip card 1 to reveal the back"); await clickText("Back to editing");
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { cards: expect.arrayContaining([expect.objectContaining({ back: expect.objectContaining({ type: "image", src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file" }) })]) } });
  });

  it("keeps popup card edits local until Apply and discards Cancel", async () => {
    await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />));
    await clickText("Interaction button"); await clickText("Edit popup mini slide (1 objects)");
    const popup = () => container.querySelector<HTMLDialogElement>('dialog[open]')!;
    await clickText("Flip cards", popup());
    expect(cards()).toHaveLength(3); await choose(0); await input("Canvas card 1 front text", "Popup question");
    await clickText("Cancel", popup());
    expect(container.textContent).toContain("Edit popup mini slide (1 objects)");
    await clickText("Edit popup mini slide (1 objects)"); await clickText("Flip cards", popup());
    await choose(0); await input("Canvas card 1 front text", "Applied question"); await clickText("Apply popup", popup());
    const snapshot = await saved();
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ type: "richText" }, { type: "flipCard", data: { cards: expect.arrayContaining([expect.objectContaining({ front: { type: "text", text: "Applied question" } })]) } }] } } });
  });

  it("preserves learner reveal identity when a card is reordered or duplicated", async () => {
    const cards = [{ id: "original", frontLabel: "Q", backLabel: "A", front: { type: "text" as const, text: "Question" }, back: { type: "text" as const, text: "Answer" } }];
    const reveal = vi.fn();
    await act(async () => root.render(<InteractiveFlipCard blockId="block" cards={cards} presentation presentationLayout={defaultFlipCardLayout} onCardReveal={reveal} />));
    await click("Flip card 1 to reveal the back"); expect(reveal).toHaveBeenCalledWith("block:original");
    await act(async () => root.render(<InteractiveFlipCard blockId="block" cards={[{ ...cards[0], id: "copy" }, cards[0]]} presentation onCardReveal={reveal} />));
    expect(container.querySelector('[aria-label="Show the front of card 2"]')).not.toBeNull();
    await click("Flip card 1 to reveal the back"); expect(reveal).toHaveBeenLastCalledWith("block:copy");
  });

  it("hides card actions while the block style or image picker is open and restores them on close", async () => {
    await start(); await choose(0); await saved(); fetchMock.mockClear();
    const toolbar = () => document.querySelector<HTMLElement>('[aria-label="Selected flip card actions"]')!;
    expect(toolbar().hidden).toBe(false);
    await clickText("Change block style");
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(toolbar().hidden).toBe(true);
    await click("Close block picker"); expect(toolbar().hidden).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await click("Replace selected card image"); expect(toolbar().hidden).toBe(true);
    await click("Close dialog"); expect(toolbar().hidden).toBe(false);
    expect(cards()).toHaveLength(3);
  });

  it("keeps popup card actions available in their own dialog but hides them for a nested style picker", async () => {
    await act(async () => root.render(<EditorClient initialData={initial()} authorName="Author" />));
    await clickText("Interaction button"); await clickText("Edit popup mini slide (1 objects)");
    const popup = container.querySelector<HTMLDialogElement>('dialog[open]')!;
    await clickText("Flip cards", popup); await choose(0);
    const toolbar = () => popup.querySelector<HTMLElement>('[aria-label="Selected flip card actions"]')!;
    expect(toolbar().hidden).toBe(false);
    await clickText("Change block style", popup);
    const stylePicker = popup.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(stylePicker).not.toBeNull();
    expect(toolbar().hidden).toBe(true);
    await act(async () => stylePicker.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click());
    expect(toolbar().hidden).toBe(false);
    expect(popup.open).toBe(true); expect(cards()).toHaveLength(3);
  });

  it("previews keyboard reordering, commits on drop, and cancels without saving", async () => {
    await start(); await saved(); fetchMock.mockClear();
    const ids = cards().map((card) => card.dataset.flipCardId);
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="Reorder flip card 1"]')!;
    const key = (value: string) => act(async () => handle.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true })));
    const settingsIds = () => [...container.querySelectorAll<HTMLElement>('[data-flip-card-settings]')].map((element) => element.dataset.flipCardSettings);
    await key(" "); await key("ArrowDown");
    expect(settingsIds()).toEqual([ids[1], ids[0], ids[2]]);
    expect(cards().map((card) => card.dataset.flipCardId)).toEqual(ids);
    await key("Escape"); expect(settingsIds()).toEqual(ids);
    await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(fetchMock).not.toHaveBeenCalled();
    await key(" "); await key("ArrowDown"); await key("Enter");
    expect(cards().map((card) => card.dataset.flipCardId)).toEqual([ids[1], ids[0], ids[2]]);
    await click("Undo"); expect(cards().map((card) => card.dataset.flipCardId)).toEqual(ids);
    await click("Redo");
    const snapshot = await saved();
    const block = snapshot.lessons[0].blocks[0];
    expect(block.type === "flipCard" && block.data.cards.map((card) => card.id)).toEqual([ids[1], ids[0], ids[2]]);
  });
});
