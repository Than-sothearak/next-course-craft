/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublishMenu } from "@/components/publish-menu";

describe("publish format menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("offers HTML, SCORM 1.2, and SCORM 2004 exports", () => {
    act(() => {
      root.render(createElement(PublishMenu, { courseId: "course-1", title: "Sample course" }));
    });

    act(() => container.querySelector<HTMLButtonElement>("button")?.click());

    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect([...menu!.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
      "HTML",
      "SCORM 1.2",
      "SCORM 2004",
    ]);
  });
});
