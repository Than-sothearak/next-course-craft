import { z } from "zod";

export const courseNavigationModeValues = [
  "free",
  "sequential",
  "restricted",
] as const;

export const courseNavigationModeSchema = z.enum(courseNavigationModeValues);
export type CourseNavigationMode = z.infer<typeof courseNavigationModeSchema>;
export const defaultCourseNavigationMode: CourseNavigationMode = "sequential";

export const courseNavigationModeOptions: {
  value: CourseNavigationMode;
  title: string;
  description: string;
}[] = [
  {
    value: "free",
    title: "Free navigation",
    description: "Students can open any lesson from the sidebar.",
  },
  {
    value: "sequential",
    title: "Sequential navigation (recommended)",
    description:
      "Students must complete the current lesson before opening the next one.",
  },
  {
    value: "restricted",
    title: "Restricted navigation",
    description:
      "Students must complete required activities before unlocking the next lesson.",
  },
];

export function normalizeCourseNavigationMode(value: unknown): CourseNavigationMode {
  const parsed = courseNavigationModeSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultCourseNavigationMode;
}
