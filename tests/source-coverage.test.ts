import { describe, expect, it } from "vitest";
import { generatedBlockSeedSchema, generatedCourseSeedSchema, type GeneratedSourceInventory } from "../lib/ai/course-generation-schemas";
import { expandLearnBlockResponse } from "../lib/ai/learn-block-response";
import { generatedLearnItemSchema } from "../lib/ai/generation/response-schemas";
import { buildSourceCoverageReport, validateLearnItemCoverage } from "../lib/ai/generation/source-coverage";

function block(value: object) {
  const expanded = expandLearnBlockResponse({ blocks: [{ title: "", sourceElementIds: ["p1-e1"], ...value }] }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

function pages(content: string): GeneratedSourceInventory["pages"] {
  return [{ pageNumber: 1, elements: [{ sourceElementId: "p1-e1", kind: "text", content, visualKind: "other", visibleText: "", uncertainContent: false }] }];
}

function lesson(blocks: ReturnType<typeof block>[]) {
  return generatedLearnItemSchema.parse({ title: "Requests", objective: "Compare the supplied measurements.", summary: "Compare the supplied data and explain the differences.", blocks });
}

describe("source coverage for native chart data", () => {
  it("recognizes values stored only in chart fields in both validation and the final coverage report", () => {
    const sourcePages = pages("North: 1200; South: 2400.");
    const chart = block({ type: "chart", title: "Requests", chartFields: [{ label: "North", value: 1200 }, { label: "South", value: 2400 }] });
    const issues = validateLearnItemCoverage(lesson([chart]), sourcePages);
    expect(issues).toEqual([]);
    const seed = generatedCourseSeedSchema.parse({
      title: "Requests", description: "Compare regional requests.",
      sections: [{ title: "Learn", lessons: [{ title: "Requests", objective: "Compare regions.", blocks: [chart] }] }],
      lessonOverview: [], keyTerms: [], preTest: [], postTest: [], lessonSummary: "Compare regional requests.", nextLesson: "Investigate requests",
    });
    const report = buildSourceCoverageReport(
      { sourcePageCount: 1, summary: "Regional requests.", sourceLanguage: "English", pages: sourcePages },
      { title: "Requests", description: "Compare regions.", objectives: [], sourceLanguage: "English", targetLanguage: "English", items: [{ title: "Requests", focus: "Compare regions.", startPage: 1, endPage: 1, sourceElementIds: ["p1-e1"], recommendedBlockTypes: ["chart"], interactionOpportunities: [] }] },
      seed, new Map([["p1-e1", { lessonId: "lesson", blockId: "chart" }]]), [issues],
    );
    expect(report.complete).toBe(true);
    expect(report.items[0].preservationStatus).toBe("preserved");
  });

  it.each([
    { content: "North: 30%; South: 70%.", title: "Share (%)", labels: ["North", "South"], values: [30, 70] },
    { content: "North: 30 kg; South: 70 kg.", title: "Harvest", labels: ["North (kg)", "South (kg)"], values: [30, 70] },
    { content: "North: 2.5%; South: 97.5%.", title: "Share%", labels: ["North", "South"], values: [2.5, 97.5] },
  ])("recognizes chart units in the title or field labels: $content", ({ content, title, labels, values }) => {
    const chart = block({ type: "chart", title, chartFields: labels.map((label, index) => ({ label, value: values[index] })) });
    expect(validateLearnItemCoverage(lesson([chart]), pages(content))).toEqual([]);
  });

  it.each([
    { title: "Share", value: 30, sourceElementIds: ["p1-e1"] },
    { title: "Share (%)", value: 0.3, sourceElementIds: ["p1-e1"] },
    { title: "Share (%)", value: 30, sourceElementIds: ["p2-e1"] },
  ])("still reports missing, changed, or unrelated chart data: $title / $value / $sourceElementIds", ({ title, value, sourceElementIds }) => {
    const chart = block({ type: "chart", title, sourceElementIds, chartFields: [{ label: "North", value }] });
    const mapping = block({ type: "text", body: "North has a share of the whole." });
    expect(validateLearnItemCoverage(lesson([mapping, chart]), pages("North: 30%.")).some((issue) => issue.includes("Important source value"))).toBe(true);
  });

  it.each([12000, 1200.5])("does not accept a chart value of %s for a source value of 1200", (value) => {
    const chart = block({ type: "chart", title: "Requests", chartFields: [{ label: "North", value }] });
    expect(validateLearnItemCoverage(lesson([chart]), pages("North: 1200 requests.")).some((issue) => issue.includes("Important source value"))).toBe(true);
  });

  it("counts numeric explanations in chart descriptions and graphic markers", () => {
    const chart = block({ type: "chart", title: "Requests", chartDescription: "The source counted 1200 requests.", chartFields: [{ label: "North", value: 10 }] });
    const graphic = block({ type: "labeledGraphic", imagePrompt: "A labeled course diagram.", markers: [{ label: "Cache", description: "Wait 5000 ms before retrying.", x: 50, y: 50 }] });
    expect(validateLearnItemCoverage(lesson([chart, graphic]), pages("The source counted 1200 requests. Wait 5000 ms before retrying."))).toEqual([]);
  });
});
