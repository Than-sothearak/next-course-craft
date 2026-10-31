/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideInsertToolbar } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-insert-toolbar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe("presentation insert toolbar", () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  it("groups icon commands and inserts the selected object type", async () => {
    const insert = vi.fn(); await act(async () => root.render(<SlideInsertToolbar onInsert={insert} onCover={() => {}} onMore={() => {}} />));
    for (const group of ["text", "media", "interactive", "data"]) expect(container.querySelector(`[aria-label="Insert ${group}"]`)).not.toBeNull();
    for (const element of container.querySelectorAll("button")) { expect(element.querySelector('svg[aria-hidden="true"]')).not.toBeNull(); expect(element.getAttribute("title")).toBeTruthy(); expect(element.querySelector("span")?.classList.contains("sr-only")).toBe(true); }
    expect(container.querySelector("p")).toBeNull();
    for (const [label, id] of [["Heading", "text-subheading"], ["Image", "image-single"], ["Audio instruction", "media-audio-instruction"], ["Interaction button", "interactive-button"], ["Chart", "chart-bars"]]) {
      await act(async () => button(label).click()); expect(insert).toHaveBeenLastCalledWith(id);
    }
    expect(button("Heading").querySelector("svg")?.classList.contains("lucide-heading2")).toBe(true);
    expect(button("Image").querySelector("svg")?.classList.contains("lucide-image")).toBe(true);
  });
  it("keeps cover creation and the block library available through their commands", async () => {
    const cover = vi.fn(), more = vi.fn(); await act(async () => root.render(<SlideInsertToolbar showCover onInsert={() => {}} onCover={cover} onMore={more} />));
    await act(async () => button("Image cover slide").click()); await act(async () => button("More blocks").click());
    expect(cover).toHaveBeenCalledOnce(); expect(more).toHaveBeenCalledOnce();
  });
  it("offers only audio instructions on cover slides", async () => {
    const insert = vi.fn(); await act(async () => root.render(<SlideInsertToolbar cover onInsert={insert} onCover={() => {}} onMore={() => {}} />));
    expect(container.querySelectorAll("button")).toHaveLength(1);
    await act(async () => button("Audio instruction").click()); expect(insert).toHaveBeenCalledWith("media-audio-instruction");
  });
});
