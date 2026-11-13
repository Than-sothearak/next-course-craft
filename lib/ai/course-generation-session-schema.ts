import { z } from "zod";
import type { CourseCover } from "@/lib/editor/course-cover";
import { courseGenerationInputSchema } from "./course-generation-schemas";

export const outlineLessonSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(1_000),
  kind: z.enum(["learn", "description", "overview", "keywords", "preTest", "postTest", "summary", "next"]),
  sourceIndex: z.number().int().min(0).max(19).optional(),
});
export const courseOutlineSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5_000),
  sections: z.array(z.object({
    id: z.string().min(1).max(64),
    title: z.string().trim().min(1).max(160),
    lessons: z.array(outlineLessonSchema).min(1).max(27),
  })).min(1).max(10),
}).superRefine((outline, ctx) => {
  const lessons = outline.sections.flatMap((section) => section.lessons);
  if (lessons.length > 27 || new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length || new Set(outline.sections.map((section) => section.id)).size !== outline.sections.length)
    ctx.addIssue({ code: "custom", message: "Outline identifiers must be unique, with at most 27 items." });
  const learnCount = lessons.filter((lesson) => lesson.kind === "learn").length;
  if (learnCount < 1 || learnCount > 20) ctx.addIssue({ code: "custom", message: "Include between 1 and 20 learning lessons." });
});
export const sessionRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), input: courseGenerationInputSchema, sourceJobId: z.string().regex(/^[a-f\d]{24}$/i).optional() }),
  z.object({ action: z.literal("approve"), sessionId: z.string().regex(/^[a-f\d]{24}$/i), outline: courseOutlineSchema, mode: z.enum(["append", "replace"]), revision: z.number().int().min(0) }),
  z.object({ action: z.literal("prepare"), sessionId: z.string().regex(/^[a-f\d]{24}$/i) }),
  z.object({ action: z.literal("commit"), sessionId: z.string().regex(/^[a-f\d]{24}$/i), revision: z.number().int().min(0) }),
  z.object({ action: z.literal("cancel"), sessionId: z.string().regex(/^[a-f\d]{24}$/i) }),
]);
export type CourseOutline = z.infer<typeof courseOutlineSchema>;
// Preserve saved lesson IDs and source references when normalizing older plans.
export function normalizePreLearnPostOutline(outline: CourseOutline, language: "English" | "Khmer"): CourseOutline {
  return courseOutlineSchema.parse({ ...outline, sections: [
    outline.sections[0],
    { ...outline.sections[1], title: language === "Khmer" ? "មេរៀន" : "Learn", lessons: outline.sections.slice(1, -1).flatMap((section) => section.lessons) },
    outline.sections.at(-1),
  ] });
}
export type OutlineLesson = z.infer<typeof outlineLessonSchema>;
export type GenerationSessionSnapshot = {
  id: string;
  status: "outline" | "generating" | "completed" | "cancelled";
  outline: CourseOutline;
  input: z.infer<typeof courseGenerationInputSchema>;
  sourceJobId?: string;
  cover?: CourseCover;
  coverWarning?: string | null;
  completedLessonIds: string[];
  currentLessonId: string | null;
  error: string | null;
  readyToSave: boolean;
  // Response-only coordination metadata; never a saved-lesson receipt.
  lease?: { locked: boolean; retryAfterMs: number };
};
