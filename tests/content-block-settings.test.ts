/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentBlockEditor } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import type { ContentBlock } from "../lib/schemas/block";

const blockDefaults = {
  version: 1 as const,
  width: "small" as const,
  widthCustom: false,
  backgroundColor: "#ffffff",
  blockPadding: 20,
};

const blocks: ContentBlock[] = [
  { ...blockDefaults, id: "heading", type: "heading", data: { text: "Heading", level: 2 } },
  { ...blockDefaults, id: "text", type: "richText", data: { html: "<p>Text</p>" } },
  { ...blockDefaults, id: "image", type: "image", data: { src: "https://example.com/image.png", alt: "Example" } },
  { ...blockDefaults, id: "gallery", type: "gallery", data: { images: [{ src: "https://example.com/image.png", alt: "Example" }] } },
  { ...blockDefaults, id: "video", type: "video", data: { src: "https://example.com/video.mp4", captions: "" } },
  { ...blockDefaults, id: "divider", type: "divider", data: { style: "line", label: "Continue", completionType: "none" } },
  { ...blockDefaults, id: "knowledge", type: "knowledgeCheck", data: { question: "Question?", options: ["Yes", "No"], correctOptionIndex: 0, correctFeedback: "Correct", incorrectFeedback: "Try again" } },
  { ...blockDefaults, id: "survey", type: "survey", data: { question: "How was it?", minLabel: "Low", maxLabel: "High" } },
  { ...blockDefaults, id: "flip-card", type: "flipCard", data: { cardsPerRow: 3, cardStyle: "classic", cardBackgroundColor: "#ffffff", cardTextColor: "#0f172a", cards: [{ id: "card-a", frontLabel: "Question", front: { type: "text", text: "Prompt" }, backLabel: "Answer", back: { type: "text", text: "Explanation" } }] } },
  { ...blockDefaults, id: "accordion", type: "accordion", data: { layout: "accordion", displayMode: "oneByOne", items: [{ id: "item-a", title: "First section", body: "First explanation" }, { id: "item-b", title: "Second section", body: "Second explanation" }] } },
  { ...blockDefaults, id: "labeled-graphic", type: "labeledGraphic", data: { src: "https://example.com/diagram.png", alt: "Diagram", markers: [{ id: "marker-a", label: "Part one", description: "Explanation", x: 30, y: 40 }] } },
  { ...blockDefaults, id: "process-steps", type: "processSteps", data: { steps: [{ id: "step-a", title: "First", body: "Do this" }, { id: "step-b", title: "Second", body: "Then this" }] } },
  { ...blockDefaults, id: "statement", type: "statement", data: { style: "key", title: "Key idea", body: "Remember this." } },
  { ...blockDefaults, id: "chart", type: "chart", data: { chartType: "bar", title: "Results", description: "", color: "#4f46e5", fields: [{ id: "one", label: "Group one", value: 5 }] } },
];

