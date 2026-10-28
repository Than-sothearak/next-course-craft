import { z } from "zod";

export const courseLayoutSchema = z.enum(["standard", "slides"]);
export type CourseLayout = z.infer<typeof courseLayoutSchema>;
export function normalizeCourseLayout(value: unknown): CourseLayout {
  return courseLayoutSchema.safeParse(value).data ?? "standard";
}
