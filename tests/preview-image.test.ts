/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PreviewImage } from "../app/courses/[courseId]/preview/preview-image";

describe("lesson preview image", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalShowModal: PropertyDescriptor | undefined;
  let originalClose: PropertyDescriptor | undefined;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    originalShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    );
    originalClose = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "close",
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    if (originalShowModal) {
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "showModal",
        originalShowModal,
      );
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    }
    if (originalClose) {
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "close",
        originalClose,
      );
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });

  it("opens an image in a full-screen dialog and closes it from the control", () => {
    act(() => {
      root.render(
        createElement(PreviewImage, {
          src: "/lesson-image.png",
          alt: "Course diagram",
          className: "w-full",
        }),
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View image full screen: Course diagram"]',
    );
    const dialog = container.querySelector<HTMLDialogElement>("dialog");
    expect(trigger).not.toBeNull();
    expect(dialog?.open).toBe(false);

    act(() => trigger?.click());
    expect(dialog?.open).toBe(true);

    const close = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close image preview"]',
    );
    act(() => close?.click());
    expect(dialog?.open).toBe(false);
  });
});
