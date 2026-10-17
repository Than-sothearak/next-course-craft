/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SlidePlayerClient } from "../app/courses/[courseId]/slides/preview/slide-player-client";
import { createTemplateSlide } from "../lib/slides/templates";
import { slideSnapshotSchema } from "../lib/slides/schema";
import { slideThemePresets } from "../lib/slides/themes";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe("shared slide learner presentation", () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it("renders the selected course theme and runs template navigation without authoring controls", () => {
    const slides = [{ ...createTemplateSlide("cover", 0), id: "one" }, { ...createTemplateSlide("section", 1), id: "two" }];
    const theme = slideThemePresets.find((preset) => preset.id === "dark")!.theme;
    act(() => root.render(<SlidePlayerClient title="Learning" slides={slides} theme={theme} />));
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slide-template="cover"]')?.style.getPropertyValue("--slide-primary")).toBe(theme.primaryColor);
    const next = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Let’s begin"))!;
    act(() => next.click()); expect(container.querySelector('[data-slide-template="section"]')).not.toBeNull();
    expect(container.textContent).toContain("Slide 2 of 2");
  });
  it("scopes object visibility to the current slide and supports keyboard actions", () => {
    const source = slideSnapshotSchema.parse({ title: "Canvas", order: 0, revision: 0, objects: [
      { id: "button", type: "button", content: "Hide explanation", x: 20, y: 20, width: 200, height: 80, actions: [{ type: "hideObject", targetObjectId: "target" }] },
      { id: "target", type: "text", content: "Important explanation", x: 20, y: 150, width: 400, height: 100 },
    ] });
    const second = { ...structuredClone(source), id: "two", order: 1 };
    act(() => root.render(<SlidePlayerClient title="Canvas course" slides={[{ ...source, id: "one" }, second]} />));
    const control = container.querySelector<HTMLElement>('[role="button"][aria-label="Hide explanation"]')!;
    act(() => control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.textContent).not.toContain("Important explanation");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Next")!.click());
    expect(container.textContent).toContain("Important explanation");
  });
});
