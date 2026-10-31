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
      expect(parsed).toMatchObject({ type: "richText", width: "medium", blockPadding: 40 });
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

describe("new template block spacing", () => {
  it.each(["image", "video", "gallery"] as const)("creates every %s template at M content width", (type) => {
    const templates = blockTemplates.filter((template) => template.type === type);
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      const [block] = createBlocksFromTemplate(template, `width-${template.id}`);
      expect(block).toMatchObject({ type, width: "medium", widthCustom: false });
    }
  });

  it("uses at least 40px of vertical padding for content and no padding for interaction buttons", () => {
    for (const template of blockTemplates) {
      const blocks = createBlocksFromTemplate(template, `padding-${template.id}`);
      expect(blocks.length, template.id).toBeGreaterThan(0);
      for (const block of blocks) {
        if (block.type === "interactionButton" || block.type === "audioInstruction") expect(block.blockPadding).toBe(0);
        else expect(block.blockPadding, template.id).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe("prebuilt file attachment block", () => {
  it("adds a downloadable file block with an attachment library preview", () => {
    const template = blockTemplates.find((item) => item.id === "media-attachment");
    expect(template).toMatchObject({ category: "Attachment", type: "attachment" });
    const [block] = createBlocksFromTemplate(template!, "attachment-1");
    expect(blockSchema.parse(block)).toMatchObject({
      type: "attachment",
      data: { src: "", fileName: "", size: 0 },
    });
    const preview = renderToStaticMarkup(createElement(TemplatePreview, { template: template! }));
    expect(preview).toContain("Download a file");
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
      expect(parsed).toMatchObject({ type: "chart", width: "medium", blockPadding: 40 });
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
      expect(parsed).toMatchObject({ width: "medium" });
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

describe("prebuilt lesson link templates", () => {
  it("offers button, card, and inline resource links with matching previews", () => {
    const templates = blockTemplates.filter((template) => template.category === "Link");

    expect(templates.map((template) => template.id)).toEqual([
      "link-button",
      "link-card",
      "link-inline",
    ]);

    for (const template of templates) {
      const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(block);
      expect(parsed.type).toBe("link");
      if (parsed.type !== "link") continue;
      expect(parsed.data.url).toBe("https://example.com");
      expect(renderToStaticMarkup(createElement(TemplatePreview, { template }))).toContain(parsed.data.label);
    }
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

      expect(parsed).toMatchObject({ type: "richText", width: "medium", blockPadding: 40 });
      if (parsed.type !== "richText") continue;
      expect(parsed.data.html).toContain("<blockquote>");
    }
  });
});

describe("prebuilt divider templates", () => {
  it("offers solid, dashed, dotted, double, and bold line presets with matching previews", () => {
    const lineTemplates = blockTemplates.filter(
      (template) => template.category === "Divider" && template.dividerStyle === "line",
    );

    expect(lineTemplates.map((template) => template.id)).toEqual([
      "divider-line",
      "divider-line-dashed",
      "divider-line-dotted",
      "divider-line-double",
      "divider-line-accent",
      "divider-line-bold",
    ]);

    for (const template of lineTemplates) {
      const [inserted] = createBlocksFromTemplate(template, `block-${template.id}`);
      const parsed = blockSchema.parse(inserted);
      expect(parsed.type).toBe("divider");
      if (parsed.type !== "divider") continue;
      expect(parsed.data).toMatchObject({
        style: "line",
        lineStyle: template.dividerLineStyle ?? "solid",
        lineWeight: template.dividerLineWeight ?? 1,
        lineColor: template.dividerLineColor ?? "#cbd5e1",
      });

      const preview = renderToStaticMarkup(createElement(TemplatePreview, { template }));
      expect(preview).toContain(`border-top-style:${template.dividerLineStyle ?? "solid"}`);
      expect(preview).toContain(`border-top-color:${template.dividerLineColor ?? "#cbd5e1"}`);
    }
  });

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
      "interactive-button",
      "interactive-reveal",
      "interactive-accordion",
      "interactive-tabs",
      "interactive-labeled-graphic",
      "interactive-explore-data",
      "interactive-explore-network",
      "interactive-explore-field",
      "interactive-process-steps",
      "interactive-sequence-data",
      "interactive-sequence-it",
      "interactive-sequence-agriculture",
      "interactive-process-steps-numbered",
      "interactive-process-steps-timeline",
      "interactive-process-steps-spotlight",
      "interactive-process-steps-minimal",
      "interactive-confidence-poll",
    ]);

    const insertedById = new Map(
      interactiveTemplates.map((template) => {
        const [block] = createBlocksFromTemplate(template, `block-${template.id}`);
        return [template.id, blockSchema.parse(block)] as const;
      }),
    );

    expect(interactiveTemplates.filter((item) => item.type === "flipCard")).toHaveLength(1);
    expect(insertedById.get("interactive-reveal")).toMatchObject({
      type: "flipCard",
      width: "full",
      blockPadding: 40,
      data: {
        cardsPerRow: 3,
        cardStyle: "classic",
        cardBackgroundColor: "#ffffff",
        cardTextColor: "#0f172a",
        cards: [{ frontLabel: "Predict", backLabel: "Reveal" }],
      },
    });
    expect(insertedById.get("interactive-accordion")).toMatchObject({
      type: "accordion",
      data: {
        layout: "accordion",
        items: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
      },
    });
    expect(insertedById.get("interactive-tabs")).toMatchObject({
      type: "accordion",
      data: {
        layout: "tabs",
        items: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
      },
    });
    expect(insertedById.get("interactive-labeled-graphic")).toMatchObject({
      type: "labeledGraphic",
      data: {
        markers: expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
        ]),
      },
    });
    for (const [templateId, sceneTheme] of [
      ["interactive-explore-data", "data"],
      ["interactive-explore-network", "network"],
      ["interactive-explore-field", "agriculture"],
    ] as const) {
      expect(insertedById.get(templateId)).toMatchObject({
        type: "labeledGraphic",
        data: {
          interactionMode: "explore",
          sceneTheme,
          markers: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
        },
      });
    }
    expect(insertedById.get("interactive-process-steps")).toMatchObject({
      type: "processSteps",
      data: {
        steps: expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
        ]),
      },
    });
    expect(insertedById.get("interactive-sequence-data")).toMatchObject({
      type: "processSteps",
      data: { steps: expect.arrayContaining([expect.objectContaining({ title: "Define the question" })]) },
    });
    expect(insertedById.get("interactive-sequence-it")).toMatchObject({
      type: "processSteps",
      data: { steps: expect.arrayContaining([expect.objectContaining({ title: "Verify the source" })]) },
    });
    expect(insertedById.get("interactive-sequence-agriculture")).toMatchObject({
      type: "processSteps",
      data: { steps: expect.arrayContaining([expect.objectContaining({ title: "Prepare the soil" })]) },
    });
    expect(insertedById.get("interactive-confidence-poll")).toMatchObject({ type: "survey" });
  });

  it("starts interactive images with an image placeholder and no free map", () => {
    const template = blockTemplates.find((item) => item.id === "interactive-labeled-graphic")!;
    expect(template.labeledGraphic?.src).toBe("https://placehold.co/1200x675?text=Add+an+image");
    expect(template.labeledGraphic?.objectFit).toBe("contain");
    expect(template.labeledGraphic?.mapTemplate).toBeUndefined();
    const block = createBlocksFromTemplate(template, "graphic")[0];
    expect(blockSchema.safeParse(block).success).toBe(true);
    expect(block).toMatchObject({ type: "labeledGraphic", data: { src: template.labeledGraphic!.src } });
    const markup = renderToStaticMarkup(createElement(TemplatePreview, { template }));
    expect(markup).not.toContain("illustrated lesson map");
  });

  it("previews field-specific explore scenes with clickable markers", () => {
    for (const [templateId, theme] of [
      ["interactive-explore-data", "data"],
      ["interactive-explore-network", "network"],
      ["interactive-explore-field", "agriculture"],
    ] as const) {
      const template = blockTemplates.find((item) => item.id === templateId);
      expect(template).toBeDefined();
      const markup = renderToStaticMarkup(createElement(TemplatePreview, { template: template! }));
      expect(markup).toContain('data-scene-hotspot-preview=""');
      expect(markup).toContain(`data-scene-theme="${theme}"`);
      expect(markup.match(/Select a marker to explore/g)).toHaveLength(1);
    }
  });

  it("previews one flip card template with a single card", () => {
    const flipCardTemplates = blockTemplates.filter(
      (item) => item.category === "Interactive" && item.type === "flipCard",
    );
    expect(flipCardTemplates.map((item) => item.id)).toEqual(["interactive-reveal"]);

    const markup = renderToStaticMarkup(
      createElement(TemplatePreview, { template: flipCardTemplates[0] }),
    );
    expect(markup.match(/data-template-preview-card=/g)).toHaveLength(1);
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
    expect(blockTemplates.filter((item) => item.category === "Interactive" && item.type === "knowledgeCheck")).toHaveLength(0);
    expect(blockTemplates.filter((item) => item.category === "Knowledge check").map((item) => item.id)).toEqual(["knowledge-choice"]);
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
