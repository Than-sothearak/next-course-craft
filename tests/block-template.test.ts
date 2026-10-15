import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import { blockTemplates } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { TemplatePreview } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/template-preview";
import { TextTemplatePreview } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/(template_preview_components)/text-template-preview";
import { codeExamplePresets } from "../lib/editor/code-example";

describe("prebuilt lesson text templates", () => {
  it.each([
    ["title", "Section heading", "text-2xl"],
    ["text", "Write a concise explanation", "text-[11px]"],
    ["text-lead", "Introduce the main idea", "text-sm"],
    ["text-large-body", "Explain one important idea", "text-base"],
    ["text-small-note", "Note: Add a short reminder", "text-[10px]"],
    ["text-centered-intro", "A new way to think", "text-center"],
    ["text-subheading", "A clear subheading", "font-semibold"],
    ["text-color-emphasis", "Key idea", "text-indigo-600"],
  ])("delegates %s to the text preview component with the same content and styles", (kind, text, className) => {
    const template = blockTemplates.find((item) => item.category === "Text" && item.preview === kind)!;
    expect(template).toBeDefined();
    const preview = renderToStaticMarkup(createElement(TextTemplatePreview, { kind }));
    expect(preview).toContain(text);
    expect(preview).toContain(className);
    expect(renderToStaticMarkup(createElement(TemplatePreview, { template }))).toBe(preview);
  });

  it("offers editable text layouts with varied sizes and alignment", () => {
    const textTemplates = blockTemplates.filter(
      (template) => template.category === "Text",
    );

    expect(textTemplates.map((template) => template.id)).toEqual([
      "text-title-paragraph",
      "text-paragraph",
      "text-lead",
      "text-large-body",
      "text-small-note",
      "text-centered-intro",
      "text-subheading",
      "text-color-emphasis",
    ]);

    const inserted = textTemplates.map((template) => {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);
      expect(parsed).toMatchObject({ type: "richText", width: "medium", blockPadding: 20 });
      if (parsed.type !== "richText") throw new Error("Expected rich text block");
      return [template.id, parsed.data.html] as const;
    });
    const htmlById = new Map(inserted);

    expect(htmlById.get("text-title-paragraph")).toContain("font-size: 36px");
    expect(htmlById.get("text-lead")).toContain("font-size: 20px");
    expect(htmlById.get("text-large-body")).toContain("font-size: 24px");
    expect(htmlById.get("text-small-note")).toContain("font-size: 14px");
    expect(htmlById.get("text-centered-intro")).toContain('text-align: center');
    expect(htmlById.get("text-subheading")).toContain("font-size: 24px");
    expect(htmlById.get("text-color-emphasis")).toContain("color: #4f46e5");
  });
});

describe("prebuilt code snippet template", () => {
  it("offers every code theme and explanation layout as an editable native text template", () => {
    const templates = blockTemplates.filter((template) => template.category === "Code");
    expect(templates).toHaveLength(codeExamplePresets.length);
    for (const preset of codeExamplePresets) {
      const template = templates.find((template) => template.codeTemplate === preset.id);
      expect(template).toBeDefined();
      const [block] = createBlocksFromTemplate(template!, `code-${preset.id}`);
      expect(blockSchema.safeParse(block).success).toBe(true);
      if (block.type !== "richText") throw new Error("Expected editable text block");
      expect(block.data.html).toContain(`data-code-theme="${preset.theme}"`);
      if (preset.id !== "midnight-code") expect(block.data.html).toContain("<p>The function returns");
      expect(renderToStaticMarkup(createElement(TemplatePreview, { template: template! }))).toContain(`data-code-theme="${preset.theme}"`);
    }
  });

  it("creates an editable code block with a matching editor-style preview", () => {
    const template = blockTemplates.find((item) => item.id === "code-snippet");
    expect(template).toBeDefined();
    const [block] = createBlocksFromTemplate(template!, "code-example");
    const parsed = blockSchema.parse(block);

    expect(parsed).toMatchObject({
      type: "richText",
      data: { html: expect.stringContaining('data-code-theme="midnight"') },
    });
    const preview = renderToStaticMarkup(
      createElement(TemplatePreview, { template: template! }),
    );
    expect(preview).toContain('data-template-code-preview=""');
    expect(preview).toContain("greeting.js");
    expect(preview).toContain("JavaScript");
  });
});

describe("prebuilt chart templates", () => {
  it("offers real editable bar, column, line, donut, and stacked chart presets", () => {
    const chartTemplates = blockTemplates.filter(
      (template) => template.category === "Chart",
    );

    expect(chartTemplates.map((template) => template.id)).toEqual([
      "chart-bars",
      "chart-horizontal-comparison",
      "chart-columns-quarterly",
      "chart-line-trend",
      "chart-donut-share",
      "chart-stacked-distribution",
    ]);

    for (const template of chartTemplates) {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);
      expect(parsed).toMatchObject({ type: "chart", width: "medium", blockPadding: 20 });
      if (parsed.type !== "chart") throw new Error("Expected a chart block");
      expect(parsed.data.fields.length).toBeGreaterThan(1);
      expect(parsed.data.color).toMatch(/^#[\da-fA-F]{6}$/);
      expect(renderToStaticMarkup(createElement(TemplatePreview, { template }))).toContain(parsed.data.title);
    }

    expect(chartTemplates.map((template) => template.chart?.chartType)).toEqual([
      "bar", "bar", "column", "line", "donut", "stacked",
    ]);
  });
});

