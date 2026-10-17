import { generatedBlockTypeValues } from "./course-generation-schemas";

type BlockType = (typeof generatedBlockTypeValues)[number];

// Keep the editor seed unchanged. Only the provider's wire format is smaller.
const fieldsByType = {
  heading: ["body", "headingLevel"],
  richText: ["body", "bullets"],
  text: ["body", "bullets"],
  code: ["body", "codeExample"],
  image: ["imagePrompt", "imageAlt", "imageLayout", "imageTitle", "imageBody"],
  gallery: ["galleryImages"],
  video: ["videoSrc", "videoMimeType", "videoCaptions"],
  link: ["linkUrl", "linkLabel", "linkDescription"],
  divider: ["dividerStyle", "dividerLabel", "dividerCompletionType"],
  knowledgeCheck: ["question", "options", "correctOptionIndex", "correctFeedback", "incorrectFeedback"],
  survey: ["question", "minLabel", "maxLabel"],
  statement: ["body", "bullets", "style"],
  flipCard: ["cards"],
  accordion: ["steps", "layout", "displayMode"],
  labeledGraphic: ["imagePrompt", "imageAlt", "markers", "markerColor", "textColor", "radarColor"],
  processSteps: ["steps"],
  chart: ["chartType", "chartDescription", "chartColor", "chartFields"],
} as const satisfies Record<BlockType, readonly string[]>;

export function createLearnBlockResponseSchema(properties: Record<string, object>) {
  return {
    anyOf: generatedBlockTypeValues.map((type) => {
      const fields = ["sourceElementIds", "type", "title", ...fieldsByType[type]];
      return {
        type: "object",
        additionalProperties: false,
        required: fields,
        properties: Object.fromEntries(fields.map((field) => [
          field,
          field === "type" ? { type: "string", enum: [type] } : properties[field],
        ])),
      };
    }),
  };
}

export function expandLearnBlockResponse(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.blocks)) return value;
  return {
    ...result,
    blocks: result.blocks.map((block: unknown) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) return block;
      return {
        title: "",
        body: "",
        bullets: [],
        style: "tip",
        question: "",
        options: [],
        correctOptionIndex: 0,
        steps: [],
        imageAlt: "",
        imagePrompt: "",
        ...block,
      };
    }),
  };
}
