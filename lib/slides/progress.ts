import { z } from "zod";
import type { SlideRecord } from "./schema";
import { pageRequirementsMet } from "./blocks";

const progressEntrySchema = z.object({ revision: z.number().int().min(0), completedBlocks: z.array(z.string().max(64)).max(100), finished: z.boolean() }).strict();
export type PageProgress = z.infer<typeof progressEntrySchema>;
export type CoursePageProgress = Record<string, PageProgress>;
export function restorePageProgress(value: unknown, pages: SlideRecord[]): CoursePageProgress {
  const parsed = z.record(z.string().max(64), progressEntrySchema).safeParse(value);
  if (!parsed.success) return {};
  const result: CoursePageProgress = {};
  for (const page of pages) {
    const saved = parsed.data[page.id];
    if (!saved || saved.revision !== page.revision) continue;
    const completedBlocks = saved.completedBlocks.filter((id) => page.composition?.layers.some((layer) => layer.id === id));
    result[page.id] = { ...saved, completedBlocks, finished: saved.finished && (!page.composition || pageRequirementsMet(page.composition, completedBlocks)) };
  }
  return result;
}
