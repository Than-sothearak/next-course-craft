/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartBlockPreview, type ChartBlockData } from "@/app/courses/[courseId]/preview/chart-block";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { slideObjectAnimationReplayEvent } from "@/lib/editor/slide-animation";

const data: ChartBlockData = { chartType: "bar", title: "Results", description: "", fields: [{ id: "a", label: "First", value: 25 }, { id: "b", label: "Second", value: 75 }] };
let container: HTMLDivElement;
let root: Root;
let observers: Array<{ notify: (entries: IntersectionObserverEntry[]) => void; disconnect: ReturnType<typeof vi.fn> }>;
let calls: Array<{ element: Element; frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn> }>;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  calls = []; observers = [];
  preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => preference);
  vi.stubGlobal("IntersectionObserver", class {
    disconnect = vi.fn();
    constructor(public notify: (entries: IntersectionObserverEntry[]) => void) { observers.push(this); }
    observe() {}
  });
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: vi.fn(function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const cancel = vi.fn(); calls.push({ element: this, frames, options, cancel }); return { cancel };
  }) });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount()); container.remove();
  Reflect.deleteProperty(Element.prototype, "animate");
  vi.unstubAllGlobals();
});

function render(chart = data, props: Partial<Parameters<typeof ChartBlockPreview>[0]> = {}, active = false) {
  act(() => root.render(<SlidePlaybackContext value={active}><div data-slide-object-animation="slide-up"><ChartBlockPreview data={chart} {...props} /></div></SlidePlaybackContext>));
}
function visible() { act(() => observers.at(-1)!.notify([{ isIntersecting: true } as IntersectionObserverEntry])); }

describe("chart fill animation", () => {
  it("waits for a chart to enter view, staggers fields, and retains its authored values", () => {
    render();
    expect(calls).toHaveLength(0);
    expect(container.querySelector("figure")?.getAttribute("data-chart-reveal")).toBe("pending");
    visible();
    const bars = calls.filter((call) => call.element.getAttribute("data-chart-motion") === "bar");
    expect(bars).toHaveLength(2);
    expect(bars[0].frames).toEqual([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }]);
    expect(bars[1].options).toMatchObject({ duration: 1000, delay: 120, fill: "backwards" });
    expect(container.querySelector<HTMLElement>('[data-chart-motion="bar"]')?.style.width).toBe(`${25 / 75 * 100}%`);
    expect(container.textContent).toContain("25");
    expect(container.textContent).toContain("75");
    const count = calls.length;
    visible(); expect(calls).toHaveLength(count);
    expect(container.querySelector("figure")?.hasAttribute("data-chart-reveal")).toBe(false);
  });

  it.each(["column", "line", "donut", "stacked"] as const)("animates %s geometry without changing the final data", (chartType) => {
    render({ ...data, chartType }); visible();
    const marks = calls.filter((call) => call.element.getAttribute("data-chart-motion") !== "value");
    expect(marks.length).toBeGreaterThan(0);
    if (chartType === "column") expect(marks[0].frames[0]).toEqual({ transform: "scaleY(0)" });
    if (chartType === "line") expect(marks[0].frames).toEqual([{ strokeDasharray: "0 100" }, { strokeDasharray: "100 100" }]);
    if (chartType === "donut") {
      expect(marks[0].frames[1]).toEqual({ strokeDasharray: "25 100" });
      expect(marks[1].options).toMatchObject({ duration: 750, delay: 250, easing: "linear" });
      expect(marks[1].element.getAttribute("stroke-dashoffset")).toBe("-25");
    }
    if (chartType === "stacked") expect(marks[1].frames[1]).toEqual({ transform: "scaleX(1)" });
  });

  it("replays changed values but keeps theme/color and label edits from restarting the fill", () => {
    render(); visible();
    const count = calls.length;
    render({ ...data, color: "#123456", fields: data.fields.map((field) => ({ ...field, label: `${field.label} edited` })) });
    expect(calls).toHaveLength(count); expect(observers).toHaveLength(1);
    render({ ...data, fields: [{ ...data.fields[0], value: 50 }, data.fields[1]] }); visible();
    expect(calls.length).toBeGreaterThan(count);
  });

  it("starts on slide activation and supports Restart/Preview without remounting the chart", () => {
    render(data, { presentation: true });
    expect(observers).toHaveLength(0);
    render(data, { presentation: true }, true); visible();
    const figure = container.querySelector("figure");
    const first = [...calls];
    act(() => container.firstElementChild!.dispatchEvent(new Event(slideObjectAnimationReplayEvent)));
    expect(calls).toHaveLength(first.length * 2);
    expect(first.every((call) => call.cancel.mock.calls.length === 1)).toBe(true);
    expect(container.querySelector("figure")).toBe(figure);
    render(data, { presentation: true }, false);
    expect(calls.every((call) => call.cancel.mock.calls.length > 0)).toBe(true);
  });

  it("keeps authoring and decorative thumbnails still while allowing explicit author previews", () => {
    render(data, { authoring: true, presentation: true });
    expect(observers).toHaveLength(0); expect(calls).toHaveLength(0);
    act(() => container.firstElementChild!.dispatchEvent(new Event(slideObjectAnimationReplayEvent)));
    expect(calls).toHaveLength(4);
    render(data, { authoring: true, decorative: true, presentation: true });
    const count = calls.length;
    act(() => container.firstElementChild!.dispatchEvent(new Event(slideObjectAnimationReplayEvent)));
    expect(calls).toHaveLength(count);
  });

  it("shows final values immediately for reduced motion and cancels when that preference changes", () => {
    preference.matches = true; render();
    expect(calls).toHaveLength(0); expect(observers).toHaveLength(0);
    preference.matches = false;
    render({ ...data, chartType: "column" }); visible();
    preference.matches = true;
    act(() => preference.addEventListener.mock.calls.at(-1)![1]());
    expect(calls.every((call) => call.cancel.mock.calls.length > 0)).toBe(true);
    expect(container.querySelector("figure")?.hasAttribute("data-chart-reveal")).toBe(false);
  });

  it("retains a visible fallback without browser animation support and honors None on slides", () => {
    Reflect.deleteProperty(Element.prototype, "animate"); render();
    expect(container.querySelector("figure")?.hasAttribute("data-chart-reveal")).toBe(false);
    expect(container.textContent).toContain("75");
    render(data, { presentation: true, animation: { effect: "none", duration: 1000, delay: 0 } }, true);
    expect(observers).toHaveLength(0); expect(calls).toHaveLength(0);
  });

  it("keeps zero-valued donut segments finite and bounds stagger for twenty fields", () => {
    render({ ...data, chartType: "donut", fields: data.fields.map((field) => ({ ...field, value: 0 })) }); visible();
    expect(calls.every((call) => Number.isFinite(call.options.delay) && Number.isFinite(call.options.duration))).toBe(true);
    render({ ...data, fields: Array.from({ length: 20 }, (_, index) => ({ id: String(index), label: `Field ${index}`, value: index })) }); visible();
    expect(Math.max(...calls.slice(4).map((call) => Number(call.options.delay)))).toBe(900);
  });
});
