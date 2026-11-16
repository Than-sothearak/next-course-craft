import { generatedBlockTypeValues } from "./course-generation-schemas";

type BlockType = (typeof generatedBlockTypeValues)[number];

// Keep the editor seed unchanged. Only the provider's wire format is smaller.
const fieldsByType = {
  heading: ["body", "headingLevel"],
  richText: ["body", "bullets"],
  text: ["body", "bullets"],
  formula: ["formulaLatex", "formulaExplanation", "formulaVariables"],
  table: ["tableCaption", "tableColumns", "tableRows"],
  checklist: ["checklistItems"],
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
  conceptMap: ["conceptMapCentralConcept", "conceptMapCentralExplanation", "conceptMapBranches"],
  processSteps: ["steps", "activityMode"],
  timeline: ["timelineStyle", "timelineItems"],
  databaseSchema: ["databaseDescription", "databaseEntities", "databaseRelationships"],
  chart: ["chartType", "chartDescription", "chartColor", "chartFields"],
} as const satisfies Record<BlockType, readonly string[]>;

const nullBlockFieldDefaults: Record<string, unknown> = {
  title: "",
  body: "",
  bullets: [],
  style: "tip",
  headingLevel: 3,
  question: "",
  options: [],
  correctOptionIndex: 0,
  correctFeedback: "",
  incorrectFeedback: "",
  minLabel: "",
  maxLabel: "",
  steps: [],
  timelineStyle: "vertical",
  timelineItems: [],
  cards: [],
  layout: "accordion",
  displayMode: "all",
  imageAlt: "",
  imagePrompt: "",
  imageLayout: "full",
  imageTitle: "",
  imageBody: "",
  galleryImages: [],
  videoSrc: "",
  videoMimeType: "",
  videoCaptions: "",
  linkUrl: "",
  linkLabel: "",
  linkDescription: "",
  dividerStyle: "continue",
  dividerLabel: "Continue",
  dividerCompletionType: "none",
  markers: [],
  markerColor: "",
  textColor: "",
  radarColor: "",
  chartType: "bar",
  chartDescription: "",
  chartColor: "#4f46e5",
  chartFields: [],
  front: "",
  back: "",
  frontImagePrompt: "",
  frontImageAlt: "",
  backImagePrompt: "",
  backImageAlt: "",
  label: "",
  description: "",
  color: "",
  src: "",
  alt: "",
  explanation: "",
  formulaLatex: "",
  formulaExplanation: "",
  formulaVariables: [],
  tableCaption: "",
  tableColumns: [],
  tableRows: [],
  checklistItems: [],
  activityMode: "guided",
  conceptMapCentralConcept: "",
  conceptMapCentralExplanation: "",
  conceptMapBranches: [],
  databaseDescription: "",
  databaseEntities: [],
  databaseRelationships: [],
  nullable: false,
  keyType: "",
};

function normalizeNullBlockFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeNullBlockFields);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    entry === null && Object.hasOwn(nullBlockFieldDefaults, key)
      ? Array.isArray(nullBlockFieldDefaults[key]) ? [] : nullBlockFieldDefaults[key]
      : normalizeNullBlockFields(entry),
  ]));
}

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
      return normalizeNullBlockFields({
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
      });
    }),
  };
}

export function expandCourseBlockResponse(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const course = value as Record<string, unknown>;
  if (!Array.isArray(course.sections)) return value;
  return {
    ...course,
    sections: course.sections.map((section: unknown) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) return section;
      const entry = section as Record<string, unknown>;
      return Array.isArray(entry.lessons)
        ? { ...entry, lessons: entry.lessons.map(expandLearnBlockResponse) }
        : section;
    }),
  };
}
