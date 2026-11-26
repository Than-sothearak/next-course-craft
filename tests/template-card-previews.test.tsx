import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { TemplatePreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/template-preview";
import { codeExampleSample } from "@/lib/editor/code-example";

function preview(id: string) {
  const template = blockTemplates.find((item) => item.id === id)!;
  return renderToStaticMarkup(createElement(TemplatePreview, { template }));
}

describe("compact picker previews", () => {
  it.each(["link-button", "link-card", "link-inline"])("keeps %s recognizable without adding a nested link inside the picker button", (id) => {
    const template = blockTemplates.find((item) => item.id === id)!;
    const html = preview(id);
    expect(html).toContain(`data-template-link-preview="${template.link!.style}"`);
    expect(html).toContain(template.link!.label);
    if (template.link!.description) expect(html).toContain(template.link!.description);
    expect(html).toContain("<svg");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("href=");
  });

  it("keeps concept relationships and database keys visible without full lesson explanations", () => {
    const concept = preview("concept-map-core");
    expect(concept).toContain("Central concept");
    expect(concept).toContain("includes");
    expect(concept).toContain("depends on");
    expect(concept).not.toContain("Explain this connection.");

    const database = preview("database-schema-users-orders");
    expect(database).toContain("Users");
    expect(database).toContain("Orders");
    expect(database).toContain("primary key");
    expect(database).toContain("foreign key");
    expect(database).toContain("belongs to");
    expect(database).toContain("N : 1");
    expect(database).not.toContain("Orders belong to users, and each order has its own primary key.");
  });

  it("retains the distinct statement colors and icons in the compact surface", () => {
    for (const template of blockTemplates.filter((item) => item.type === "statement")) {
      const html = preview(template.id);
      expect(html).toContain(`data-statement-style="${template.statement!.style}"`);
      expect(html).toContain(template.statement!.title);
      expect(html).toContain(template.statement!.body);
      if (["alert", "danger", "info", "success"].includes(template.statement!.style)) {
        expect(html).toContain("<svg");
      }
    }
  });

  it("renders each chart shape with accessible field names and actual values", () => {
    for (const template of blockTemplates.filter((item) => item.type === "chart")) {
      const html = preview(template.id);
      expect(html).toContain(`data-template-chart-preview="${template.chart!.chartType}"`);
      expect(html).toContain('role="img"');
      for (const field of template.chart!.fields) {
        expect(html).toContain(`${field.label} ${field.value}`);
      }
      expect(html).not.toContain("h-56");
    }
  });

  it("shows typeset equations with their variable legend and a semantic comparison table", () => {
    const formula = preview("formula-ohms-law");
    expect(formula).toContain('role="math"');
    expect(formula).toContain('class="katex"');
    expect(formula).toContain("Voltage, measured in volts");
    expect(formula).toContain("Electrical resistance, measured in ohms");
    const table = preview("table-comparison");
    expect(table).toContain("<table");
    expect(table).toContain('scope="col"');
    expect(table).toContain("Concept");
    expect(table).toContain("Add its explanation");
  });

  it("keeps full syntax-highlighted code while abbreviating the supporting explanation visually", () => {
    const html = preview("code-snippet");
    expect(html).toContain("greeting.js");
    expect(html).toContain("cc-code-token-keyword");
    expect(html).toContain("greetLearner");
    expect(html).toContain("Welcome!");
    const explained = blockTemplates.find((item) => item.category === "Code" && item.codeTemplate === "paper-explained-above")!;
    expect(preview(explained.id)).toContain(codeExampleSample.explanation.replaceAll('"', "&quot;"));
  });
});
