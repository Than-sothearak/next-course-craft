import { z } from "zod";
import { codeLanguageValues, codeTemplateValues } from "@/lib/editor/code-example";
import { generatedBlockSeedSchema, generatedAssessmentQuestionSchema, generatedBlockTypeValues, generatedStatementStyleValues } from "../course-generation-schemas";
import { createLearnBlockResponseSchema } from "../learn-block-response";

const assessmentResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question",
    "options",
    "correctOptionIndex",
    "correctFeedback",
    "incorrectFeedback",
  ],
  properties: {
    question: { type: "string", minLength: 1, maxLength: 1_000 },
    options: { type: "array", minItems: 2, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 500 } },
    correctOptionIndex: { type: "integer", minimum: 0, maximum: 4 },
    correctFeedback: { type: "string", maxLength: 1_000 },
    incorrectFeedback: { type: "string", maxLength: 1_000 },
  },
} as const;

const sourceInventoryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourcePageCount", "summary", "pages"],
  properties: {
    sourcePageCount: { type: "integer", minimum: 1, maximum: 500 },
    summary: { type: "string", maxLength: 5_000 },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageNumber", "elements"],
        properties: {
          pageNumber: { type: "integer", minimum: 1, maximum: 500 },
          elements: {
            type: "array",
            maxItems: 100,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "content", "visualKind", "visibleText", "uncertainContent"],
              properties: {
                kind: { type: "string", enum: ["text", "code", "visual"] },
                content: { type: "string", maxLength: 50_000 },
                visualKind: {
                  type: "string",
                  enum: ["diagram", "chart", "table", "screenshot", "photo", "illustration", "other"],
                },
                visibleText: { type: "string", maxLength: 10_000 },
                uncertainContent: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const sourcePageBatchResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "pages"],
  properties: {
    summary: { type: "string", maxLength: 5_000 },
    pages: sourceInventoryResponseSchema.properties.pages,
  },
} as const;

export const courseResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "sections",
    "lessonOverview",
    "keyTerms",
    "preTest",
    "postTest",
    "lessonSummary",
    "nextLesson",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "lessons"],
        properties: {
          title: { type: "string" },
          lessons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "objective", "blocks"],
              properties: {
                title: { type: "string" },
                objective: { type: "string" },
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "sourceElementIds",
                      "type",
                      "title",
                      "body",
                      "codeExample",
                      "bullets",
                      "style",
                      "question",
                      "options",
                      "correctOptionIndex",
                      "steps",
                      "activityMode",
                      "timelineStyle",
                      "timelineItems",
                      "cards",
                      "imageAlt",
                      "imagePrompt",
                      "headingLevel",
                      "correctFeedback",
                      "incorrectFeedback",
                      "minLabel",
                      "maxLabel",
                      "layout",
                      "displayMode",
                      "imageLayout",
                      "imageTitle",
                      "imageBody",
                      "galleryImages",
                      "videoSrc",
                      "videoMimeType",
                      "videoCaptions",
                      "linkUrl",
                      "linkLabel",
                      "linkDescription",
                      "dividerStyle",
                      "dividerLabel",
                      "dividerCompletionType",
                      "markers",
                      "conceptMapCentralConcept",
                      "conceptMapCentralExplanation",
                      "conceptMapBranches",
                      "markerColor",
                      "textColor",
                      "radarColor",
                      "chartType",
                      "chartDescription",
                      "chartColor",
                      "chartFields",
                      "formulaLatex",
                      "formulaExplanation",
                      "formulaVariables",
                      "tableCaption",
                      "tableColumns",
                      "tableRows",
                      "checklistItems",
                      "databaseDescription",
                      "databaseEntities",
                      "databaseRelationships",
                    ],
                    properties: {
                      sourceElementIds: { type: "array", items: { type: "string" } },
                      type: {
                        type: "string",
                        enum: generatedBlockTypeValues,
                      },
                      title: { type: "string" },
                      body: { type: "string" },
                      codeExample: {
                        type: ["object", "null"],
                        additionalProperties: false,
                        required: ["template", "language", "explanation"],
                        properties: {
                          template: { type: "string", enum: codeTemplateValues },
                          language: { type: "string", enum: codeLanguageValues },
                          explanation: { type: "string" },
                        },
                      },
                      bullets: { type: "array", items: { type: "string" } },
                      style: {
                        type: "string",
                        enum: generatedStatementStyleValues,
                        description: "For AI-generated statements, choose only alert, danger, info, or success. Use info for a neutral takeaway or clarification, alert for a notice, danger only for a clear risk, and success for a confirmed positive result. Do not use key, tip, warning, or centered styles.",
                      },
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correctOptionIndex: { type: "integer" },
                      steps: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["title", "body"],
                          properties: {
                            title: { type: "string" },
                            body: { type: "string" },
                          },
                        },
                      },
                      activityMode: { type: "string", enum: ["guided", "ordering"], description: "For processSteps, use ordering only when learners should reconstruct or practise the stated order; otherwise use guided. Use guided for other block types." },
                      timelineStyle: { type: "string", enum: ["vertical", "horizontal", "stacked"] },
                      timelineItems: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["label", "title", "body"],
                          properties: {
                            label: { type: "string", description: "Optional date or short phase label; leave empty when the source provides none." },
                            title: { type: "string" },
                            body: { type: "string" },
                          },
                        },
                      },
                      cards: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["front", "back", "frontImagePrompt", "frontImageAlt", "backImagePrompt", "backImageAlt"],
                          properties: {
                            front: { type: "string", description: "Nonempty front text unless frontImagePrompt is provided; may also accompany an image as fallback text." },
                            back: { type: "string", description: "Nonempty back text unless backImagePrompt is provided; may also accompany an image as fallback text." },
                            frontImagePrompt: { type: "string" },
                            frontImageAlt: { type: "string" },
                            backImagePrompt: { type: "string" },
                            backImageAlt: { type: "string" },
                          },
                        },
                      },
                      imageAlt: { type: "string" },
                      imagePrompt: { type: "string" },
                      headingLevel: { type: "integer", enum: [1, 2, 3] },
                      correctFeedback: { type: "string" },
                      incorrectFeedback: { type: "string" },
                      minLabel: { type: "string" },
                      maxLabel: { type: "string" },
                      layout: { type: "string", enum: ["accordion", "tabs"] },
                      displayMode: { type: "string", enum: ["all"] },
                      imageLayout: { type: "string", enum: ["full", "banner", "text-left", "text-right", "text-overlay", "card", "cover"] },
                      imageTitle: { type: "string" },
                      imageBody: { type: "string" },
                      galleryImages: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["src", "alt"],
                          properties: { src: { type: "string" }, alt: { type: "string" } },
                        },
                      },
                      videoSrc: { type: "string" },
                      videoMimeType: { type: "string", enum: ["", "video/mp4", "video/webm"] },
                      videoCaptions: { type: "string" },
                      linkUrl: { type: "string" },
                      linkLabel: { type: "string" },
                      linkDescription: { type: "string" },
                      dividerStyle: { type: "string", enum: ["line", "space", "continue"] },
                      dividerLabel: { type: "string" },
                      dividerCompletionType: { type: "string", enum: ["none", "completeAbove"] },
                      markers: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["label", "description", "x", "y", "color"],
                          properties: {
                            label: { type: "string" },
                            description: { type: "string" },
                            x: { type: "number" },
                            y: { type: "number" },
                            color: { type: "string" },
                          },
                        },
                      },
                      conceptMapCentralConcept: { type: "string", description: "Source-supported central concept for a Standard mode conceptMap; empty for other block types." },
                      conceptMapCentralExplanation: { type: "string" },
                      conceptMapBranches: {
                        type: "array",
                        description: "Source-supported concept relationships for a Standard mode conceptMap; empty for other block types.",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["relationship", "concept", "explanation"],
                          properties: {
                            relationship: { type: "string" },
                            concept: { type: "string" },
                            explanation: { type: "string" },
                          },
                        },
                      },
                      markerColor: { type: "string" },
                      textColor: { type: "string" },
                      radarColor: { type: "string" },
                      chartType: { type: "string", enum: ["bar", "column", "line", "donut", "stacked"] },
                      chartDescription: { type: "string" },
                      chartColor: { type: "string" },
                      chartFields: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["label", "value"],
                          properties: { label: { type: "string" }, value: { type: "number" } },
                        },
                      },
                      formulaLatex: { type: "string" },
                      formulaExplanation: { type: "string" },
                      formulaVariables: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["symbol", "explanation"],
                          properties: { symbol: { type: "string" }, explanation: { type: "string" } },
                        },
                      },
                      tableCaption: { type: "string" },
                      tableColumns: { type: "array", items: { type: "string" } },
                      tableRows: { type: "array", items: { type: "array", items: { type: "string" } } },
                      checklistItems: { type: "array", items: { type: "string" } },
                      databaseDescription: { type: "string", description: "A short source-grounded description of this relational model; leave empty when unused." },
                      databaseEntities: {
                        type: "array",
                        description: "Use only for a source-explicit relational model. Leave empty on all other block types.",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["name", "description", "fields"],
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            fields: {
                              type: "array",
                              items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["name", "type", "nullable", "keyType"],
                                properties: {
                                  name: { type: "string" },
                                  type: { type: "string" },
                                  nullable: { type: "boolean", description: "Use true only when the source explicitly marks the field nullable; otherwise false." },
                                  keyType: { type: "string", enum: ["", "primary", "foreign", "unique"], description: "Set a key role only when the source explicitly identifies it." },
                                },
                              },
                            },
                          },
                        },
                      },
                      databaseRelationships: {
                        type: "array",
                        description: "Use only source-stated relationships and cardinality; leave empty when unused.",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["fromEntity", "fromField", "toEntity", "toField", "label", "cardinality"],
                          properties: {
                            fromEntity: { type: "string" },
                            fromField: { type: "string" },
                            toEntity: { type: "string" },
                            toField: { type: "string" },
                            label: { type: "string" },
                            cardinality: { type: "string", enum: ["one-to-one", "one-to-many", "many-to-one", "many-to-many"] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    lessonOverview: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["focus", "slideRange"],
        properties: {
          focus: { type: "string" },
          slideRange: { type: "string" },
        },
      },
    },
    keyTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition"],
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
        },
      },
    },
    preTest: { type: "array", items: assessmentResponseSchema },
    postTest: { type: "array", items: assessmentResponseSchema },
    lessonSummary: { type: "string" },
    nextLesson: { type: "string", maxLength: 160 },
  },
} as const;

