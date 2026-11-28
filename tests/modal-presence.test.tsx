/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui/dialog";
import { ModalOverlay, ModalPanel, ModalPresence } from "@/components/ui/modal-presence";

describe("general popup motion", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const advance = (ms = 150) => act(() => vi.advanceTimersByTime(ms));

  it.each(["Close dialog", "Cancel", "Successful action", "Escape", "Backdrop"])("retains a conditional native dialog after %s until the exit completes", (action) => {
    const closed = vi.fn();
    function Feature() {
      const [open, setOpen] = useState(true);
      const close = () => { closed(); setOpen(false); };
      return <ModalPresence>{open && <Dialog open title="Confirm" onClose={close}>
        <input defaultValue="Keep visible during exit" />
        <button onClick={close}>Cancel</button><button onClick={close}>Successful action</button>
      </Dialog>}</ModalPresence>;
    }
    act(() => root.render(<Feature />));
    const dialog = container.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.state).toBe("open");
    act(() => {
      if (action === "Escape") dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));
      else if (action === "Backdrop") dialog.click();
      else [...dialog.querySelectorAll("button")].find((button) => button.textContent === action || button.getAttribute("aria-label") === action)!.click();
    });
    expect(closed).toHaveBeenCalledOnce();
    expect(dialog.dataset.state).toBe("closed");
    expect(dialog.open).toBe(true);
    expect(dialog.hasAttribute("inert")).toBe(true);
    expect(dialog.querySelector("input")?.value).toBe("Keep visible during exit");
    advance(149);
    expect(dialog.isConnected).toBe(true);
    advance(1);
    expect(dialog.open).toBe(false);
    expect(dialog.isConnected).toBe(false);
  });

  it("handles externally controlled closure and rapid reopening without a stale removal", () => {
    const render = (open: boolean) => act(() => root.render(<Dialog open={open} title="Settings" onClose={() => {}}>Content</Dialog>));
    render(true);
    const dialog = container.querySelector<HTMLDialogElement>("dialog")!;
    render(false); advance(100); render(true); advance(100);
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.state).toBe("open");
    render(false); advance();
    expect(dialog.open).toBe(false);
  });

  it("preserves the contents and portal host of custom overlays through their fade", () => {
    const render = (open: boolean) => act(() => root.render(<ModalPresence>{open && createPortal(
      <ModalOverlay className="fixed inset-0"><ModalPanel aria-label="Media library">Selected image</ModalPanel></ModalOverlay>, document.body,
    )}</ModalPresence>));
    render(true);
    const overlay = document.querySelector<HTMLElement>("[data-modal-overlay]")!;
    render(false);
    expect(overlay.dataset.state).toBe("closed");
    expect(overlay.textContent).toBe("Selected image");
    expect(overlay.hasAttribute("inert")).toBe(true);
    advance();
    expect(overlay.isConnected).toBe(false);
  });

  it("closes only the nested dialog and leaves its parent open", () => {
    function Feature() {
      const [nested, setNested] = useState(true);
      return <Dialog open title="Parent" onClose={() => {}}>
        <ModalPresence>{nested && <Dialog open title="Nested" onClose={() => setNested(false)}>Nested content</Dialog>}</ModalPresence>
      </Dialog>;
    }
    act(() => root.render(<Feature />));
    const [parent, nested] = container.querySelectorAll<HTMLDialogElement>("dialog");
    act(() => nested!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(parent!.dataset.state).toBe("open");
    expect(nested!.dataset.state).toBe("closed");
    advance();
    expect(nested!.isConnected).toBe(false);
    expect(parent!.open).toBe(true);
  });

  it("honors busy dismissal protection and reduced motion", () => {
    const close = vi.fn();
    act(() => root.render(<Dialog open busy title="Saving" onClose={close}>Content</Dialog>));
    const dialog = container.querySelector<HTMLDialogElement>("dialog")!;
    act(() => { dialog.click(); dialog.dispatchEvent(new Event("cancel", { cancelable: true })); });
    expect(close).not.toHaveBeenCalled();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    act(() => root.render(<Dialog open={false} title="Saved" onClose={close}>Content</Dialog>));
    expect(dialog.open).toBe(false);
  });
});
