/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideAnimatedObjectFrame } from "@/app/courses/[courseId]/_components/slide-presentation/slide-animated-object-frame";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { replaySlideObjectAnimations, slideAnimationItems, type SlideAnimation } from "@/lib/editor/slide-animation";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { blockSchema } from "@/lib/schemas/block";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("shared presentation object entrance animation", () => {
  let root: Root; let container: HTMLDivElement;
  let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => preference);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView; vi.unstubAllGlobals(); vi.useRealTimers(); });
  const render = (active: boolean, animation?: SlideAnimation, authoring = false, children: ReactNode = <button>Keep this interaction</button>) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><SlideAnimatedObjectFrame animation={animation} authoring={authoring} data-slide-object-id="object" style={{ left: "10%", top: "20%", width: "50%", height: "30%", zIndex: 7 }}>{children}</SlideAnimatedObjectFrame></SlidePlaybackContext.Provider>));
  function track() {
    const node = container.firstElementChild as HTMLDivElement;
    const cancel = vi.fn(), animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(node, "animate", { configurable: true, value: animate });
    return { node, animate, cancel };
  }
  function trackItems(items: Element[]) {
    return items.map((item) => {
      const cancel = vi.fn(), animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel }));
      Object.defineProperty(item, "animate", { configurable: true, value: animate });
      return { item, animate, cancel };
    });
  }

  it.each([
    ["fade", undefined], ["zoom", "scale(0.96)"], ["slide-up", "translateY(24px)"],
    ["slide-down", "translateY(-24px)"], ["slide-left", "translateX(24px)"], ["slide-right", "translateX(-24px)"],
  ] as const)("plays %s on entry without changing saved geometry or remounting interactions", async (effect, transform) => {
    const animation = { effect, duration: 600, delay: 140 };
    await render(false, animation); const { node, animate } = track(); const button = node.querySelector("button");
    await render(true, animation);
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]).toEqual([transform ? [{ opacity: 0, transform }, { opacity: 1, transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 140, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]);
    expect(node.style.cssText).toBe("left: 10%; top: 20%; width: 50%; height: 30%; z-index: 7;");
    expect(node.querySelector("button")).toBe(button);
    await render(true, { ...animation }); expect(animate).toHaveBeenCalledOnce();
  });

  it("uses Slide up at 1000 ms for older objects, cancels on exit, and replays on re-entry or Restart", async () => {
    await render(false); const { node, animate, cancel } = track();
    expect(node.dataset.slideObjectAnimation).toBe("slide-up");
    await render(true); expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]).toEqual([[{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]);
    await render(false); expect(cancel).toHaveBeenCalledOnce();
    await render(true); expect(animate).toHaveBeenCalledTimes(2);
    act(() => replaySlideObjectAnimations(container)); expect(animate).toHaveBeenCalledTimes(3);
  });

  it.each(["ul", "ol"] as const)("staggers %s items in order, groups nested lists, and cancels the whole sequence on interaction", async (List) => {
    const children = <List><li>One<button>Read first</button></li><li>Two<ul><li>Nested detail</li></ul></li><li>Three</li><li hidden>Hidden detail</li></List>;
    const settings = { effect: "slide-up" as const, duration: 1000, delay: 80 };
    await render(false, settings, false, children); const { node, animate } = track();
    const items = trackItems(slideAnimationItems(node));
    expect(items.map(({ item }) => item.textContent)).toEqual(["OneRead first", "TwoNested detail", "Three"]);
    await render(true, settings, false, children);
    expect(animate).not.toHaveBeenCalled();
    items.forEach(({ animate }, index) => expect(animate.mock.calls[0]).toEqual([[{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: 80 + index * 120, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]));
    act(() => node.querySelector("button")!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    items.forEach(({ cancel }) => expect(cancel).toHaveBeenCalledOnce());
    act(() => replaySlideObjectAnimations(container)); items.forEach(({ animate }) => expect(animate).toHaveBeenCalledTimes(2));
    preference.matches = true; act(() => preference.addEventListener.mock.lastCall![1]());
    items.forEach(({ cancel }) => expect(cancel).toHaveBeenCalledTimes(2));
  });

  it.each(["richText", "gallery", "flipCard", "accordion", "knowledgeCheck", "survey", "processSteps", "chart"] as const)("staggers real %s block items with the authored timing", async (type) => {
    const template = blockTemplates.find((item) => item.type === type)!;
    let block = blockSchema.parse(createBlocksFromTemplate(template, "collection")[0]);
    if (block.type === "richText") block = { ...block, data: { html: "<ul><li><p>First item</p></li><li><p>Second item</p></li><li><p>Third item</p></li></ul>" } };
    if (block.type === "flipCard" && block.data.cards.length === 1) block = { ...block, data: { ...block.data, cards: [block.data.cards[0], { ...block.data.cards[0], id: "another-card" }] } };
    if (block.type === "processSteps") block = { ...block, data: { ...block.data, style: "numbered" } };
    const content = <PreviewBlock block={block} slideLayout device="desktop" orientation="landscape" authoring />;
    const settings = { effect: "zoom" as const, duration: 640, delay: 80 };
    await render(false, settings, false, content); const { node, animate } = track();
    const items = trackItems(slideAnimationItems(node)); expect(items.length).toBeGreaterThan(1);
    await render(true, settings, false, content);
    expect(animate).not.toHaveBeenCalled();
    items.forEach(({ animate }, index) => { expect(animate).toHaveBeenCalledOnce(); expect(animate.mock.calls[0][1]).toMatchObject({ duration: 640, delay: 80 + index * 120 }); });
  });

  it("staggers late-mounted rich-text items once and keeps later feedback from replaying the entrance", async () => {
    await render(false); const { node, animate, cancel } = track(); await render(true);
    const list = document.createElement("ul"); list.innerHTML = "<li>One</li><li>Two</li><li>Three</li>";
    const items = trackItems([...list.children]);
    await act(async () => node.append(list));
    expect(animate).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce();
    items.forEach(({ animate }, index) => { expect(animate).toHaveBeenCalledOnce(); expect(animate.mock.calls[0][1]).toMatchObject({ duration: 1000, delay: index * 120 }); });
    await act(async () => node.append(document.createElement("p")));
    items.forEach(({ animate }) => expect(animate).toHaveBeenCalledOnce());
  });

  it("bounds the extra delay for long collections and keeps nested object sequences independent", async () => {
    const content = <><ol>{Array.from({ length: 30 }, (_, index) => <li key={index}>Item {index}</li>)}</ol><div data-slide-object-animation="slide-up"><ul><li>Nested object item</li><li>Another nested item</li></ul></div></>;
    await render(false, undefined, false, content); const { node } = track();
    const items = trackItems(slideAnimationItems(node)); expect(items).toHaveLength(30);
    await render(true, undefined, false, content);
    const delays = items.map(({ animate }) => Number(animate.mock.calls[0][1].delay));
    expect(delays[0]).toBe(0); expect(delays.at(-1)).toBeLessThanOrEqual(900);
    expect(delays.every((delay, index) => index === 0 || delay > delays[index - 1])).toBe(true);
    items.forEach(({ animate }) => expect(animate.mock.calls[0][1].duration).toBe(1000));
  });

  it("keeps authoring still until Preview and cancels motion before pointer or keyboard interaction", async () => {
    await render(true, undefined, true); const { node, animate, cancel } = track();
    await render(true, undefined, true); expect(animate).not.toHaveBeenCalled();
    act(() => replaySlideObjectAnimations(container, "other")); expect(animate).not.toHaveBeenCalled();
    act(() => replaySlideObjectAnimations(container, "object")); expect(animate).toHaveBeenCalledOnce();
    act(() => node.dispatchEvent(new Event("pointerdown", { bubbles: true }))); expect(cancel).toHaveBeenCalledOnce();
    act(() => replaySlideObjectAnimations(container, "object"));
    act(() => node.querySelector("button")!.focus()); expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("disables automatic and preview motion for reduced motion, and cancels immediately if preferences change", async () => {
    preference.matches = true;
    await render(false); const { animate, cancel } = track();
    await render(true); act(() => replaySlideObjectAnimations(container)); expect(animate).not.toHaveBeenCalled();
    preference.matches = false;
    act(() => preference.addEventListener.mock.lastCall![1]()); expect(animate).toHaveBeenCalledOnce();
    preference.matches = true;
    act(() => preference.addEventListener.mock.lastCall![1]()); expect(cancel).toHaveBeenCalledOnce();
  });

  it("supports None and leaves content visible when the browser has no animation API", async () => {
    await render(false, { effect: "none", duration: 480, delay: 0 }); const { node, animate } = track();
    await render(true, { effect: "none", duration: 480, delay: 0 }); act(() => replaySlideObjectAnimations(container));
    expect(animate).not.toHaveBeenCalled();
    delete (node as unknown as Record<string, unknown>).animate;
    await render(false); await render(true);
    expect(node.textContent).toBe("Keep this interaction"); expect(node.style.opacity).toBe("");
  });

  it.each([false, true])("plays only the active slide and wires footer Restart to animation replay (standalone=%s)", async (standalone) => {
    const data = { courseId: "animations", ...editorSnapshotSchema.parse({ title: "Animations", description: "", revision: 0, courseLayout: "slides", navigationMode: "free", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
      { id: "first", sectionId: "section", title: "First", order: 0, blocks: [{ id: "first-object", version: 1, type: "heading", data: { text: "First object", level: 2 } }] },
      { id: "second", sectionId: "section", title: "Second", order: 1, blocks: [{ id: "second-object", version: 1, type: "heading", slideAnimation: { effect: "slide-down", duration: 600, delay: 80 }, data: { text: "Second object", level: 2 } }] },
    ] }) };
    await act(async () => root.render(<CoursePreview initialData={data} authorName="Author" initialLessonId="first" standalone={standalone} persistLocalProgress={false} />));
    await act(async () => vi.advanceTimersByTimeAsync(50));
    const first = container.querySelector<HTMLElement>('[data-slide-object-id="first-object"]')!;
    const second = container.querySelector<HTMLElement>('[data-slide-object-id="second-object"]')!;
    const firstAnimate = vi.fn(() => ({ cancel: vi.fn() })), secondCancel = vi.fn(), secondAnimate = vi.fn(() => ({ cancel: secondCancel }));
    Object.defineProperty(first, "animate", { configurable: true, value: firstAnimate }); Object.defineProperty(second, "animate", { configurable: true, value: secondAnimate });
    const action = (label: string) => act(async () => { container.querySelector<HTMLButtonElement>(`[data-slide-active="true"] button[aria-label="${label}"]`)!.click(); await vi.advanceTimersByTimeAsync(50); });
    await action("Next");
    expect(secondAnimate).toHaveBeenCalledOnce(); expect(firstAnimate).not.toHaveBeenCalled();
    expect(secondAnimate.mock.calls[0]).toEqual([[{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 80, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }]);
    await action("Previous"); expect(firstAnimate).toHaveBeenCalledOnce(); expect(secondCancel).toHaveBeenCalledOnce();
    await action("Restart slide"); expect(firstAnimate).toHaveBeenCalledTimes(2); expect(secondAnimate).toHaveBeenCalledOnce();
    expect(first.dataset.slideObjectAnimation).toBe("slide-up");
  });
});
