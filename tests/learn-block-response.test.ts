import { describe, expect, it } from "vitest";
import { generatedBlockSeedSchema, generatedBlockTypeValues } from "../lib/ai/course-generation-schemas";
import { createLearnBlockResponseSchema, expandLearnBlockResponse } from "../lib/ai/learn-block-response";

const examples = {
  heading: { title: "Layout", body: "", headingLevel: 2 },
  richText: { body: "A full paragraph explanation.", bullets: [] },
  text: { body: "Another full explanation.", bullets: ["An original detail."] },
  code: { body: "display: flex;", codeExample: { template: "paper-explained-above", language: "css", explanation: "This rule enables flexbox layout." } },
  image: { imagePrompt: "A diagram explaining flexbox", imageAlt: "Flexbox diagram", imageLayout: "full", imageTitle: "", imageBody: "" },
  gallery: { galleryImages: [{ src: "https://example.test/source.png", alt: "Original source image" }] },
  video: { videoSrc: "https://example.test/source.mp4", videoMimeType: "video/mp4", videoCaptions: "A demonstration." },
  divider: { dividerStyle: "continue", dividerLabel: "Continue", dividerCompletionType: "none" },
  knowledgeCheck: { question: "Which rule enables flexbox?", options: ["display: flex", "display: block"], correctOptionIndex: 0, correctFeedback: "Correct.", incorrectFeedback: "Review the example." },
  survey: { question: "How confident are you?", minLabel: "Not confident", maxLabel: "Very confident" },
  statement: { body: "The main axis controls the flow of flex items.", bullets: [], style: "tip" },
  flipCard: { cards: [{ front: "Flexbox", back: "A layout system", frontImagePrompt: "", frontImageAlt: "", backImagePrompt: "", backImageAlt: "" }] },
  accordion: { steps: [{ title: "Block", body: "Uses block layout." }, { title: "Flex", body: "Uses flex layout." }], layout: "tabs", displayMode: "all" },
  labeledGraphic: { imagePrompt: "A diagram of the main axis", imageAlt: "Main axis diagram", markers: [{ label: "Main axis", description: "The direction of item flow.", x: 50, y: 50, color: "" }], markerColor: "", textColor: "", radarColor: "" },
  processSteps: { steps: [{ title: "Select", body: "Select the container." }, { title: "Apply", body: "Apply display: flex." }] },
  chart: { title: "Sizes", chartType: "bar", chartDescription: "Source size values.", chartColor: "#4f46e5", chartFields: [{ label: "First", value: 16 }] },
} satisfies Record<(typeof generatedBlockTypeValues)[number], object>;

describe("compact Learn block responses", () => {
  it.each(generatedBlockTypeValues)("expands %s into the existing validated editor seed", (type) => {
    const compact = { type, title: "", sourceElementIds: ["p1-e1"], ...examples[type] };
    const expanded = expandLearnBlockResponse({ blocks: [compact] }) as { blocks: unknown[] };
    const parsed = generatedBlockSeedSchema.safeParse(expanded.blocks[0]);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sourceElementIds).toEqual(["p1-e1"]);
  });

  it("requires only fields relevant to each type and keeps all supported block types", () => {
    const properties = Object.fromEntries(Object.keys(generatedBlockSeedSchema.shape).map((key) => [key, { type: "string" }]));
    const schema = createLearnBlockResponseSchema(properties);
    expect(schema.anyOf.map((variant) => (variant.properties.type as { enum: string[] }).enum[0])).toEqual([...generatedBlockTypeValues]);
    for (const variant of schema.anyOf) {
      expect(variant.additionalProperties).toBe(false);
      expect(variant.required).toEqual(Object.keys(variant.properties));
      expect(variant.required.length).toBeLessThan(Object.keys(properties).length / 2);
    }
  });

  it("preserves invalid supplied values so validation can reject them", () => {
    const expanded = expandLearnBlockResponse({ blocks: [{ type: "knowledgeCheck", title: "", question: "Choose", options: [], correctOptionIndex: 7 }] }) as { blocks: unknown[] };
    expect(generatedBlockSeedSchema.safeParse(expanded.blocks[0]).success).toBe(false);
  });
});
