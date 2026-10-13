import { describe, expect, it } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import {
  blockTemplates,
  createBlocksFromTemplate,
} from "../app/courses/[courseId]/edit/_components/block-template-picker";

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
      data: { style: "continue", label: "Continue", completionType: "none" },
    });
    expect(createBlocksFromTemplate(continueTemplates[1], "reading-block")[0]).toMatchObject({
      data: { label: "Continue reading", completionType: "none" },
    });
    expect(createBlocksFromTemplate(continueTemplates[2], "required-block")[0]).toMatchObject({
      data: { completionType: "completeAbove" },
    });
  });
});