describe("prebuilt lesson image templates", () => {
  it("offers image, banner, text pairing, overlay, and card layouts", () => {
    const imageTemplates = blockTemplates.filter(
      (template) => template.category === "Image",
    );

    expect(imageTemplates.map((template) => template.id)).toEqual([
      "image-single",
      "image-banner",
      "image-text-left",
      "image-text-right",
      "image-text-overlay",
      "image-feature-card",
    ]);

    for (const template of imageTemplates) {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);
      expect(parsed.type).toBe("image");
      if (parsed.type !== "image") continue;
      expect(parsed.data.layout).toBe(template.imageLayout);
      expect(parsed).toMatchObject({ width: template.width ?? "small" });
    }

    const splitLayout = createBlocksFromTemplate(
      imageTemplates.find((template) => template.id === "image-text-left")!,
      "split-image",
    )[0];
    expect(blockSchema.parse(splitLayout)).toMatchObject({
      type: "image",
      width: "medium",
      data: {
        layout: "text-left",
        title: "Explain the idea",
        body: "Add a short explanation that helps learners understand this image.",
      },
    });
  });
});

describe("prebuilt lesson list templates", () => {
  it("adds editable numbered and unordered list blocks for each preset", () => {
    const listTemplates = blockTemplates.filter(
      (template) => template.category === "List",
    );

    expect(listTemplates.map((template) => template.id)).toEqual([
      "list-bulleted",
      "list-numbered",
      "list-lettered",
      "list-roman",
      "list-circle-bullets",
      "list-square-bullets",
      "list-checklist",
      "list-dashes",
    ]);

    for (const template of listTemplates) {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);

      expect(parsed.type).toBe("richText");
      if (parsed.type !== "richText") continue;
      expect(parsed.data.html).toMatch(/^<(ul|ol)/);
    }
  });

  it("retains the selected list marker style in the inserted content", () => {
    const styles = new Map(
      blockTemplates
        .filter((template) => template.category === "List")
        .map((template) => [
          template.id,
          createBlocksFromTemplate(template, `block-${template.id}`)[0],
        ]),
    );

    expect((styles.get("list-circle-bullets") as { data: { html: string } }).data.html).toContain('data-list-style="circle"');
    expect((styles.get("list-square-bullets") as { data: { html: string } }).data.html).toContain('data-list-style="square"');
    expect((styles.get("list-checklist") as { data: { html: string } }).data.html).toContain('data-list-style="check"');
    expect((styles.get("list-dashes") as { data: { html: string } }).data.html).toContain('data-list-style="dash"');
    expect((styles.get("list-lettered") as { data: { html: string } }).data.html).toContain('type="A"');
    expect((styles.get("list-roman") as { data: { html: string } }).data.html).toContain('type="I"');
  });
});

describe("prebuilt quote templates", () => {
  it("provides varied editable quote layouts with the text block defaults", () => {
    const quoteTemplates = blockTemplates.filter(
      (template) => template.category === "Quote",
    );

    expect(quoteTemplates.map((template) => template.id)).toEqual([
      "quote-attribution",
      "quote-pull",
      "quote-centered",
      "quote-citation",
      "quote-testimonial",
    ]);

    for (const template of quoteTemplates) {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);

      expect(parsed).toMatchObject({ type: "richText", width: "medium", blockPadding: 20 });
      if (parsed.type !== "richText") continue;
      expect(parsed.data.html).toContain("<blockquote>");
    }
  });
});

describe("prebuilt divider templates", () => {
  it("adds continue button presets with editable labels and completion settings", () => {
    const dividerTemplates = blockTemplates.filter(
      (template) => template.category === "Divider",
    );
    const continueTemplates = dividerTemplates.filter(
      (template) => template.dividerStyle === "continue",
    );

    expect(continueTemplates.map((template) => template.id)).toEqual([
      "divider-continue",
      "divider-continue-reading",
      "divider-continue-required",
    ]);
    expect(createBlocksFromTemplate(continueTemplates[0], "continue-block")[0]).toMatchObject({
      type: "divider",
      blockPadding: 100,
      data: { style: "continue", label: "Continue", completionType: "none" },
    });
    expect(createBlocksFromTemplate(continueTemplates[1], "reading-block")[0]).toMatchObject({
      blockPadding: 100,
      data: { label: "Continue reading", completionType: "none" },
    });
    expect(createBlocksFromTemplate(continueTemplates[2], "required-block")[0]).toMatchObject({
      blockPadding: 100,
      data: { completionType: "completeAbove" },
    });
  });
});

