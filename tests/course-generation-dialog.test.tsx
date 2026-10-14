/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CourseGenerationDialog } from "../app/courses/[courseId]/edit/_components/course-generation-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("course generation structure previews", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(CourseGenerationDialog, {
        open: true,
        onClose: () => undefined,
        courseId: "course-1",
        courseTitle: "Learning the Basics",
        courseDescription: "A sample course description.",
        existingLessonCount: 0,
        onApply: () => undefined,
      }));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function hoverStructure(labelText: string) {
    const label = Array.from(container.querySelectorAll("label")).find((candidate) =>
      candidate.textContent?.includes(labelText),
    );
    if (!label) throw new Error(`Could not find structure option: ${labelText}`);
    act(() => {
      label.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
  }

  it("shows the learner course preview for Pre / Learn / Post activities on hover", () => {
    hoverStructure("Pre / Learn / Post activities");

    expect(container.querySelector('[aria-label="Pre / Learn / Post learner preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Pre activities");
    expect(container.textContent).toContain("Learning lesson 2");
    expect(container.textContent).toContain("Post-test");
    expect(container.textContent).toContain("Course description");
  });

  it("shows an example learner preview for the custom structure on hover", () => {
    hoverStructure("Custom course structure");

    expect(container.querySelector('[aria-label="Custom structure learner preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Getting started");
    expect(container.textContent).toContain("Knowledge check");
    expect(container.textContent).toContain("Welcome");
  });
});
