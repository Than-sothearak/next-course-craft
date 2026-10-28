// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SlideNavigation } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const slides = [
  { id: "first", title: "Introduction", blocks: [] },
  { id: "second", title: "Practice", blocks: [] },
];

describe("slide controls", () => {
  it("moves by Next and thumbnails, disables the first Previous button, and adds a slide", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const select = vi.fn();
    const add = vi.fn();
    act(() => root.render(<SlideNavigation slides={slides} activeId="first" onSelect={select} onAdd={add} />));
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.find((button) => button.textContent?.includes("Previous"))?.disabled).toBe(true);
    act(() => buttons.find((button) => button.textContent?.includes("Next"))!.click());
    expect(select).toHaveBeenLastCalledWith("second");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Go to slide 2: Practice"]')!.click());
    expect(select).toHaveBeenLastCalledWith("second");
    act(() => buttons.find((button) => button.textContent?.includes("Add slide"))!.click());
    expect(add).toHaveBeenCalledOnce();
    act(() => root.unmount());
    container.remove();
  });

  it("keeps locked slides unavailable until their progress condition clears", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const select = vi.fn();
    act(() => root.render(<SlideNavigation slides={slides} activeId="first" onSelect={select} getLockMessage={(id) => id === "second" ? "Finish this slide" : null} />));
    const next = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Next"))!;
    expect(next.disabled).toBe(true);
    expect(next.title).toBe("Finish this slide");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to slide 2: Practice"]')?.disabled).toBe(true);
    act(() => root.unmount());
    container.remove();
  });
});
