import { z } from "zod";

export const timelinePreferencesSchema = z.object({
  zoom: z.number().min(1).max(16).default(1), snapping: z.boolean().default(true), dark: z.boolean().default(true),
  nameWidth: z.number().min(160).max(360).default(216), height: z.number().min(160).max(1200).default(280),
}).strict();
export type TimelinePreferences = z.infer<typeof timelinePreferencesSchema>;
export const defaultTimelinePreferences = timelinePreferencesSchema.parse({});
export function parseTimelinePreferences(value: unknown): TimelinePreferences {
  const parsed = timelinePreferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultTimelinePreferences;
}
