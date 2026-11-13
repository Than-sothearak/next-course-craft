/** @vitest-environment jsdom */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerationLeaveGuard } from "@/lib/editor/use-generation-leave-guard";

let root: Root, container: HTMLDivElement;
let confirmLeave: ReturnType<typeof useGenerationLeaveGuard>;
const originalNavigation = Object.getOwnPropertyDescriptor(window, "navigation");
function Harness({ active = true }: { active?: boolean }) {
  const guard = useGenerationLeaveGuard(active);
  useEffect(() => { confirmLeave = guard; });
  return null;
}
function unloadIsBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
function linkClick(attributes = "href='/preview'", options: MouseEventInit = {}) {
  container.innerHTML = `<a ${attributes}><span>Leave editor</span></a>`;
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...options });
  // Suppress jsdom's unsupported navigation after recording guard behavior.
  container.addEventListener("click", () => { event.preventDefault(); }, { once: true });
  container.querySelector("span")!.dispatchEvent(event);
  const blocked = vi.mocked(window.confirm).mock.calls.length > 0;
  return { event, blocked };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "confirm").mockReturnValue(false);
  Object.defineProperty(window, "navigation", { configurable: true, value: undefined });
  window.history.replaceState({ editor: true }, "", "/editor");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalNavigation) Object.defineProperty(window, "navigation", originalNavigation);
  else Reflect.deleteProperty(window, "navigation");
});

describe("generation leave confirmation", () => {
  it("blocks programmatic Preview navigation when staying and allows it when leaving", () => {
    act(() => root.render(<Harness />));
    const navigate = vi.fn();
    if (confirmLeave()) navigate();
    expect(navigate).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Already saved lessons are safe"));
    vi.mocked(window.confirm).mockReturnValue(true);
    if (confirmLeave()) navigate();
    expect(navigate).toHaveBeenCalledOnce();
  });
  it("blocks same-tab links before the router receives the click", () => {
    act(() => root.render(<Harness />));
    const bubble = vi.fn();
    container.addEventListener("click", bubble);
    expect(linkClick().event.defaultPrevented).toBe(true);
    expect(bubble).not.toHaveBeenCalled();
    expect(unloadIsBlocked()).toBe(true);
  });
  it.each([
    ["href='/preview' target='_blank'", {}],
    ["href='/preview' download", {}],
    ["href='/editor#lesson'", {}],
    ["href='/preview'", { ctrlKey: true }],
    ["href='/preview'", { metaKey: true }],
    ["href='https://other.example/course'", {}],
  ])("preserves new tabs, downloads, same-page anchors and native full-page protection (%s)", (attributes, options) => {
    act(() => root.render(<Harness />));
    expect(linkClick(attributes, options).blocked).toBe(false);
    expect(unloadIsBlocked()).toBe(true);
  });
  it("avoids duplicate warnings on accepted links and restores refresh protection", () => {
    act(() => root.render(<Harness />));
    vi.mocked(window.confirm).mockReturnValue(true);
    linkClick();
    expect(unloadIsBlocked()).toBe(false);
    act(() => vi.runAllTimers());
    expect(unloadIsBlocked()).toBe(true);
    linkClick();
    act(() => root.render(null));
    act(() => vi.runAllTimers());
    expect(unloadIsBlocked()).toBe(false);
  });
  it("confirms browser Back/Forward before a same-document traversal commits", () => {
    const navigation = new EventTarget();
    Object.defineProperty(window, "navigation", { configurable: true, value: navigation });
    act(() => root.render(<Harness />));
    const traverse = () => {
      const event = Object.assign(new Event("navigate", { cancelable: true }), { navigationType: "traverse", destination: { sameDocument: true, url: `${window.location.origin}/dashboard` } });
      navigation.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(traverse()).toBe(true);
    vi.mocked(window.confirm).mockReturnValue(true);
    expect(traverse()).toBe(false);
    act(() => root.render(<Harness active={false} />));
    vi.mocked(window.confirm).mockClear();
    expect(traverse()).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });
  it("restores the editor and stops the router when declining Back in older browsers", () => {
    act(() => root.render(<Harness />));
    const router = vi.fn();
    window.addEventListener("popstate", router);
    window.history.replaceState({ dashboard: true }, "", "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { dashboard: true } }));
    expect(window.location.pathname).toBe("/editor");
    expect(window.history.state).toEqual({ editor: true });
    expect(router).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    window.history.replaceState({ dashboard: true }, "", "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { dashboard: true } }));
    expect(router).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", router);
  });
  it("does not ask for confirmation when generation is finished", () => {
    act(() => root.render(<Harness active={false} />));
    expect(confirmLeave()).toBe(true);
    expect(linkClick().blocked).toBe(false);
    expect(unloadIsBlocked()).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
