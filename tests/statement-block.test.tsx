import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatementBlockSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/block-settings/statement-block-settings";
import { StatementBlockSurface, statementStyles } from "@/app/courses/[courseId]/edit/_components/statement-block-preview";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { courseResponseSchema } from "@/lib/ai/generation/response-schemas";
import { courseBlockGenerationGuide, generatedBlockSeedSchema, generatedStatementStyleValues } from "@/lib/ai/course-generation-schemas";
import { sourceLearnSystemPrompt } from "@/lib/ai/generation/prompts";
import { blockSchema, statementStyleSchema, type StatementStyle } from "@/lib/schemas/block";

const statementStylesToTest = ["key", "alert", "danger", "info", "success", "tip", "warning", "centered"] as const satisfies readonly StatementStyle[];

describe("statement block styles", () => {
  it("keeps Key statement as the authoring default and Info as the AI fallback", () => {
    const block = blockSchema.parse({ id: "default-statement", version: 1, type: "statement", data: { title: "Key takeaway", body: "Remember this idea." } });
    const seed = generatedBlockSeedSchema.parse({ type: "statement", title: "Key takeaway", body: "Remember this idea.", bullets: [], question: "", options: [], correctOptionIndex: 0, steps: [], imageAlt: "", imagePrompt: "" });

    if (block.type !== "statement") throw new Error("Expected a statement block");
    expect(block.data.style).toBe("key");
    expect(seed.style).toBe("info");
  });

  it("accepts new semantic styles and keeps all existing style values valid", () => {
    for (const style of statementStylesToTest) {
      expect(statementStyleSchema.parse(style)).toBe(style);
      expect(blockSchema.parse({ id: `statement-${style}`, version: 1, type: "statement", data: { style, title: "Notice", body: "Statement text." } })).toMatchObject({ data: { style } });
    }
  });

  it("offers matching Add block templates for the default and semantic styles", () => {
    const templates = blockTemplates.filter((template) => template.category === "Statement");
    const byId = new Map(templates.map((template) => [template.id, template]));
    const expected = [
      ["statement-callout", "key"],
      ["statement-alert", "alert"],
      ["statement-danger", "danger"],
      ["statement-info", "info"],
      ["statement-success", "success"],
    ] as const;

    for (const [id, style] of expected) {
      const template = byId.get(id);
      expect(template?.statement?.style).toBe(style);
      const [inserted] = createBlocksFromTemplate(template!, id);
      expect(blockSchema.parse(inserted)).toMatchObject({ type: "statement", data: { style } });
    }
  });

  it("exposes style selection in Content settings and renders semantic callouts", () => {
    const block = blockSchema.parse({ id: "statement-settings", version: 1, type: "statement", data: { title: "Notice", body: "Statement text." } });
    if (block.type !== "statement") throw new Error("Expected a statement block");
    const settings = renderToStaticMarkup(createElement(StatementBlockSettings, { block, onChange: vi.fn() }));
    expect(settings).toContain('aria-label="Statement style"');
    for (const style of ["Key statement (default)", "Alert", "Danger", "Info", "Success"]) expect(settings).toContain(style);

    for (const [style, color] of [["alert", "amber"], ["danger", "rose"], ["info", "sky"], ["success", "emerald"]] as const) {
      const markup = renderToStaticMarkup(createElement(StatementBlockSurface, { style }, "Status message"));
      expect(markup).toContain(`data-statement-style="${style}"`);
      expect(markup).toContain(`bg-${color}-50`);
      expect(markup).toContain("<svg");
    }
    expect(statementStyles.key.container).toContain("var(--course-primary");
  });

  it("restricts AI output to semantic styles and gives neutral statements an Info fallback", () => {
    const blockSchemaForAi = courseResponseSchema.properties.sections.items.properties.lessons.items.properties.blocks.items;
    expect(blockSchemaForAi.properties.style.enum).toEqual(generatedStatementStyleValues);
    expect(blockSchemaForAi.properties.style.description).toContain("choose only alert, danger, info, or success");
    expect(generatedStatementStyleValues).toEqual(["alert", "danger", "info", "success"]);
    for (const style of statementStylesToTest) {
      const seed = generatedBlockSeedSchema.parse({ type: "statement", title: "Notice", body: "Statement text.", bullets: [], style, question: "", options: [], correctOptionIndex: 0, steps: [], imageAlt: "", imagePrompt: "" });
      expect(seed.style).toBe(style);
    }
    expect(courseBlockGenerationGuide).toContain("AI-generated statements, use only alert, danger, info, or success");
    expect(sourceLearnSystemPrompt).toContain("AI-generated statements use only alert, danger, info, or success");
    for (const guide of [courseBlockGenerationGuide, sourceLearnSystemPrompt]) {
      expect(guide).toContain("danger only for");
      expect(guide).toContain("success for");
      expect(guide).toContain("Do not generate key, tip, warning, or centered styles");
    }
  });
});
