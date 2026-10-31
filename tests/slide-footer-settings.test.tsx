/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorClient } from "@/app/courses/[courseId]/edit/_components/editor-client";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), forward: vi.fn() }) }));
vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({ DashboardNavbar: ({ primaryAction }: { primaryAction: ReactNode }) => <header>{primaryAction}</header> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData = { courseId: "slides", ...editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 1, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }],
}) };
const assets = ["One", "Two", "Three"].map((name, index) => ({ id: `12345678901234567890123${index}`, originalName: `Brand ${name}.png`, contentType: "image/png", fileUrl: `/api/assets/12345678901234567890123${index}/file`, size: 3000, createdAt: "2026-01-01" }));

describe("master slide footer settings", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith("/assets") ? { assets } : { revision: 2 } }));
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  const clickText = (text: string) => act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!.click());
  const changeSelect = (label: string, value: string) => act(async () => { const select = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  const input = (label: string, value: string) => act(async () => { const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); });
  async function saved() {
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const call = fetchMock.mock.calls.findLast(([, init]) => init?.method === "PUT");
    expect(call).toBeDefined();
    return editorSnapshotSchema.parse(JSON.parse(call![1].body));
  }

  it("adds, replaces, orders, and removes logos, then saves and restores text and styling", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await changeSelect("Footer content", "both");
    await input("Master footer text", "Our training partners");
    for (const asset of assets) {
      await clickText("Add footer logo");
      expect(container.querySelector<HTMLInputElement>('[aria-label="Upload image"]')?.accept).toContain("image/png");
      await act(async () => button(`Use ${asset.originalName}`).click());
    }
    const first = await saved();
    expect(first.slideMaster?.footer?.logos.map((logo) => logo.src)).toEqual(assets.map((asset) => asset.fileUrl));
    const originalId = first.slideMaster!.footer!.logos[0].id;
    await act(async () => button("Replace footer logo 1").click());
    await act(async () => button("Use Brand Three.png").click());
    const replaced = await saved();
    expect(replaced.slideMaster?.footer?.logos[0]).toMatchObject({ id: originalId, src: assets[2].fileUrl });
    await act(async () => button("Move footer logo 3 earlier").click());
    await act(async () => button("Move footer logo 2 earlier").click());
    await act(async () => button("Remove footer logo 2").click());
    await input("Footer logo 1 description", "Training partner");
    await input("Footer horizontal padding", "36"); await input("Footer vertical padding", "6");
    await input("Footer logo horizontal gap", "16"); await input("Footer logo vertical gap", "6");
    await changeSelect("Footer logo justification", "right"); await changeSelect("Footer logo vertical alignment", "bottom");
    await input("Footer background color", "#172554"); await input("Footer text color", "#ffffff");
    await input("Footer border color", "#f59e0b"); await input("Footer border width", "3");
    await act(async () => button("Footer top border").click());
    expect(container.querySelector<HTMLElement>('[data-slide-footer]')?.style.borderTopWidth).toBe("0px");
    await act(async () => button("Footer top border").click());
    await act(async () => button("Show slide numbers").click());
    const snapshot = await saved();
    expect(snapshot.slideMaster).toMatchObject({ footerText: "Our training partners", showSlideNumber: false, footer: { content: "both", paddingX: 36, paddingY: 6, logoGapX: 16, logoGapY: 6, logoJustify: "right", logoAlign: "bottom", backgroundColor: "#172554", textColor: "#ffffff", borderTop: true, borderColor: "#f59e0b", borderWidth: 3 } });
    expect(snapshot.slideMaster?.footer?.logos.map((logo) => logo.src)).toEqual([assets[2].fileUrl, assets[1].fileUrl]);
    expect(snapshot.slideMaster?.footer?.logos[0].alt).toBe("Training partner");
    await act(async () => root.render(<EditorClient key="reloaded" initialData={{ ...snapshot, courseId: "slides" }} authorName="Author" />));
    const footer = container.querySelector<HTMLElement>('[data-slide-footer]')!;
    expect(footer.textContent).toContain("Our training partners");
    expect([...footer.querySelectorAll<HTMLImageElement>("img")].map((image) => image.getAttribute("src"))).toEqual([assets[2].fileUrl, assets[1].fileUrl]);
    expect(footer.style.backgroundColor).toBe("rgb(23, 37, 84)"); expect(footer.style.borderTopWidth).toBe("3px");
    expect(container.querySelector('[aria-label="Slide number"]')).toBeNull();
    expect(footer.style.paddingInline).toBe("36px"); expect(footer.style.paddingBlock).toBe("6px");
    expect(footer.querySelector<HTMLElement>('[aria-label="Footer logos"]')?.style.paddingInline).toBe("");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer horizontal padding"]')?.value).toBe("36");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer vertical padding"]')?.value).toBe("6");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer logo horizontal gap"]')?.value).toBe("16");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer logo vertical gap"]')?.value).toBe("6");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Footer logo justification"]')?.value).toBe("right");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Footer logo vertical alignment"]')?.value).toBe("bottom");
    const row = footer.querySelector<HTMLElement>('[data-slide-footer-logo-row]')!;
    expect(row.style.gap).toBe("16px"); expect(row.style.justifyContent).toBe("flex-end"); expect(row.style.alignItems).toBe("flex-end");
  });

  it("allows twelve logos and preserves them while switching content modes", async () => {
    const data = { ...initialData, slideMaster: editorSnapshotSchema.parse({ ...initialData, slideMaster: { footerText: "Keep this text", footer: { content: "logos", paddingX: 16, paddingY: 8, logoGapX: 12, logoGapY: 8, logoJustify: "between", logoAlign: "top", logos: Array.from({ length: 12 }, (_, index) => ({ id: `logo-${index}`, src: assets[0].fileUrl, alt: `Logo ${index + 1}` })) } } }).slideMaster };
    await act(async () => root.render(<EditorClient initialData={data} authorName="Author" />));
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === "Add footer logo")?.disabled).toBe(true);
    expect(container.querySelectorAll('[data-slide-footer] img')).toHaveLength(12);
    expect(container.querySelectorAll('[data-slide-footer-logo-row]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Master footer text"]')).toBeNull();
    await changeSelect("Footer content", "text");
    expect(container.querySelectorAll('[data-slide-footer] img')).toHaveLength(0);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer horizontal padding"]')?.value).toBe("16");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Master footer text"]')?.value).toBe("Keep this text");
    await changeSelect("Footer content", "both");
    expect(container.querySelectorAll('[data-slide-footer] img')).toHaveLength(12);
    expect((await saved()).slideMaster?.footer?.logos).toHaveLength(12);
    expect((await saved()).slideMaster?.footer).toMatchObject({ paddingX: 16, paddingY: 8, logoGapX: 12, logoGapY: 8, logoJustify: "between", logoAlign: "top" });
  });

  it("edits the whole footer padding without logos, clamps values, and allows zero", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer horizontal padding"]')?.value).toBe("20");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer vertical padding"]')?.value).toBe("8");
    expect(container.querySelector('[aria-label="Footer logo horizontal padding"]')).toBeNull();
    await input("Footer horizontal padding", "100"); await input("Footer vertical padding", "100");
    expect((await saved()).slideMaster?.footer).toMatchObject({ paddingX: 64, paddingY: 32 });
    const footer = container.querySelector<HTMLElement>('[data-slide-footer]')!;
    expect(footer.style.paddingInline).toBe("64px"); expect(footer.style.paddingBlock).toBe("19px");
    await input("Footer horizontal padding", "");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer horizontal padding"]')?.value).toBe("64");
    await input("Footer horizontal padding", "-2"); await input("Footer vertical padding", "0");
    expect((await saved()).slideMaster?.footer).toMatchObject({ paddingX: 0, paddingY: 0 });
    expect(parseFloat(footer.style.paddingInline)).toBe(0); expect(parseFloat(footer.style.paddingBlock)).toBe(0);
  });

  it("clamps logo gaps, ignores empty input, and supports zero spacing", async () => {
    await act(async () => root.render(<EditorClient initialData={initialData} authorName="Author" />));
    await changeSelect("Footer content", "logos");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer logo horizontal gap"]')?.value).toBe("8");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer logo vertical gap"]')?.value).toBe("4");
    await input("Footer logo horizontal gap", "100"); await input("Footer logo vertical gap", "100");
    expect((await saved()).slideMaster?.footer).toMatchObject({ logoGapX: 32, logoGapY: 12 });
    await input("Footer logo horizontal gap", "");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Footer logo horizontal gap"]')?.value).toBe("32");
    await input("Footer logo horizontal gap", "-1"); await input("Footer logo vertical gap", "0");
    expect((await saved()).slideMaster?.footer).toMatchObject({ logoGapX: 0, logoGapY: 0, logoJustify: "center", logoAlign: "middle" });
  });
});
