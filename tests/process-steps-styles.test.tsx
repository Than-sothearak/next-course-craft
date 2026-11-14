/** @vitest-environment jsdom */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockSchema, processStepsStyleSchema, type ContentBlock } from "../lib/schemas/block";
import { processStepsPresets, processStepsSample, applyProcessStepsPreset } from "../lib/editor/process-steps";
import { InteractiveProcessSteps } from "../app/courses/[courseId]/preview/interactive-blocks";
import { ContentBlockEditor } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { blockTemplates } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { TemplatePreview } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/template-preview";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";
import { blockWidthClass } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("process-step styles", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(processStepsStyleSchema.options)("navigates %s steps and reports the exact interacted step", (style) => {
    const onStepInteract = vi.fn();
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "process", steps: processStepsSample, style, accentColor: "#0f766e", onStepInteract })));
    expect(container.querySelector("section")?.dataset.processStyle).toBe(style);
    expect(container.querySelector("article")?.textContent).toContain(processStepsSample[0].body);
    const next = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Next step")!;
    act(() => next.click());
    if (style === "slider") expect(container.querySelector("[data-process-slide-direction]")?.getAttribute("data-process-slide-direction")).toBe("next");
    expect(container.querySelector("article")?.textContent).toContain(processStepsSample[1].body);
    expect(onStepInteract).toHaveBeenLastCalledWith("step-2");
    expect(Number(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"))).toBeCloseTo(style === "slider" ? 200 / processStepsSample.length : 2);
    expect(container.querySelector("section")?.style.getPropertyValue("--process-accent")).toBe("#0f766e");
  });

  it.each(["numbered", "timeline"] as const)("allows direct navigation in %s without marking skipped steps", (style) => {
    const onStepInteract = vi.fn();
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "process", steps: processStepsSample, style, onStepInteract })));
    const jump = container.querySelector<HTMLButtonElement>('[aria-label="View step 3: Review"]')!;
    act(() => jump.click());
    expect(jump.getAttribute("aria-current")).toBe("step");
    expect(container.querySelector("article")?.textContent).toContain(processStepsSample[2].body);
    expect(onStepInteract).toHaveBeenCalledExactlyOnceWith("step-3");
  });

  it.each(processStepsStyleSchema.options)("uses container sizing and wrapping controls for mobile %s steps", (style) => {
    const steps = [{ id: "first", title: "LongStepTitle".repeat(30), body: "LongInstructions".repeat(100) }, ...processStepsSample];
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "responsive", steps, style })));
    const section = container.querySelector("section")!;
    expect(section.className).toContain("@container/process-steps");
    expect(section.querySelector("article")?.className).toContain("[overflow-wrap:anywhere]");
    expect(section.querySelector("article")?.textContent).toContain(steps[0].body);
    expect(section.querySelector('[role="progressbar"]')?.className).toContain("min-w-0");
    const controls = section.lastElementChild!;
    if (style === "slider") {
      expect(controls.hasAttribute("data-process-slider")).toBe(true);
    } else {
      expect(controls.className).toContain("grid-cols-1");
      expect(controls.className).toContain("@min-[20rem]/process-steps:grid-cols-2");
    }
    for (const button of controls.querySelectorAll("button")) {
      expect(button.className).toContain("whitespace-normal");
      expect(button.className).toContain("min-h-11");
    }
    expect(section.querySelector('[aria-label="Process step navigation"]')?.className ?? "").not.toContain("sm:");
    if (style === "timeline" || style === "numbered") {
      const firstStep = section.querySelector<HTMLButtonElement>('button[aria-current="step"]')!;
      expect(firstStep.getAttribute("aria-label")).toContain(steps[0].title);
      expect(firstStep.lastElementChild?.className).toContain("line-clamp-2");
    }
    if (style === "timeline") {
      expect(section.children[1].className).toContain("@min-[36rem]/process-steps:grid-cols-");
      expect(section.querySelector("ol")?.className).toContain("@min-[36rem]/process-steps:flex-col");
    }
    const next = Array.from(controls.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Next step")!;
    act(() => next.click());
    expect(section.querySelector("article")?.textContent).toContain(processStepsSample[0].body);
  });

  it("keeps older blocks on Classic cards and permits hiding numbered badges", () => {
    const legacy = renderToStaticMarkup(createElement(InteractiveProcessSteps, { blockId: "old", steps: processStepsSample }));
    expect(legacy).toContain('data-process-style="cards"');
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "process", steps: processStepsSample, style: "numbered", showNumbers: false, accentColor: "#ffffff" })));
    expect(container.querySelector("article span")).toBeNull();
    expect(container.querySelector("section")?.style.getPropertyValue("--process-accent-text")).toBe("#111827");
    expect(container.querySelector("article")?.textContent).toContain("Prepare");
  });

  it("navigates the slider card with side arrows and keyboard without wrapping at either end", () => {
    const onStepInteract = vi.fn();
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "slider", steps: processStepsSample, style: "slider", onStepInteract })));
    expect(container.querySelector('button[title="Previous step"]')).toBeNull();
    const next = container.querySelector<HTMLButtonElement>('button[title="Next step"]')!;
    expect(next.disabled).toBe(false);
    const section = container.querySelector("section")!;
    act(() => section.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(container.querySelector('[aria-roledescription="carousel"]')).not.toBeNull();
    expect(container.textContent).toContain("Step 1 of 3");
    const progress = container.querySelector<HTMLElement>('[role="progressbar"]')!;
    expect(progress.className).not.toContain("sr-only");
    expect(Number.parseFloat((progress.firstElementChild as HTMLElement).style.width)).toBeCloseTo(100 / 3);
    act(() => next.click());
    expect(container.querySelector("article")?.textContent).toContain(processStepsSample[1].body);
    expect(container.querySelector('button[title="Previous step"]')).not.toBeNull();
    act(() => next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(container.textContent).toContain("Step 3 of 3");
    expect(progress.getAttribute("aria-valuenow")).toBe("100");
    expect((progress.firstElementChild as HTMLElement).style.width).toBe("100%");
    expect(container.querySelector('button[title="Next step"]')).toBeNull();
    act(() => section.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(container.textContent).toContain("Step 3 of 3");
    const previous = container.querySelector<HTMLButtonElement>('button[title="Previous step"]')!;
    act(() => previous.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(container.querySelector("[data-process-slide-direction]")?.getAttribute("data-process-slide-direction")).toBe("previous");
    expect(container.textContent).toContain("Step 2 of 3");
    expect(progress.getAttribute("aria-valuetext")).toBe("Step 2 of 3");
    expect(Number.parseFloat((progress.firstElementChild as HTMLElement).style.width)).toBeCloseTo(200 / 3);
    expect(onStepInteract).toHaveBeenLastCalledWith("step-2");
    expect(container.querySelector('button[title="Next step"]')).not.toBeNull();
    act(() => previous.click());
    expect(container.querySelector('button[title="Previous step"]')).toBeNull();
    expect(container.textContent).toContain("Step 1 of 3");
  });

  it("hides both slider arrows for a single step, including custom editor controls", () => {
    const renderControl = vi.fn(() => createElement("button", {}, "Custom arrow"));
    act(() => root.render(createElement(InteractiveProcessSteps, {
      blockId: "single", steps: processStepsSample.slice(0, 1), style: "slider", renderControl,
    })));
    expect(container.querySelector("button")).toBeNull();
    expect(renderControl).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Step 1 of 1");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("100");
  });

  it("defaults the slider to L width while honoring custom widths and other process styles", () => {
    const template = blockTemplates.find((item) => item.id === "interactive-process-steps-slider")!;
    const slider = blockSchema.parse(createBlocksFromTemplate(template, "wide-slider")[0]);
    expect(slider).toMatchObject({ width: "full", widthCustom: false });
    expect(blockWidthClass(slider)).toBe("max-w-[920px]");
    expect(blockWidthClass({ ...slider, width: "medium" })).toBe("max-w-[920px]");
    expect(blockWidthClass({ ...slider, width: "medium", widthCustom: true })).toBe("max-w-[720px]");
    expect(blockWidthClass({ ...slider, width: "small", widthCustom: true })).toBe("max-w-[520px]");
    const classic = blockSchema.parse({ id: "classic", version: 1, type: "processSteps", data: { steps: processStepsSample } });
    expect(blockWidthClass(classic)).toBe("max-w-[720px]");
    act(() => root.render(createElement(InteractiveProcessSteps, { blockId: "wide-slider", steps: processStepsSample, style: "slider" })));
    expect(container.querySelector("section")?.className).not.toContain("max-w-");
  });

  it("places slider media before editable title and body renderers", () => {
    act(() => root.render(createElement(InteractiveProcessSteps, {
      blockId: "slider-content", steps: processStepsSample, style: "slider",
      renderMedia: () => createElement("div", { "data-test-media": true }, "Image picker"),
      renderTitle: (step) => createElement("h3", { contentEditable: true, suppressContentEditableWarning: true }, step.title),
      renderBody: (step) => createElement("p", { contentEditable: true, suppressContentEditableWarning: true }, step.body),
    })));
    const card = container.querySelector("article")!;
    expect(card.firstElementChild?.querySelector("[data-test-media]")).not.toBeNull();
    const title = card.querySelector("h3")!;
    act(() => title.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(card.textContent).toContain(processStepsSample[0].body);
    expect(container.textContent).toContain("Step 1 of 3");
  });

  it("provides templates for every process style with previews and preserves SCORM settings", () => {
    const templates = blockTemplates.filter((template) => template.type === "processSteps");
    expect(new Set(templates.map((template) => template.processSteps?.style ?? "cards"))).toEqual(new Set(processStepsStyleSchema.options));
    const blocks = templates.map((template) => {
      const parsed = blockSchema.parse(createBlocksFromTemplate(template, `block-${template.id}`)[0]);
      expect(parsed.type).toBe("processSteps");
      const preview = renderToStaticMarkup(createElement(TemplatePreview, { template }));
      expect(preview).toContain(`data-process-template-style="${template.processSteps?.style ?? "cards"}"`);
      return parsed;
    });
    const snapshot = parseScorm12Snapshot({
      title: "Processes", description: "", revision: 0, sections: [{ id: "section", title: "Learn", order: 0 }],
      lessons: [{ id: "lesson", sectionId: "section", title: "Process styles", order: 0, blocks }],
    });
    expect(snapshot.lessons[0].blocks).toEqual(blocks);
    expect(processStepsPresets.map((preset) => preset.style)).toEqual(processStepsStyleSchema.options);
  });

  it("rejects unsupported process styles and invalid colors", () => {
    const base = { id: "process", version: 1, type: "processSteps", data: { steps: processStepsSample } };
    expect(blockSchema.safeParse({ ...base, data: { ...base.data, style: "unknown" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, data: { ...base.data, accentColor: "red" } }).success).toBe(false);
  });

  it("changes a prebuilt style without replacing authored step IDs or text", () => {
    const original = { style: "cards" as const, steps: [{ id: "custom-1", title: "My first step", body: "Original instructions." }, { id: "custom-2", title: "Finish", body: "Original finishing instructions." }] };
    const preset = blockTemplates.find((template) => template.id === "interactive-process-steps-timeline")!.processSteps!;
    expect(applyProcessStepsPreset(original, preset)).toMatchObject({ style: "timeline", accentColor: undefined, steps: original.steps });
    expect(applyProcessStepsPreset({ ...original, accentColor: "#123456" }, { steps: processStepsSample })).toMatchObject({ style: "cards", accentColor: undefined, steps: original.steps });
  });

  it("edits style, color, numbering, and steps while retaining all settings", () => {
    const onChange = vi.fn();
    function Editor() {
      const [block, setBlock] = useState<ContentBlock>(() => blockSchema.parse({ id: "process", version: 1, type: "processSteps", data: { steps: processStepsSample } }));
      return createElement(ContentBlockEditor, { block, courseId: "course", onChange: (next) => { onChange(next); setBlock(next); } });
    }
    act(() => root.render(createElement(Editor)));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    const select = (label: string, value: string) => act(() => {
      const control = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
      control.value = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    select("Process step style", "timeline");
    select("Process step numbering", "hide");
    const input = (label: string, value: string) => act(() => {
      const control = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(control, value);
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => document.querySelector<HTMLInputElement>('[aria-label="Use custom process step color"]')!.click());
    input("Process step accent color", "#7c3aed");
    input("Process step 1 title", "My edited step");
    act(() => Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Add step"))!.click());
    expect(onChange.mock.lastCall?.[0].data).toMatchObject({ style: "timeline", accentColor: "#7c3aed", showNumbers: false, steps: [{ title: "My edited step" }, {}, {}, {}] });
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Delete process step 4"]')!.click());
    expect(onChange.mock.lastCall?.[0].data.steps).toHaveLength(3);
    expect(onChange.mock.lastCall?.[0].data.style).toBe("timeline");
    act(() => Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Use course color")!.click());
    expect(onChange.mock.lastCall?.[0].data.accentColor).toBeUndefined();
    expect(onChange.mock.lastCall?.[0].data.showNumbers).toBe(false);
  });
});