const generatedBlockResponseSchema = courseResponseSchema.properties.sections.items
  .properties.lessons.items.properties.blocks.items;

export const sourcePlanningResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "objectives", "sourceLanguage", "targetLanguage", "items"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    description: { type: "string", minLength: 1, maxLength: 5_000 },
    objectives: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", minLength: 1, maxLength: 500 } },
    sourceLanguage: { type: "string", minLength: 1, maxLength: 80 },
    targetLanguage: { type: "string", minLength: 1, maxLength: 80 },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "focus", "startPage", "endPage", "recommendedBlockTypes", "interactionOpportunities"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 160 },
          focus: { type: "string", minLength: 1, maxLength: 1_000 },
          startPage: { type: "integer", minimum: 1, maximum: 500 },
          endPage: { type: "integer", minimum: 1, maximum: 500 },
          recommendedBlockTypes: { type: "array", maxItems: 20, items: { type: "string", enum: generatedBlockTypeValues } },
          interactionOpportunities: { type: "array", maxItems: 20, items: { type: "string", maxLength: 500 } },
        },
      },
    },
  },
} as const;

export const preActivitiesResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["keyTerms", "preTest"],
  properties: {
    keyTerms: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition"],
        properties: { term: { type: "string", minLength: 1, maxLength: 160 }, definition: { type: "string", minLength: 1, maxLength: 1_000 } },
      },
    },
    preTest: { type: "array", minItems: 3, maxItems: 3, items: assessmentResponseSchema },
  },
} as const;

