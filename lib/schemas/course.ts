import { z } from "zod";

export const courseStatusSchema = z.enum(["draft", "published", "archived"]);
export const courseInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5_000).default(""),
  language: z.string().min(2).max(16).default("en"),
  status: courseStatusSchema.default("draft"),
});

export type CourseInput = z.infer<typeof courseInputSchema>;
