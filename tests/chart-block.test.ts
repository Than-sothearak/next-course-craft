import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartBlockPreview } from "../app/courses/[courseId]/preview/chart-block";
import { blockSchema, type ContentBlock } from "../lib/schemas/block";

const chartTypes = ["bar", "column", "line", "donut", "stacked"] as const;

describe("chart content blocks", () => {
  it("validates persisted chart data and renders every supported chart style", () => {
    for (const chartType of chartTypes) {
      const block = blockSchema.parse({
        id: `chart-${chartType}`,
        version: 1,
        type: "chart",
        data: {
          chartType,
          title: "Learner results",
          description: "Results for this course.",
          color: "#2878b5",
          fields: [
            { id: "finished", label: "Finished", value: 78 },
            { id: "started", label: "Started", value: 22 },
          ],
        },
      });

      expect(block).toMatchObject({
        type: "chart",
        width: "medium",
        blockPadding: 40,
        data: { chartType, color: "#2878b5", fields: [{ value: 78 }, { value: 22 }] },
      });
      if (block.type !== "chart") throw new Error("Expected a chart block");
      const markup = renderToStaticMarkup(createElement(ChartBlockPreview, { data: block.data }));
      expect(markup).toContain("Learner results");
      expect(markup).toContain("Finished");
      expect(markup).toContain("78");
      expect(markup).toContain("#2878b5");
    }
  });

  it("rejects invalid colors and more than twenty custom fields", () => {
    const fields = Array.from({ length: 21 }, (_, index) => ({
      id: `field-${index}`,
      label: `Field ${index + 1}`,
      value: index,
    }));
    const chart: Extract<ContentBlock, { type: "chart" }> = {
      id: "custom-chart",
      version: 1,
      type: "chart",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: {
        chartType: "bar",
        title: "Custom values",
        description: "",
        color: "#4f46e5",
        fields: [{ id: "one", label: "One", value: 1 }],
      },
    };

    expect(blockSchema.safeParse({ ...chart, data: { ...chart.data, color: "blue" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...chart, data: { ...chart.data, fields } }).success).toBe(false);
  });
});
