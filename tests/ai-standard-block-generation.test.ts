import { describe, expect, it } from "vitest";
import { generatedBlockSeedSchema } from "../lib/ai/course-generation-schemas";
import { toContentBlock } from "../lib/ai/generation/block-content";
import { validateLearnItemCoverage } from "../lib/ai/generation/source-coverage";
import { generatedLearnItemSchema } from "../lib/ai/generation/response-schemas";
import { expandLearnBlockResponse } from "../lib/ai/learn-block-response";

function seed(value: object) {
  const expanded = expandLearnBlockResponse({ blocks: [{ title: "", ...value }] }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

describe("AI Standard visual and ordering block generation", () => {
  it("converts a source-supported concept map and assigns native branch IDs", async () => {
    const converted = await toContentBlock(seed({
      type: "conceptMap",
      title: "Flexbox relationships",
      sourceElementIds: ["p1-e1"],
      conceptMapCentralConcept: "Flexbox",
      conceptMapCentralExplanation: "A one-dimensional layout model.",
      conceptMapBranches: [
        { relationship: "controls", concept: "Main axis", explanation: "Sets the primary flow direction." },
        { relationship: "aligns", concept: "Cross axis", explanation: "Runs perpendicular to the main axis." },
      ],
    }), "owner", "course", false, false, () => {});

    expect(converted.block.type).toBe("conceptMap");
    if (converted.block.type !== "conceptMap") throw new Error("Expected a concept map block");
    expect(converted.block.data.centralConcept).toBe("Flexbox");
    expect(converted.block.data.branches).toEqual([
      expect.objectContaining({ relationship: "controls", concept: "Main axis" }),
      expect.objectContaining({ relationship: "aligns", concept: "Cross axis" }),
    ]);
    expect(new Set(converted.block.data.branches.map((branch) => branch.id)).size).toBe(2);

    const learnItem = generatedLearnItemSchema.parse({
      title: "Flexbox",
      objective: "Explain how the axes relate to item layout.",
      summary: "The two axes guide item placement.",
      blocks: [seed({
        type: "conceptMap",
        title: "Flexbox relationships",
        sourceElementIds: ["p1-e1"],
        conceptMapCentralConcept: "Flexbox",
        conceptMapCentralExplanation: "A layout system.",
        conceptMapBranches: [
          { relationship: "controls", concept: "Main axis", explanation: "Sets item direction." },
          { relationship: "aligns", concept: "Cross axis", explanation: "Runs perpendicular to item direction." },
        ],
      })],
    });
    expect(validateLearnItemCoverage(learnItem, [{
      pageNumber: 1,
      elements: [{ sourceElementId: "p1-e1", kind: "text", content: "Flexbox main axis controls item direction. Cross axis aligns items perpendicular.", visualKind: "other", visibleText: "", uncertainContent: false }],
    }])).toEqual([]);
  });

  it("rejects unsupported concept-map gaps and preserves selected ordering mode", async () => {
    const expandedInvalid = expandLearnBlockResponse({ blocks: [{
      type: "conceptMap",
      title: "",
      conceptMapCentralConcept: "Flexbox",
      conceptMapBranches: [{ relationship: "controls", concept: "Main axis" }],
    }] }) as { blocks: unknown[] };
    expect(generatedBlockSeedSchema.safeParse(expandedInvalid.blocks[0]).success).toBe(false);

    const orderedSteps = seed({
      type: "processSteps",
      activityMode: "ordering",
      steps: [
        { title: "Read the source", body: "Identify the stated events or actions." },
        { title: "Rebuild the order", body: "Arrange the exact source sequence." },
      ],
    });
    const converted = await toContentBlock(orderedSteps, "owner", "course", false, false, () => {});
    expect(converted.block).toMatchObject({ type: "processSteps", data: { activityMode: "ordering" } });
  });
});
