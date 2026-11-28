/** @vitest-environment jsdom */
import { act, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Popover } from "@/components/ui/popover";
import { Dialog } from "@/components/ui/dialog";
import { DashboardUserProfile } from "@/app/dashboard/_components/dashboard-navbar";

vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));

function pointer(type: string, relatedTarget: EventTarget | null = document.body, pointerType = "mouse", buttons = 0) {
  return Object.assign(new MouseEvent(type, { bubbles: true, relatedTarget, buttons }), { pointerType });
}

describe("shared popup behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  function render(props: Partial<ComponentProps<typeof Popover>> = {}) {
    act(() => root.render(<Popover title="Settings" triggerLabel="Open settings" trigger="Open" {...props}>
      <button role="menuitem">First action</button>
      <button role="menuitem" disabled>Unavailable action</button>
      <button role="menuitem">Last action</button>
    </Popover>));
    return container.querySelector<HTMLButtonElement>("button")!;
  }
  const panel = () => document.querySelector<HTMLElement>('[data-ui-popover][data-state="open"]')!;

  it.each(["settings", "menu", "panel"] as const)("retains the %s popup during fade-out and restores focus on Escape", (variant) => {
    const trigger = render({ variant });
    act(() => trigger.click());
    const popup = panel();
    expect(popup.parentElement).toBe(document.body);
    expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(popup.dataset.state).toBe("closed");
    expect(popup.getAttribute("aria-hidden")).toBe("true");
    expect(popup.hasAttribute("inert")).toBe(true);
    act(() => vi.advanceTimersByTime(149));
    expect(popup.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(popup.isConnected).toBe(false);
  });

  it("allows crossing the trigger gap, reentry, and moving within the popup before mouse dismissal", () => {
    const trigger = render();
    act(() => trigger.click());
    const popup = panel();
    act(() => trigger.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(200));
    act(() => popup.dispatchEvent(pointer("pointerover")));
    act(() => vi.advanceTimersByTime(300));
    expect(panel()).toBe(popup);
    act(() => popup.querySelector("button")!.dispatchEvent(pointer("pointerout", popup)));
    act(() => vi.advanceTimersByTime(300));
    expect(panel()).toBe(popup);
    act(() => popup.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(249));
    expect(panel()).toBe(popup);
    act(() => trigger.dispatchEvent(pointer("pointerover")));
    act(() => vi.advanceTimersByTime(300));
    expect(panel()).toBe(popup);
    act(() => popup.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(250));
    expect(popup.dataset.state).toBe("closed");
  });

  it.each(["touch", "pen"])("keeps %s interactions open and still supports outside dismissal", (pointerType) => {
    const trigger = render();
    act(() => trigger.click());
    const popup = panel();
    act(() => popup.dispatchEvent(pointer("pointerout", document.body, pointerType)));
    act(() => vi.advanceTimersByTime(500));
    expect(panel()).toBe(popup);
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(popup.dataset.state).toBe("closed");
  });

  it("keeps active drags and busy popups open, including cancellation of pending mouse dismissal", () => {
    const trigger = render();
    act(() => trigger.click());
    const popup = panel();
    act(() => popup.dispatchEvent(pointer("pointerout", document.body, "mouse", 1)));
    act(() => vi.advanceTimersByTime(500));
    expect(panel()).toBe(popup);
    act(() => popup.dispatchEvent(pointer("pointerout")));
    render({ busy: true });
    act(() => vi.advanceTimersByTime(500));
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(panel()).toBe(popup);
    render({ busy: false });
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(popup.dataset.state).toBe("closed");
  });

  it("cancels an unfinished exit when reopened and removes panels immediately for reduced motion", () => {
    const trigger = render();
    act(() => trigger.click());
    const popup = panel();
    act(() => trigger.click());
    act(() => vi.advanceTimersByTime(100));
    act(() => trigger.click());
    act(() => vi.advanceTimersByTime(100));
    expect(panel()).toBe(popup);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    act(() => trigger.click());
    act(() => vi.advanceTimersByTime(0));
    expect(popup.isConnected).toBe(false);
  });

  it("keeps native color and select controls available while their picker has focus", () => {
    act(() => root.render(<Popover title="Appearance" triggerLabel="Open settings" trigger="Open">
      <input type="color" aria-label="Color" />
      <select aria-label="Style"><option>Default</option></select>
    </Popover>));
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    const popup = panel();
    for (const control of popup.querySelectorAll<HTMLElement>("input, select")) {
      act(() => control.focus());
      act(() => popup.dispatchEvent(pointer("pointerout")));
      act(() => vi.advanceTimersByTime(500));
      expect(panel()).toBe(popup);
    }
    act(() => popup.querySelector("button")!.focus());
    act(() => popup.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(250));
    expect(popup.dataset.state).toBe("closed");
  });

  it("supports action menu arrow keys, Home/End, selection dismissal and disabled actions", () => {
    const trigger = render({ variant: "menu" });
    act(() => trigger.click());
    const popup = panel();
    const items = popup.querySelectorAll("button");
    expect(document.activeElement).toBe(items[0]);
    const key = (value: string) => act(() => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
    key("ArrowDown");
    expect(document.activeElement).toBe(items[2]);
    key("ArrowDown");
    expect(document.activeElement).toBe(items[0]);
    key("End");
    expect(document.activeElement).toBe(items[2]);
    key("Home");
    expect(document.activeElement).toBe(items[0]);
    act(() => items[0].click());
    expect(popup.dataset.state).toBe("closed");
    expect(document.activeElement).toBe(trigger);
  });

  it("preserves focus on an outside control when it dismisses the popup", () => {
    const trigger = render();
    act(() => trigger.click());
    const popup = panel();
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => outside.focus());
    expect(popup.dataset.state).toBe("closed");
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("keeps a parent popup alive while a nested portaled dialog is used", () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    function Settings() {
      const [nested, setNested] = useState(false);
      return <Popover title="Settings" triggerLabel="Open settings" trigger="Open">
        <button onClick={() => setNested(true)}>Choose media</button>
        {nested && createPortal(<Dialog open title="Media library" onClose={() => setNested(false)}><input aria-label="Find media" /></Dialog>, document.body)}
      </Popover>;
    }
    act(() => root.render(<Settings />));
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    const popup = panel();
    act(() => [...popup.querySelectorAll("button")].find((button) => button.textContent === "Choose media")!.click());
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]")!;
    act(() => dialog.querySelector<HTMLInputElement>("input")!.focus());
    act(() => dialog.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    act(() => popup.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(500));
    expect(panel()).toBe(popup);
    act(() => dialog.querySelector("button")!.click());
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(panel()).toBe(popup);
  });

  it("uses the shared lifecycle for the profile menu and preserves permission-based links", () => {
    act(() => root.render(<DashboardUserProfile userName="Test Author" permissions={["users.view"]} />));
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    expect(trigger.getAttribute("aria-label")).toBe("Open profile menu for Test Author");
    act(() => trigger.click());
    const popup = panel();
    expect(popup.querySelector('a[href="/admin"]')?.textContent).toBe("Administration");
    expect(popup.querySelector('a[href="/account-status"]')).not.toBeNull();
    act(() => popup.dispatchEvent(pointer("pointerout")));
    act(() => vi.advanceTimersByTime(250));
    expect(popup.dataset.state).toBe("closed");
    act(() => vi.advanceTimersByTime(150));
    expect(popup.isConnected).toBe(false);
    act(() => root.render(<DashboardUserProfile userName="Viewer" />));
    act(() => trigger.click());
    expect(panel().querySelector('a[href="/admin"]')).toBeNull();
  });
});
