import { z } from "zod";

export const courseCoverTemplates = [
  { id: "gradient", label: "Gradient", description: "A soft blend of your brand colors" },
  { id: "solid", label: "Solid color", description: "A simple, focused introduction" },
  { id: "image", label: "Image", description: "Your image with a readable text overlay" },
  { id: "waves", label: "Waves", description: "Flowing layers of color" },
  { id: "geometric", label: "Geometric", description: "Bold shapes and a modern layout" },
  { id: "editorial", label: "Editorial", description: "A clean composition with an accent stripe" },
] as const;

const color = z.string().regex(/^#[\da-fA-F]{6}$/).transform((value) => value.toLowerCase());
const imageSource = z.string().refine((value) => value === "" ||
  /^\/api\/assets\/[a-f\d]{24}\/file$/i.test(value) ||
  /^\.\/media\/[a-z\d.-]+$/i.test(value) ||
  /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(value), "Choose an image from the media library.");

export const courseCoverSchema = z.object({
  template: z.enum(["gradient", "solid", "image", "waves", "geometric", "editorial"]).default("gradient"),
  backgroundColor: color.optional(),
  textColor: color.default("#ffffff"),
  alignment: z.enum(["left", "center"]).default("center"),
  imageSrc: imageSource.default(""),
  imageAlt: z.string().max(500).default(""),
  imagePosition: z.enum(["center", "top", "bottom"]).default("center"),
  overlayOpacity: z.number().int().min(0).max(90).default(55),
}).strict();

export type CourseCover = z.infer<typeof courseCoverSchema>;
export const defaultCourseCover: CourseCover = courseCoverSchema.parse({});

export function normalizeCourseCover(cover: unknown): CourseCover {
  const parsed = courseCoverSchema.safeParse(cover);
  return parsed.success ? parsed.data : { ...defaultCourseCover };
}