export const postActivitiesResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["postTest", "lessonSummary", "nextLesson"],
  properties: {
    postTest: { type: "array", items: assessmentResponseSchema },
    lessonSummary: { type: "string", minLength: 160, maxLength: 5_000 },
    nextLesson: { type: "string", minLength: 1, maxLength: 160 },
  },
} as const;

export const learnItemResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "objective", "summary", "blocks"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    objective: { type: "string", minLength: 1, maxLength: 1_000 },
    summary: { type: "string", minLength: 1, maxLength: 5_000 },
    blocks: { type: "array", minItems: 1, maxItems: 500, items: generatedBlockResponseSchema },
  },
} as const;

export const compactLearnItemResponseSchema = {
  ...learnItemResponseSchema,
  properties: {
    ...learnItemResponseSchema.properties,
    blocks: {
      ...learnItemResponseSchema.properties.blocks,
      items: createLearnBlockResponseSchema(generatedBlockResponseSchema.properties),
    },
  },
};

export const sourcePlanResultSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5_000),
  objectives: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  sourceLanguage: z.string().trim().min(1).max(80),
  targetLanguage: z.string().trim().min(1).max(80),
  items: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    focus: z.string().trim().min(1).max(1_000),
    startPage: z.number().int().min(1).max(500),
    endPage: z.number().int().min(1).max(500),
    sourceElementIds: z.array(z.string()).default([]),
    recommendedBlockTypes: z.array(z.enum(generatedBlockTypeValues)).max(20),
    interactionOpportunities: z.array(z.string().max(500)).max(20),
  })).min(1).max(20),
});

export const generatedLearnItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(1_000),
  summary: z.string().trim().min(1).max(5_000),
  blocks: z.array(generatedBlockSeedSchema).min(1).max(500),
});

export const generatedPreActivitiesSchema = z.object({
  keyTerms: z.array(z.object({
    term: z.string().trim().min(1).max(160),
    definition: z.string().trim().min(1).max(1_000),
  })).length(5),
  preTest: z.array(generatedAssessmentQuestionSchema).length(3),
});

export const generatedPostActivitiesSchema = z.object({
  postTest: z.array(generatedAssessmentQuestionSchema).min(1).max(20),
  lessonSummary: z.string().trim().min(160).max(5_000),
  nextLesson: z.string().trim().min(1).max(160),
});

export type GeneratedPreActivities = z.infer<typeof generatedPreActivitiesSchema>;

export type GeneratedPostActivities = z.infer<typeof generatedPostActivitiesSchema>;
