/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewImage } from "../app/courses/[courseId]/preview/preview-image";
import { ProcessStepMedia } from "../app/courses/[courseId]/preview/_components/(interactive_blocks_components)/(interactive_process_steps_components)/process-step-media";

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

  it.each(["/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", "./media/guide.png", "blob:offline-image"])("zooms a step image from %s while preserving its authored frame", (src) => {
    const onCancel = vi.fn(), onClose = vi.fn();
    act(() => root.render(createElement("div", { onCancel, onClose }, createElement(ProcessStepMedia, {
      media: { src, fileName: "Step guide", mimeType: "image/png", size: 128 },
      layout: { width: 320, height: 200, fit: "cover", position: "top" },
    }))));
    const frame = container.querySelector<HTMLElement>("[data-process-media-frame]")!;
    expect(frame.style.aspectRatio).toBe("320 / 200");
    expect(frame.querySelector("button img")?.getAttribute("style")).toContain("object-fit: cover");
    const trigger = frame.querySelector<HTMLButtonElement>('button[aria-label="View image full screen: Step guide"]')!;
    act(() => trigger.click());
    const dialog = frame.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe(src);
    expect(dialog.querySelector("img")?.className).toContain("object-contain");
    act(() => dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(onCancel).not.toHaveBeenCalled();
    act(() => dialog.querySelector<HTMLButtonElement>('[aria-label="Close image preview"]')!.click());
    expect(dialog.open).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps step image thumbnails noninteractive", () => {
    act(() => root.render(createElement(ProcessStepMedia, { media: { src: "./media/guide.png", fileName: "Step guide", mimeType: "image/png", size: 128 }, decorative: true })));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("./media/guide.png");
    expect(container.querySelector("button, dialog")).toBeNull();
  });
});