describe("content block settings access", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("shows a content settings control for every block type", () => {
    for (const block of blocks) {
      const markup = renderToStaticMarkup(createElement(ContentBlockEditor, {
        block,
        courseId: "course-1",
        onChange: () => {},
        onReplaceTemplate: () => {},
      }));

      expect(markup, `settings button for ${block.type}`).toContain('aria-label="Open content settings"');
    }
  });

  it("shows a lock on Continue when completion above is required", () => {
    const block: ContentBlock = {
      ...blockDefaults,
      id: "required-continue",
      type: "divider",
      data: { style: "continue", label: "Continue", completionType: "completeAbove" },
    };
    const markup = renderToStaticMarkup(createElement(ContentBlockEditor, {
      block,
      courseId: "course-1",
      onChange: () => {},
    }));

    expect(markup).toContain("lucide-lock-keyhole");
    expect(markup).toContain("Continue");
    expect(markup).toContain("background-color:var(--course-primary, #2f5f9f)");
  });

  it("exposes weight, color, and line style controls for line dividers", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "divider")!,
      courseId: "course-1",
      onChange,
    })));

    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    const settingsPanel = document.querySelector<HTMLDivElement>('[id="content-settings-divider"]')!;
    expect(settingsPanel.style.position).toBe("fixed");
    // The panel now anchors to the settings button; jsdom supplies zero-size rectangles.
    expect(settingsPanel.style.left).toBe("12px");
    expect(settingsPanel.style.top).toBe("8px");
    expect(settingsPanel.style.transform).toBe("");
    expect(settingsPanel.style.zIndex).toBe("9999");
    expect(document.querySelector('[aria-label="Divider line weight"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Divider line color"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Divider line style"]')).not.toBeNull();

    const weight = document.querySelector<HTMLSelectElement>('[aria-label="Divider line weight"]')!;
    act(() => {
      weight.value = "4";
      weight.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lineWeight: 4 }),
    }));
  });

  it("opens the style replacement action from a block's own settings", () => {
    const onReplaceTemplate = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "image")!,
      courseId: "course-1",
      onChange: () => {},
      onReplaceTemplate,
    })));

    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    const changeStyleButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Change block style"));
    expect(changeStyleButton).toBeDefined();
    act(() => changeStyleButton!.click());
    expect(onReplaceTemplate).toHaveBeenCalledOnce();
  });

  it("exposes editable front and back copy for a flip card", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "flipCard")!,
      courseId: "course-1",
      onChange,
    })));

    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    expect(document.querySelector('[aria-label="Card 1 front label"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Card 1 front text"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Card 1 back label"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Card 1 back text"]')).not.toBeNull();
    const cardsPerRow = document.querySelector<HTMLSelectElement>('[aria-label="Cards per row"]')!;
    expect([...cardsPerRow.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5"]);
    const cardStyle = document.querySelector<HTMLSelectElement>('[aria-label="Card style"]')!;
    expect([...cardStyle.options].map((option) => option.value)).toEqual(["classic", "soft", "outlined", "elevated"]);
    act(() => {
      cardsPerRow.value = "5";
      cardsPerRow.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ data: { cardsPerRow: 5 } });
    const updatedBlock = onChange.mock.lastCall?.[0];
    if (!updatedBlock || updatedBlock.type !== "flipCard") throw new Error("Expected an updated flip card block");
    act(() => root.render(createElement(ContentBlockEditor, {
      block: updatedBlock,
      courseId: "course-1",
      onChange,
    })));
    const backgroundColor = document.querySelector<HTMLInputElement>('[aria-label="Card background color"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(backgroundColor, "#123456");
      backgroundColor.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ data: { cardsPerRow: 5, cardBackgroundColor: "#123456" } });
    const addCardButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Add card"));
    expect(addCardButton).toBeDefined();
    act(() => addCardButton!.click());
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      data: { cards: [{ id: "card-a" }, { frontLabel: "Question", backLabel: "Answer", front: { type: "text" }, back: { type: "text" } }] },
    });
    const frontType = document.querySelector<HTMLSelectElement>('[aria-label="Card 1 front content type"]')!;
    act(() => {
      frontType.value = "image";
      frontType.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      data: { cards: [{ front: { type: "image", src: "https://placehold.co/800x520?text=Add+an+image" } }] },
    });
  });

  it("edits accordion sections and changes between accordion and tabs", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "accordion")!,
      courseId: "course-1",
      onChange,
    })));

    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    expect(document.querySelector('[aria-label="Reveal section 1 title"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Reveal section 1 explanation"]')).not.toBeNull();
    const display = document.querySelector<HTMLSelectElement>('[aria-label="Explanation display"]')!;
    act(() => {
      display.value = "all";
      display.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ type: "accordion", data: { displayMode: "all" } });
    const updatedBlock = onChange.mock.lastCall?.[0];
    if (!updatedBlock || updatedBlock.type !== "accordion") throw new Error("Expected an updated accordion block");
    act(() => root.render(createElement(ContentBlockEditor, {
      block: updatedBlock,
      courseId: "course-1",
      onChange,
    })));
    const layout = document.querySelector<HTMLSelectElement>('[aria-label="Reveal layout"]')!;
    act(() => {
      layout.value = "tabs";
      layout.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ type: "accordion", data: { layout: "tabs", displayMode: "all" } });
    const addSection = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Add section"));
    act(() => addSection?.click());
    expect(onChange.mock.lastCall?.[0].data.items).toHaveLength(3);
  });

  it("edits labeled graphic markers and process steps", () => {
    const graphicChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "labeledGraphic")!,
      courseId: "course-1",
      onChange: graphicChange,
    })));
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    expect(document.querySelector('[aria-label="Graphic marker 1 horizontal position"]')).toBeNull();
    expect(document.querySelector('[aria-label="Graphic marker 1 vertical position"]')).toBeNull();
    expect(document.querySelector('[aria-label="Graphic marker 1 color"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Graphic marker color"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Graphic marker text color"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Graphic marker radar color"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Drag a point on the image to position it.");
    const colorInput = document.querySelector<HTMLInputElement>('[aria-label="Graphic marker color"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(colorInput, "#cc3344");
      colorInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(graphicChange.mock.lastCall?.[0].data.markerColor).toBe("#cc3344");
    const textColorInput = document.querySelector<HTMLInputElement>('[aria-label="Graphic marker text color"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(textColorInput, "#111827");
      textColorInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(graphicChange.mock.lastCall?.[0].data.textColor).toBe("#111827");
    const radarColorInput = document.querySelector<HTMLInputElement>('[aria-label="Graphic marker radar color"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(radarColorInput, "#f97316");
      radarColorInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(graphicChange.mock.lastCall?.[0].data.radarColor).toBe("#f97316");
    const addMarker = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Add marker"));
    act(() => addMarker?.click());
    expect(graphicChange.mock.lastCall?.[0].data.markers).toHaveLength(2);
    expect(graphicChange.mock.lastCall?.[0].data.markers[1]).toMatchObject({ x: 50, y: 50 });
    const graphicAfterAdd = graphicChange.mock.lastCall?.[0];
    if (!graphicAfterAdd || graphicAfterAdd.type !== "labeledGraphic") throw new Error("Expected an updated labeled graphic");
    act(() => root.render(createElement(ContentBlockEditor, {
      block: graphicAfterAdd,
      courseId: "course-1",
      onChange: graphicChange,
    })));
    const interactionMode = document.querySelector<HTMLSelectElement>('[aria-label="Graphic interaction mode"]')!;
    act(() => {
      interactionMode.value = "spotTarget";
      interactionMode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(graphicChange.mock.lastCall?.[0]).toMatchObject({
      type: "labeledGraphic",
      data: {
        interactionMode: "spotTarget",
        sceneTheme: "data",
        challengePrompt: "Find the clue in the scene.",
        markers: [{ isTarget: true }, { isTarget: false }],
      },
    });

    const stepsChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      key: "process-steps-editor",
      block: blocks.find((block) => block.type === "processSteps")!,
      courseId: "course-1",
      onChange: stepsChange,
    })));
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());
    expect(document.querySelector('[aria-label="Process step 1 instructions"]')).not.toBeNull();
    const addStep = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Add step"));
    act(() => addStep?.click());
    expect(stepsChange.mock.lastCall?.[0].data.steps).toHaveLength(3);
  });

  it("edits chart data, changes the chart style and color, and adds a custom field", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(ContentBlockEditor, {
      block: blocks.find((block) => block.type === "chart")!,
      courseId: "course-1",
      onChange,
    })));
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Open content settings"]')!.click());

    expect(document.querySelector('[aria-label="Chart field 1 label"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Chart field 1 value"]')).not.toBeNull();
    const fieldLabel = document.querySelector<HTMLInputElement>('[aria-label="Chart field 1 label"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(fieldLabel, "New group");
      fieldLabel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].data.fields[0].label).toBe("New group");
    const fieldValue = document.querySelector<HTMLInputElement>('[aria-label="Chart field 1 value"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(fieldValue, "17");
      fieldValue.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].data.fields[0].value).toBe(17);
    const addField = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Add data field"));
    expect(addField).toBeDefined();
    act(() => addField!.click());
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      data: { fields: [{ label: "Group one", value: 5 }, { label: "Field 2", value: 0 }] },
    });

    const chartType = document.querySelector<HTMLSelectElement>('[aria-label="Chart type"]')!;
    act(() => {
      chartType.value = "donut";
      chartType.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].data.chartType).toBe("donut");

    const colorInput = document.querySelector<HTMLInputElement>('[aria-label="Chart color picker"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(colorInput, "#cc3344");
      colorInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].data.color).toBe("#cc3344");

    const colorCodeInput = document.querySelector<HTMLInputElement>('[aria-label="Chart color hex code"]')!;
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(colorCodeInput, "#285f90");
      colorCodeInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange.mock.lastCall?.[0].data.color).toBe("#285f90");
  });
});
