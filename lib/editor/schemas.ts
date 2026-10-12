import { z } from "zod";
import { blockSchema } from "@/lib/schemas/block";

export const editorSectionSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  order: z.number().int().min(0).max(500),
});

export const editorLessonSchema = z.object({
  id: z.string().min(1).max(64),
  sectionId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  order: z.number().int().min(0).max(500),
  blocks: z.array(blockSchema).max(500),
});

export const editorSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5_000),
  revision: z.number().int().min(0),
  sections: z.array(editorSectionSchema).min(1).max(100),
  lessons: z.array(editorLessonSchema).max(500),
}).superRefine((snapshot, context) => {
  const sectionIds = new Set(snapshot.sections.map((section) => section.id));
  if (sectionIds.size !== snapshot.sections.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section identifiers must be unique." });
  }
  const sectionOrders = new Set(snapshot.sections.map((section) => section.order));
  if (sectionOrders.size !== snapshot.sections.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section positions must be unique." });
  }
  const lessonIds = new Set(snapshot.lessons.map((lesson) => lesson.id));
  if (lessonIds.size !== snapshot.lessons.length) {
    context.addIssue({ code: "custom", path: ["lessons"], message: "Lesson identifiers must be unique." });
  }
}).transform((snapshot) => {
  const sectionIds = new Set(snapshot.sections.map((section) => section.id));
  const mappedSection = new Map(snapshot.lessons.map((lesson) => [lesson.id, sectionIds.has(lesson.sectionId) ? lesson.sectionId : snapshot.sections[0].id]));
  const lessonsBySection = new Map<string, typeof snapshot.lessons>();
  for (const lesson of snapshot.lessons) {
    const sectionId = mappedSection.get(lesson.id)!;
    lessonsBySection.set(sectionId, [...(lessonsBySection.get(sectionId) ?? []), lesson]);
  }
  const normalizedOrder = new Map<string, number>();
  for (const lessons of lessonsBySection.values()) {
    [...lessons].sort((a, b) => a.order - b.order).forEach((lesson, order) => normalizedOrder.set(lesson.id, order));
  }
  return {
    ...snapshot,
    lessons: snapshot.lessons.map((lesson) => ({ ...lesson, sectionId: mappedSection.get(lesson.id)!, order: normalizedOrder.get(lesson.id)! })),
  };
});

export type EditorSnapshotInput = z.infer<typeof editorSnapshotSchema>;
