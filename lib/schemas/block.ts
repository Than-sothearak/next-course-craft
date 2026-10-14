import { z } from "zod";

export const blockTypes = [
  "heading",
  "richText",
  "image",
  "gallery",
  "video",
  "divider",
  "knowledgeCheck",
  "survey",
  "statement",
  "flipCard",
  "accordion",
  "labeledGraphic",
  "processSteps",
  "chart",
] as const;
export const statementStyleSchema = z.enum([
  "key",
  "tip",
  "warning",
  "centered",
]);
export type StatementStyle = z.infer<typeof statementStyleSchema>;
export const imageLayoutSchema = z.enum([
  "full",
  "banner",
  "text-left",
  "text-right",
  "text-overlay",
  "card",
]);
export type ImageLayout = z.infer<typeof imageLayoutSchema>;
const spacing = z.enum(["none", "small", "medium", "large"]);
const legacyPaddingPixels = {
  none: 0,
  small: 8,
  medium: 20,
  large: 32,
} as const;
const blockPaddingSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value in legacyPaddingPixels
      ? legacyPaddingPixels[value as keyof typeof legacyPaddingPixels]
      : value,
  z.number().int().min(0).max(200),
);
const base = {
  id: z.string().min(1),
  version: z.literal(1),
  widthCustom: z.boolean().default(false),
  backgroundColor: z
    .string()
    .regex(/^#[\da-fA-F]{6}$/)
    .default("#ffffff"),
  headingPadding: spacing.optional(),
};
const blockBase = (
  defaultWidth: "full" | "medium" | "small",
  defaultPadding: number,
) => ({
  ...base,
  width: z.enum(["full", "medium", "small"]).default(defaultWidth),
  blockPadding: blockPaddingSchema.default(defaultPadding),
});

export const headingBlockSchema = z.object({
  ...blockBase("medium", 20),
  type: z.literal("heading"),
  data: z.object({
    text: z.string().max(500),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    html: z.string().max(100_000).optional(),
  }),
});
export const richTextBlockSchema = z.object({
  ...blockBase("medium", 20),
  type: z.literal("richText"),
  data: z.object({ html: z.string().max(100_000) }),
});
export const imageBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("image"),
  data: z.object({
    src: z.string().url().or(z.string().startsWith("/")),
    alt: z.string().max(500),
    caption: z.string().max(1_000).optional(),
    layout: imageLayoutSchema.optional(),
    title: z.string().max(500).optional(),
    body: z.string().max(5_000).optional(),
  }),
});
export const galleryBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("gallery"),
  data: z.object({
    images: z
      .array(
        z.object({
          src: z.string().url().or(z.string().startsWith("/")),
          alt: z.string().max(500),
        }),
      )
      .min(1)
      .max(8),
  }),
});
export const videoBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("video"),
  data: z.object({
    src: z.string().url().or(z.string().startsWith("/")),
    mimeType: z.enum(["video/mp4", "video/webm"]).optional(),
    captions: z.string().optional(),
  }),
});
export const dividerCompletionTypeSchema = z.enum(["none", "completeAbove"]);
export type DividerCompletionType = z.infer<typeof dividerCompletionTypeSchema>;
export const dividerBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("divider"),
  data: z.object({
    style: z.enum(["line", "space", "continue"]),
    label: z.string().max(100).default("Continue"),
    completionType: dividerCompletionTypeSchema.default("none"),
  }),
});
export const knowledgeCheckBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("knowledgeCheck"),
  data: z
    .object({
      question: z.string().max(1_000),
      options: z.array(z.string().max(500)).min(2).max(8),
      correctOptionIndex: z.number().int().min(0).max(7).default(0),
      correctFeedback: z.string().max(1_000).default("Correct!"),
      incorrectFeedback: z.string().max(1_000).default("Not quite. Try again."),
    })
    .superRefine((data, context) => {
      if (data.correctOptionIndex >= data.options.length) {
        context.addIssue({
          code: "custom",
          path: ["correctOptionIndex"],
          message: "Choose one of the available answers as correct.",
        });
      }
    }),
});
export const surveyBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("survey"),
  data: z.object({
    question: z.string().max(1_000),
    minLabel: z.string().max(100),
    maxLabel: z.string().max(100),
  }),
});
export const flipCardFaceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(2_000) }),
  z.object({
    type: z.literal("image"),
    src: z.string().url().or(z.string().startsWith("/")),
    alt: z.string().max(500),
  }),
]);
export const flipCardItemSchema = z.object({
  id: z.string().min(1).max(64),
  frontLabel: z.string().max(80),
  front: flipCardFaceSchema,
  backLabel: z.string().max(80),
  back: flipCardFaceSchema,
});
const flipCardCollectionDataSchema = z
  .object({
    cards: z.array(flipCardItemSchema).min(1).max(30),
  })
  .superRefine((data, context) => {
    const ids = new Set<string>();
    data.cards.forEach((card, index) => {
      if (ids.has(card.id)) {
        context.addIssue({
          code: "custom",
          path: ["cards", index, "id"],
          message: "Flip card identifiers must be unique.",
        });
      }
      ids.add(card.id);
    });
  });
