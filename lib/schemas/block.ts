import { z } from "zod";
import { colorValueSchema } from "@/lib/color";
import { isSafeLinkHref } from "@/lib/editor/link-utils";
import { slideAudioFrameSchema, slideBackgroundSchema, slideBorderRadiusSchema, slideFrameSchema, slideMediaSchema, slidePlaybackSchema, slideTextLayoutSchema } from "@/lib/editor/slide-design";
import { graphicImageFitSchema } from "@/lib/editor/graphic-layout";
import { slideCropSchema } from "@/lib/editor/slide-crop";
import { interactionButtonPositions, interactionIcons } from "@/lib/editor/interaction-button";
import { slideImageSourceSchema } from "@/lib/editor/slide-design";
import { slideAnimationSchema } from "@/lib/editor/slide-animation";
import { slideBorderSchema, slideShadowSchema } from "@/lib/editor/slide-object-appearance";
import { audioInstructionGuideSchema } from "@/lib/editor/audio-instruction-guide";
import { balloonArcherDataSchema } from "./balloon-archer";
import { peelSettingsSchema } from "./peel-to-reveal";
import { hangingRopeSettingsSchema, ropeCardSettingsSchema } from "./hanging-rope-cards";

export const blockTypes = [
  "heading",
  "richText",
  "image",
  "gallery",
  "video",
  "audio",
  "audioInstruction",
  "interactionButton",
  "balloonArcher",
  "peelToReveal",
  "hangingRopeCards",
  "attachment",
  "link",
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
  slideFrame: slideFrameSchema.optional(),
  slideGroupId: z.string().min(1).max(64).optional(),
  slideLocked: z.boolean().optional(),
  slideHiddenInEditor: z.boolean().optional(),
  slideAnimation: slideAnimationSchema.optional(),
  slideBackground: slideBackgroundSchema.optional(),
  slideBorderRadius: slideBorderRadiusSchema.optional(),
  slideBorder: slideBorderSchema.optional(),
  slideShadow: slideShadowSchema.optional(),
  slideTextLayout: slideTextLayoutSchema.optional(),
  slideMedia: slideMediaSchema.optional(),
  slideMediaOverlay: slideBackgroundSchema.optional(),
  slideCrop: slideCropSchema.optional(),
  requiredForProgress: z.boolean().optional(),
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
  ...blockBase("medium", 40),
  type: z.literal("heading"),
  data: z.object({
    text: z.string().max(500),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    html: z.string().max(100_000).optional(),
  }),
});
export const richTextBlockSchema = z.object({
  ...blockBase("medium", 40),
  type: z.literal("richText"),
  data: z.object({ html: z.string().max(100_000) }),
});
export const imageBlockSchema = z.object({
  ...blockBase("medium", 40),
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
  ...blockBase("medium", 40),
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
  ...blockBase("medium", 40),
  type: z.literal("video"),
  slidePlayback: slidePlaybackSchema.optional(),
  data: z.object({
    src: z.string().url().or(z.string().startsWith("/")),
    mimeType: z.enum(["video/mp4", "video/webm"]).optional(),
    captions: z.string().optional(),
  }),
});
export const audioBlockSchema = z.object({
  ...blockBase("medium", 40),
  type: z.literal("audio"),
  slideFrame: slideAudioFrameSchema.optional(),
  slidePlayback: slidePlaybackSchema.optional(),
  data: z.object({
    src: z.string().regex(/^\/api\/assets\/[a-f\d]{24}\/file$/i).or(z.literal("")),
    fileName: z.string().max(255).default(""),
    mimeType: z.enum(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"]).optional(),
  }),
});
export const audioInstructionBlockSchema = z.object({
  ...blockBase("small", 0),
  type: z.literal("audioInstruction"),
  requiredForProgress: z.boolean().default(true),
  data: audioBlockSchema.shape.data.extend({
    label: z.string().trim().min(1).max(120).default("Audio instructions"),
    autoPlay: z.boolean().default(false),
    showIcon: z.boolean().default(true),
    showText: z.boolean().default(true),
    color: colorValueSchema.default("#f8fafc"),
    textColor: colorValueSchema.default("#334155"),
    guide: audioInstructionGuideSchema.optional(),
  }),
});
export const attachmentBlockSchema = z.object({
  ...blockBase("small", 40),
  type: z.literal("attachment"),
  data: z.object({
    src: z.string().regex(/^\/api\/assets\/[a-f\d]{24}\/file$/i).or(z.literal("")),
    fileName: z.string().max(255).default(""),
    size: z.number().int().min(0).max(250 * 1024 * 1024).default(0),
  }),
});

const interactionButtonBaseSchema = z.object({
  ...blockBase("small", 0),
  type: z.literal("interactionButton"),
  data: z.object({
    label: z.string().trim().min(1).max(120).default("Open details"),
    trigger: z.enum(["icon", "image"]).default("icon"),
    icon: z.enum(interactionIcons).default("info"),
    imageSrc: slideImageSourceSchema.default(""),
    imageAlt: z.string().max(500).default(""),
    showLabel: z.boolean().default(false),
    color: colorValueSchema.default("#4f46e5"),
    iconColor: colorValueSchema.default("#ffffff"),
    radarColor: colorValueSchema.default("#8b5cf6"),
    radarEnabled: z.boolean().default(true),
    radarSize: z.number().int().min(0).max(24).default(2),
    radarWeight: z.number().int().min(1).max(8).default(2),
    radius: z.number().min(0).max(64).default(10),
    iconSize: z.number().min(16).max(96).default(18),
    buttonSize: z.number().min(20).max(256).default(20),
    position: z.enum(interactionButtonPositions).default("middle-center"),
    action: z.enum(["popup", "block"]).default("popup"),
    targetBlockId: z.string().max(64).default(""),
    popup: z.object({
      title: z.string().trim().min(1).max(160).default("Learn more"),
      width: z.number().int().min(480).max(1280).default(800),
      height: z.number().int().min(270).max(960).default(450),
      backgroundColor: colorValueSchema.default("#ffffff"),
      textColor: colorValueSchema.default("#172033"),
      animation: z.enum(["fade", "zoom", "slide", "none"]).default("zoom"),
    }).default(() => ({ title: "Learn more", width: 800, height: 450, backgroundColor: "#ffffff", textColor: "#172033", animation: "zoom" as const })),
  }),
});
export const linkBlockSchema = z.object({
  ...blockBase("small", 40),
  type: z.literal("link"),
  data: z.object({
    label: z.string().max(200).default("Open resource"),
    url: z.string().trim().min(1).max(2_048).refine(isSafeLinkHref, "Enter a safe http, https, mailto, tel, or relative URL."),
    description: z.string().max(1_000).default(""),
    style: z.enum(["button", "card", "text"]).default("button"),
    openInNewTab: z.boolean().default(true),
  }),
});
export const dividerCompletionTypeSchema = z.enum(["none", "completeAbove"]);
export type DividerCompletionType = z.infer<typeof dividerCompletionTypeSchema>;
export const dividerBlockSchema = z.object({
  ...blockBase("small", 40),
  type: z.literal("divider"),
  data: z.object({
    style: z.enum(["line", "space", "continue"]),
    label: z.string().max(100).default("Continue"),
    completionType: dividerCompletionTypeSchema.default("none"),
    lineWeight: z.number().int().min(1).max(16).optional(),
    lineColor: colorValueSchema.optional(),
    lineStyle: z.enum(["solid", "dashed", "dotted", "double"]).optional(),
  }),
});
export const knowledgeCheckBlockSchema = z.object({
  ...blockBase("small", 40),
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
  ...blockBase("small", 40),
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
  backgroundColor: colorValueSchema.optional(),
  textColor: colorValueSchema.optional(),
});
export const flipCardPresentationLayoutSchema = z.object({
  mode: z.enum(["auto", "custom"]).default("auto"),
  padding: z.number().int().min(0).max(80).default(12),
  cardPadding: z.number().int().min(0).max(80).default(16),
  columnGap: z.number().int().min(0).max(80).default(12),
  rowGap: z.number().int().min(0).max(80).default(12),
  borderRadius: z.number().int().min(0).max(80).default(16),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
});
const flipCardCollectionDataSchema = z
  .object({
    cards: z.array(flipCardItemSchema).min(1).max(30),
    cardsPerRow: z.number().int().min(1).max(5).default(3),
    cardStyle: z.enum(["classic", "soft", "outlined", "elevated"]).default("classic"),
    cardBackgroundColor: colorValueSchema.default("#ffffff"),
    cardTextColor: colorValueSchema.default("#0f172a"),
    presentationLayout: flipCardPresentationLayoutSchema.optional(),
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
  cardsPerRow: z.number().int().min(1).max(5).default(3),
  cardStyle: z.enum(["classic", "soft", "outlined", "elevated"]).default("classic"),
  cardBackgroundColor: colorValueSchema.default("#ffffff"),
  cardTextColor: colorValueSchema.default("#0f172a"),
});
export const flipCardBlockSchema = z.object({
  ...blockBase("full", 40),
  type: z.literal("flipCard"),
  data: z
    .union([flipCardCollectionDataSchema, legacyFlipCardDataSchema])
    .transform((data) => {
      if ("cards" in data) return data;
      return {
        cardsPerRow: data.cardsPerRow,
        cardStyle: data.cardStyle,
        cardBackgroundColor: data.cardBackgroundColor,
        cardTextColor: data.cardTextColor,
        presentationLayout: undefined,
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
  ...blockBase("medium", 40),
  type: z.literal("accordion"),
  data: z.object({
    layout: z.enum(["accordion", "tabs"]).default("accordion"),
    displayMode: z.enum(["all", "oneByOne"]).default("all"),
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
export const lessonMapTemplateSchema = z.enum([
  "modernCity",
  "farmFields",
  "cityProvince",
  "learningRoad",
]);
export const labeledGraphicBlockSchema = z.object({
  ...blockBase("full", 40),
  type: z.literal("labeledGraphic"),
  data: z.object({
    src: z.string().url().or(z.string().startsWith("/")).or(z.literal("")),
    alt: z.string().max(500),
    mapTemplate: lessonMapTemplateSchema.optional(),
    objectFit: graphicImageFitSchema.optional(),
    markerColor: colorValueSchema.optional(),
    textColor: colorValueSchema.optional(),
    radarColor: colorValueSchema.optional(),
    radarSize: z.number().int().min(0).max(24).optional(),
    radarWeight: z.number().int().min(1).max(8).optional(),
    interactionMode: z.enum(["explore", "spotTarget"]).optional(),
    sceneTheme: z.enum(["data", "security", "network", "agriculture"]).optional(),
    challengePrompt: z.string().max(300).optional(),
    successMessage: z.string().max(500).optional(),
    markers: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          label: z.string().max(100),
          description: z.string().max(2_000),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          color: colorValueSchema.optional(),
          radarEnabled: z.boolean().optional(),
          displayMode: z.enum(["auto", "number", "text"]).optional(),
          displayNumber: z.number().int().min(0).max(999).optional(),
          displayText: z.string().max(12).optional(),
          isTarget: z.boolean().optional(),
          missFeedback: z.string().max(500).optional(),
        }),
      )
      .min(1)
      .max(20),
  }).superRefine((data, context) => {
    if (data.interactionMode === "spotTarget") {
      if (!data.sceneTheme)
        context.addIssue({ code: "custom", path: ["sceneTheme"], message: "Choose a graphic scene for the mini-game." });
      if (!data.challengePrompt?.trim())
        context.addIssue({ code: "custom", path: ["challengePrompt"], message: "Mini-games need a challenge prompt." });
      if (!data.successMessage?.trim())
        context.addIssue({ code: "custom", path: ["successMessage"], message: "Mini-games need a success message." });
      if (data.markers.filter((marker) => marker.isTarget).length !== 1)
        context.addIssue({ code: "custom", path: ["markers"], message: "Choose exactly one correct hotspot." });
    } else if (!data.src && !data.sceneTheme && !data.mapTemplate) {
      context.addIssue({ code: "custom", path: ["src"], message: "Explore graphics need an image." });
    }
  }),
});
export const processStepsStyleSchema = z.enum(["cards", "numbered", "timeline", "spotlight", "minimal"]);
export type ProcessStepsStyle = z.infer<typeof processStepsStyleSchema>;
export const processStepsBlockSchema = z.object({
  ...blockBase("medium", 40),
  type: z.literal("processSteps"),
  data: z.object({
    style: processStepsStyleSchema.optional(),
    accentColor: colorValueSchema.optional(),
    showNumbers: z.boolean().optional(),
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
export const lessonMapCheckpointIconSchema = z.enum([
  "flag",
  "book",
  "star",
  "leaf",
  "pin",
  "sparkles",
]);
export const lessonMapBlockSchema = z.object({
  ...blockBase("full", 40),
  type: z.literal("lessonMap"),
  data: z.object({
    template: lessonMapTemplateSchema.default("modernCity"),
    checkpoints: z.array(z.object({
      id: z.string().min(1).max(64),
      title: z.string().max(160),
      description: z.string().max(1_000),
      color: colorValueSchema.default("#e27d55"),
      icon: lessonMapCheckpointIconSchema.default("flag"),
      targetType: z.enum(["lesson", "section"]).default("lesson"),
      targetId: z.string().max(64).default(""),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    })).max(30),
  }),
});
export type LessonMapTemplate = z.infer<typeof lessonMapTemplateSchema>;
export type LessonMapCheckpointIcon = z.infer<typeof lessonMapCheckpointIconSchema>;

export const chartBlockSchema = z.object({
  ...blockBase("medium", 40),
  type: z.literal("chart"),
  data: z.object({
    chartType: chartTypeSchema,
    title: z.string().max(500),
    description: z.string().max(2_000).default(""),
    color: colorValueSchema.default("#4f46e5"),
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
  ...blockBase("small", 40),
  type: z.literal("statement"),
  data: z.object({
    style: statementStyleSchema,
    title: z.string().max(500),
    body: z.string().max(5_000),
    titleHtml: z.string().max(100_000).optional(),
    bodyHtml: z.string().max(100_000).optional(),
  }),
});

export const balloonArcherBlockSchema = z.object({
  ...blockBase("full", 40),
  type: z.literal("balloonArcher"),
  data: balloonArcherDataSchema,
});

/** One level of ordinary learning content; interactions cannot recursively nest here. */
export const revealContentBlockSchema = z.discriminatedUnion("type", [richTextBlockSchema, headingBlockSchema, statementBlockSchema, imageBlockSchema, galleryBlockSchema, videoBlockSchema, audioBlockSchema, linkBlockSchema]);
export type RevealContentBlock = z.infer<typeof revealContentBlockSchema>;
export const peelToRevealBlockSchema = z.object({
  ...blockBase("medium", 40),
  type: z.literal("peelToReveal"),
  data: peelSettingsSchema.extend({
    blocks: z.array(revealContentBlockSchema).min(1).max(12).default(() => [richTextBlockSchema.parse({ id: "reveal-text", version: 1, type: "richText", data: { html: "<h2>Something worth discovering</h2><p>Add your <strong>learning moment</strong> here. Replace this text or add images, video, and audio.</p>" }, blockPadding: 16 })]).refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Reveal content must have unique IDs."),
  }),
});

export const hangingRopeCardSchema = ropeCardSettingsSchema.extend({
  blocks: z.array(revealContentBlockSchema).min(1).max(12).default(() => [richTextBlockSchema.parse({ id: "discovery", version: 1, type: "richText", blockPadding: 12, data: { html: "<h2>Follow your curiosity</h2><p>Replace this with your <strong>learning content</strong>, or add images, video, and audio.</p>" } })]).refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Reveal content must have unique IDs."),
});
export const hangingRopeCardsBlockSchema = z.object({
  ...blockBase("full", 40),
  type: z.literal("hangingRopeCards"),
  data: hangingRopeSettingsSchema.extend({
    cards: z.array(hangingRopeCardSchema).min(1).max(6).default(() => ["Explore", "Connect", "Remember"].map((title, index) => hangingRopeCardSchema.parse({ id: `rope-${index + 1}`, title }))).refine((cards) => new Set(cards.map((card) => card.id)).size === cards.length, "Hanging cards must have unique IDs."),
  }),
});
export type HangingRopeCard = z.infer<typeof hangingRopeCardSchema>;

const plainContentBlockSchema = z.discriminatedUnion("type", [
  hangingRopeCardsBlockSchema,
  peelToRevealBlockSchema,
  headingBlockSchema,
  richTextBlockSchema,
  imageBlockSchema,
  galleryBlockSchema,
  videoBlockSchema,
  audioBlockSchema,
  audioInstructionBlockSchema,
  attachmentBlockSchema,
  linkBlockSchema,
  dividerBlockSchema,
  knowledgeCheckBlockSchema,
  surveyBlockSchema,
  statementBlockSchema,
  flipCardBlockSchema,
  accordionBlockSchema,
  labeledGraphicBlockSchema,
  processStepsBlockSchema,
  lessonMapBlockSchema,
  chartBlockSchema,
  balloonArcherBlockSchema,
]);
type InteractionButtonBase = z.infer<typeof interactionButtonBaseSchema>;
export type InteractionButtonBlock = Omit<InteractionButtonBase, "data"> & {
  data: Omit<InteractionButtonBase["data"], "popup"> & {
    popup: InteractionButtonBase["data"]["popup"] & { blocks: ContentBlock[] };
  };
};
export type ContentBlock = z.infer<typeof plainContentBlockSchema> | InteractionButtonBlock;
export type PopupContentBlock = ContentBlock;
export const popupContentBlockSchema: z.ZodType<PopupContentBlock> = z.lazy(() => blockSchema);
function popupDepthValid(value: unknown): boolean {
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const current = pending.pop()!;
    if (!current.value || typeof current.value !== "object" || !("type" in current.value) || current.value.type !== "interactionButton") continue;
    if (current.depth >= 8) return false;
    const data = (current.value as Record<string, unknown>).data;
    const popup = data && typeof data === "object" && "popup" in data ? data.popup : null;
    const blocks = popup && typeof popup === "object" && "blocks" in popup ? popup.blocks : null;
    if (Array.isArray(blocks)) for (const child of blocks) pending.push({ value: child, depth: current.depth + 1 });
  }
  return true;
}
const popupSettingsSchema = interactionButtonBaseSchema.shape.data.shape.popup.unwrap();
export const interactionButtonBlockSchema = interactionButtonBaseSchema.extend({
  data: interactionButtonBaseSchema.shape.data.extend({
    popup: popupSettingsSchema.extend({
      blocks: z.array(popupContentBlockSchema).max(20).default([]).refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Popup objects must have unique IDs."),
    }).default(() => ({ ...popupSettingsSchema.parse({}), blocks: [] })),
  }),
}).superRefine((block, context) => {
  if (!popupDepthValid(block)) context.addIssue({ code: "custom", message: "Popup mini slides can nest up to eight levels." });
});
const contentBlockSchema = z.discriminatedUnion("type", [...plainContentBlockSchema.options, interactionButtonBlockSchema]);
export const blockSchema: z.ZodType<ContentBlock> = z.preprocess((value, context) => {
  if (!popupDepthValid(value)) {
    context.addIssue({ code: "custom", message: "Popup mini slides can nest up to eight levels." });
    return z.NEVER;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "divider" || !candidate.data || typeof candidate.data !== "object")
    return value;
  const data = candidate.data as Record<string, unknown>;
  if (data.style === "continue") {
    return { ...candidate, blockPadding: candidate.blockPadding ?? 100 };
  }
  if (data.style !== "line") return value;
  return {
    ...candidate,
    width: candidate.width ?? "full",
    blockPadding: candidate.blockPadding ?? 60,
    data: {
      ...data,
      lineWeight: data.lineWeight ?? 1,
      lineColor: data.lineColor ?? "#cbd5e1",
      lineStyle: data.lineStyle ?? "solid",
    },
  };
}, contentBlockSchema);

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
  if (type === "heading" || type === "richText" || type === "peelToReveal") return "medium";
  if (type === "image" || type === "video" || type === "audio" || type === "gallery") return "medium";
  if (type === "flipCard" || type === "labeledGraphic" || type === "lessonMap" || type === "balloonArcher" || type === "hangingRopeCards") return "full";
  if (type === "accordion" || type === "processSteps" || type === "chart") return "medium";
  return "small";
}

export function defaultBlockWidthForBlock(block: ContentBlock): ContentBlock["width"] {
  if (block.type === "divider" && block.data.style === "line") return "full";
  return defaultBlockWidth(block.type);
}

export function defaultBlockPadding(_type: ContentBlock["type"]): number {
  if (_type === "interactionButton" || _type === "audioInstruction") return 0;
  void _type;
  return 40;
}

export function defaultBlockPaddingForBlock(block: ContentBlock): number {
  if (block.type === "divider" && block.data.style === "line") return 60;
  if (block.type === "divider" && block.data.style === "continue") return 100;
  return defaultBlockPadding(block.type);
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

export function normalizeBlockPaddingForBlock(
  value: unknown,
  block: ContentBlock,
): number {
  const validNumber =
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 200;
  const validLegacy = typeof value === "string" && value in legacyPaddingPixels;
  if (validNumber || validLegacy) return normalizeBlockPadding(value, block.type);
  return defaultBlockPaddingForBlock(block);
}

export const lessonContentSchema = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(blockSchema).max(500),
});
