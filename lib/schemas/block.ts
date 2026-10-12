import { z } from "zod";

export const blockTypes = ["heading", "richText", "image", "gallery", "video", "divider", "knowledgeCheck", "survey", "statement"] as const;
export const statementStyleSchema = z.enum(["key", "tip", "warning", "centered"]);
export type StatementStyle = z.infer<typeof statementStyleSchema>;
const spacing = z.enum(["none", "small", "medium", "large"]);
const base = {
  id: z.string().min(1),
  version: z.literal(1),
  width: z.enum(["full", "medium", "small"]).default("small"),
  widthCustom: z.boolean().default(false),
  backgroundColor: z.string().regex(/^#[\da-fA-F]{6}$/).default("#ffffff"),
  blockPadding: spacing.default("medium"),
  headingPadding: spacing.optional(),
};

export const headingBlockSchema = z.object({ ...base, type: z.literal("heading"), data: z.object({ text: z.string().max(500), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), html: z.string().max(100_000).optional() }) });
export const richTextBlockSchema = z.object({ ...base, type: z.literal("richText"), data: z.object({ html: z.string().max(100_000) }) });
export const imageBlockSchema = z.object({ ...base, type: z.literal("image"), data: z.object({ src: z.string().url().or(z.string().startsWith("/")), alt: z.string().max(500), caption: z.string().max(1_000).optional() }) });
export const galleryBlockSchema = z.object({ ...base, type: z.literal("gallery"), data: z.object({ images: z.array(z.object({ src: z.string().url().or(z.string().startsWith("/")), alt: z.string().max(500) })).min(1).max(8) }) });
export const videoBlockSchema = z.object({ ...base, type: z.literal("video"), data: z.object({ src: z.string().url().or(z.string().startsWith("/")), captions: z.string().optional() }) });
export const dividerBlockSchema = z.object({ ...base, type: z.literal("divider"), data: z.object({ style: z.enum(["line", "space"]) }) });
export const knowledgeCheckBlockSchema = z.object({ ...base, type: z.literal("knowledgeCheck"), data: z.object({ question: z.string().max(1_000), options: z.array(z.string().max(500)).min(2).max(8) }) });
export const surveyBlockSchema = z.object({ ...base, type: z.literal("survey"), data: z.object({ question: z.string().max(1_000), minLabel: z.string().max(100), maxLabel: z.string().max(100) }) });
export const statementBlockSchema = z.object({ ...base, type: z.literal("statement"), data: z.object({ style: statementStyleSchema, title: z.string().max(500), body: z.string().max(5_000), titleHtml: z.string().max(100_000).optional(), bodyHtml: z.string().max(100_000).optional() }) });

export const blockSchema = z.discriminatedUnion("type", [headingBlockSchema, richTextBlockSchema, imageBlockSchema, galleryBlockSchema, videoBlockSchema, dividerBlockSchema, knowledgeCheckBlockSchema, surveyBlockSchema, statementBlockSchema]);
export type ContentBlock = z.infer<typeof blockSchema>;

export const lessonContentSchema = z.object({ schemaVersion: z.literal(1), blocks: z.array(blockSchema).max(500) });