const legacyFlipCardDataSchema = z.object({
  frontLabel: z.string().max(80),
  front: z.string().max(1_000),
  backLabel: z.string().max(80),
  back: z.string().max(2_000),
});
export const flipCardBlockSchema = z.object({
  ...blockBase("full", 20),
  type: z.literal("flipCard"),
  data: z
    .union([flipCardCollectionDataSchema, legacyFlipCardDataSchema])
    .transform((data) => {
      if ("cards" in data) return data;
      return {
        cards: [
          {
            id: "card-1",
            frontLabel: data.frontLabel,
            front: { type: "text" as const, text: data.front },
            backLabel: data.backLabel,
            back: { type: "text" as const, text: data.back },
          },
        ],
      };
    }),
});
export const accordionBlockSchema = z.object({
  ...blockBase("medium", 20),
  type: z.literal("accordion"),
  data: z.object({
    layout: z.enum(["accordion", "tabs"]).default("accordion"),
    items: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          title: z.string().max(160),
          body: z.string().max(5_000),
        }),
      )
      .min(2)
      .max(12),
  }),
});
export const labeledGraphicBlockSchema = z.object({
  ...blockBase("full", 20),
  type: z.literal("labeledGraphic"),
  data: z.object({
    src: z.string().url().or(z.string().startsWith("/")),
    alt: z.string().max(500),
    markerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    radarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    markers: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          label: z.string().max(100),
          description: z.string().max(2_000),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
});
export const processStepsBlockSchema = z.object({
  ...blockBase("medium", 20),
  type: z.literal("processSteps"),
  data: z.object({
    steps: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          title: z.string().max(160),
          body: z.string().max(5_000),
        }),
      )
      .min(2)
      .max(20),
  }),
});
export const chartTypeSchema = z.enum([
  "bar",
  "column",
  "line",
  "donut",
  "stacked",
]);
export const chartBlockSchema = z.object({
  ...blockBase("medium", 20),
  type: z.literal("chart"),
  data: z.object({
    chartType: chartTypeSchema,
    title: z.string().max(500),
    description: z.string().max(2_000).default(""),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4f46e5"),
    fields: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          label: z.string().max(120),
          value: z.number().finite().min(0).max(1_000_000_000_000),
        }),
      )
      .min(1)
      .max(20),
  }),
});
export const statementBlockSchema = z.object({
  ...blockBase("small", 20),
  type: z.literal("statement"),
  data: z.object({
    style: statementStyleSchema,
    title: z.string().max(500),
    body: z.string().max(5_000),
    titleHtml: z.string().max(100_000).optional(),
    bodyHtml: z.string().max(100_000).optional(),
  }),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  richTextBlockSchema,
  imageBlockSchema,
  galleryBlockSchema,
  videoBlockSchema,
  dividerBlockSchema,
  knowledgeCheckBlockSchema,
  surveyBlockSchema,
  statementBlockSchema,
  flipCardBlockSchema,
  accordionBlockSchema,
  labeledGraphicBlockSchema,
  processStepsBlockSchema,
  chartBlockSchema,
]);
export type ContentBlock = z.infer<typeof blockSchema>;

/** Normalize persisted flip cards written before cards were stored as a collection. */
export function normalizeStoredFlipCardBlock(
  block: ContentBlock,
): ContentBlock {
  if (block.type !== "flipCard") return block;
  return flipCardBlockSchema.parse(block);
}

export function defaultBlockWidth(
  type: ContentBlock["type"],
): ContentBlock["width"] {
  if (type === "heading" || type === "richText") return "medium";
  if (type === "flipCard" || type === "labeledGraphic") return "full";
  if (type === "accordion" || type === "processSteps" || type === "chart") return "medium";
  return "small";
}

export function defaultBlockPadding(_type: ContentBlock["type"]): number {
  void _type;
  return 20;
}

export function normalizeBlockPadding(
  value: unknown,
  type: ContentBlock["type"],
): number {
  if (typeof value === "string" && value in legacyPaddingPixels) {
    return legacyPaddingPixels[value as keyof typeof legacyPaddingPixels];
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 200
  )
    return value;
  return defaultBlockPadding(type);
}

export const lessonContentSchema = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(blockSchema).max(500),
});