describe("prebuilt interactive block templates", () => {
  it("offers ready-made flip cards plus other learner interactions", () => {
    const interactiveTemplates = blockTemplates.filter(
      (item) => item.category === "Interactive",
    );

    expect(interactiveTemplates.map((item) => item.id)).toEqual([
      "interactive-reveal",
      "interactive-term-definition",
      "interactive-scenario-reveal",
      "interactive-flashcards-2",
      "interactive-flashcards-3",
      "interactive-flashcards-4",
      "interactive-accordion",
      "interactive-tabs",
      "interactive-labeled-graphic",
      "interactive-process-steps",
      "interactive-process-steps-numbered",
      "interactive-process-steps-timeline",
      "interactive-process-steps-spotlight",
      "interactive-process-steps-minimal",
      "interactive-knowledge-check",
      "interactive-confidence-poll",
    ]);

    const inserted = interactiveTemplates.map((template) => {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      return blockSchema.parse(block);
    });

    expect(inserted[0]).toMatchObject({
      type: "flipCard",
      width: "full",
      blockPadding: 20,
      data: { cards: [{ frontLabel: "Think about it", backLabel: "Reveal" }] },
    });
    expect(inserted[1]).toMatchObject({
      type: "flipCard",
      data: { cards: [{ frontLabel: "Term", backLabel: "Definition" }] },
    });
    expect(inserted[2]).toMatchObject({
      type: "flipCard",
      data: { cards: [{ frontLabel: "Scenario", backLabel: "Suggested response" }] },
    });
    expect(inserted[3]).toMatchObject({ type: "flipCard", width: "full", data: { cards: expect.arrayContaining([expect.any(Object), expect.any(Object)]) } });
    expect(inserted[4]).toMatchObject({ type: "flipCard", width: "full", data: { cards: expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object)]) } });
    expect(inserted[5]).toMatchObject({ type: "flipCard", width: "full", data: { cards: expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object), expect.any(Object)]) } });
    expect(inserted[6]).toMatchObject({ type: "accordion", data: { layout: "accordion", items: expect.arrayContaining([expect.any(Object), expect.any(Object)]) } });
    expect(inserted[7]).toMatchObject({ type: "accordion", data: { layout: "tabs", items: expect.arrayContaining([expect.any(Object), expect.any(Object)]) } });
    expect(inserted[8]).toMatchObject({ type: "labeledGraphic", data: { markers: expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object)]) } });
    expect(inserted[9]).toMatchObject({ type: "processSteps", data: { steps: expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object)]) } });
    expect(inserted[14]).toMatchObject({ type: "knowledgeCheck" });
    expect(inserted[15]).toMatchObject({ type: "survey" });
  });

  it("previews every flip card in the two, three, and four card presets", () => {
    for (const [templateId, expectedCount] of [
      ["interactive-flashcards-2", 2],
      ["interactive-flashcards-3", 3],
      ["interactive-flashcards-4", 4],
    ] as const) {
      const template = blockTemplates.find((item) => item.id === templateId);
      expect(template).toBeDefined();
      const markup = renderToStaticMarkup(
        createElement(TemplatePreview, { template: template! }),
      );

      expect(markup.match(/data-template-preview-card=/g)).toHaveLength(expectedCount);
    }
  });

  it("previews accordion, tabs, labeled graphic markers, and process steps", () => {
    for (const templateId of [
      "interactive-accordion",
      "interactive-tabs",
      "interactive-labeled-graphic",
      "interactive-process-steps",
    ]) {
      const template = blockTemplates.find((item) => item.id === templateId);
      expect(template).toBeDefined();
      const markup = renderToStaticMarkup(
        createElement(TemplatePreview, { template: template! }),
      );
      expect(markup.length).toBeGreaterThan(100);
    }

    const graphicTemplate = blockTemplates.find((item) => item.id === "interactive-labeled-graphic")!;
    const graphicPreview = renderToStaticMarkup(createElement(TemplatePreview, { template: graphicTemplate }));
    expect(graphicPreview.match(/place-items-center rounded-full/g)).toHaveLength(3);
    const processTemplate = blockTemplates.find((item) => item.id === "interactive-process-steps")!;
    const processPreview = renderToStaticMarkup(createElement(TemplatePreview, { template: processTemplate }));
    expect(processPreview).toContain("Step 1 of 3");
  });

  it("creates a knowledge check with a valid answer and useful feedback", () => {
    const template = blockTemplates.find((item) => item.id === "knowledge-choice");
    expect(template).toBeDefined();
    const [block] = createBlocksFromTemplate(template!, "knowledge-check-a");
    expect(blockSchema.parse(block)).toMatchObject({
      type: "knowledgeCheck",
      data: {
        correctOptionIndex: 0,
        correctFeedback: "Correct! Practice helps make learning stick.",
        incorrectFeedback: "Not quite. Think about what helps a new skill improve.",
      },
    });
  });
});
