import { z } from "zod";

export const defaultCourseImageGenerationModel = "gpt-image-2.5-sunburst";

export const courseImageModelValues = [
  "gpt-image-2.6-sunburst",
  "gpt-image-2.6-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-sunburst-2026-09-08",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-flare-2026-09-08",
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
  "gpt-image-1.5",
  "gpt-image-1-mini",
  "chatgpt-image-latest",
] as const;
export const courseImageModelSchema = z.enum(courseImageModelValues);
export type CourseImageModel = z.infer<typeof courseImageModelSchema>;

export const courseImageStyleValues = [
  "auto",
  "flatIllustration",
  "3dCartoon",
  "photorealistic",
  "handDrawn",
  "watercolor",
  "isometric",
  "infographic",
  "pixelArt",
  "custom",
] as const;

export const courseImageStyleSchema = z.enum(courseImageStyleValues);
export type CourseImageStyle = z.infer<typeof courseImageStyleSchema>;

export const courseImageQualityValues = ["low", "medium", "high"] as const;
export const courseImageQualitySchema = z
  .enum(["low", "medium", "high", "optimized", "fullSize"])
  .transform((quality) => quality === "optimized"
    ? "medium"
    : quality === "fullSize"
      ? "high"
      : quality);
export type CourseImageQuality = z.infer<typeof courseImageQualitySchema>;

export const courseImageDimensions = {
  low: { width: 1024, height: 640 },
  medium: { width: 1152, height: 656 },
  high: { width: 1280, height: 720 },
} as const satisfies Record<CourseImageQuality, { width: number; height: number }>;

export type GeneratedImagePurpose = "course-cover" | "lesson-cover" | "process-step-guide";

export function generatedImageDimensions(quality: CourseImageQuality, model = defaultCourseImageGenerationModel, purpose?: GeneratedImagePurpose) {
  // GPT Image 1.x supports fixed sizes only. Keep landscape output native.
  if (/^gpt-image-1(?:[.-]|$)/.test(model)) return { width: 1536, height: 1024 };
  if (purpose === "lesson-cover") return { width: 1440, height: 480 };
  if (purpose === "process-step-guide") return { width: 1152, height: 656 };
  return courseImageDimensions[quality];
}

export function courseImageQualityDescription(quality: CourseImageQuality, model = defaultCourseImageGenerationModel) {
  const { width, height } = generatedImageDimensions(quality, model);
  return `${quality[0].toUpperCase()}${quality.slice(1)} AI generation quality · ${width} × ${height} pixels. Compressed WebP, below 100 KB.`;
}

export function lessonCoverImageDescription(quality: CourseImageQuality, model = defaultCourseImageGenerationModel) {
  const { width, height } = generatedImageDimensions(quality, model, "lesson-cover");
  return `Lesson covers use ${width} × ${height} pixels with the selected AI quality.`;
}

export const generatedCourseImageOutputCompression = 30;
export const generatedCourseImageMaxBytes = 100_000;

export const courseImageQualityOptions: { value: CourseImageQuality; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const courseImageStyleOptions: { value: CourseImageStyle; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "flatIllustration", label: "Flat illustration" },
  { value: "3dCartoon", label: "3D cartoon" },
  { value: "photorealistic", label: "Photorealistic photography" },
  { value: "handDrawn", label: "Hand-drawn" },
  { value: "watercolor", label: "Watercolor" },
  { value: "isometric", label: "Isometric" },
  { value: "infographic", label: "Infographic" },
  { value: "pixelArt", label: "Pixel art" },
  { value: "custom", label: "Custom style" },
];

export function courseImageStyleInstruction(style: CourseImageStyle, customStyle = "") {
  if (style === "custom") {
    const direction = customStyle.trim();
    return direction
      ? `Apply this custom visual treatment while preserving the educational subject and composition: ${direction}.`
      : "Use a clear, accessible visual style chosen to suit the educational subject.";
  }
  switch (style) {
    case "flatIllustration": return "Use a flat vector illustration with simple shapes, crisp edges, and a limited color palette.";
    case "3dCartoon": return "Use a friendly 3D cartoon style with rounded forms, soft lighting, and clear subject separation.";
    case "photorealistic": return "Use natural, photorealistic editorial photography with realistic lighting and believable people and materials.";
    case "handDrawn": return "Use a clean hand-drawn ink illustration with confident lines and restrained color.";
    case "watercolor": return "Use a polished watercolor illustration with soft pigment texture and readable shapes.";
    case "isometric": return "Use a clear isometric illustration with consistent perspective and uncluttered geometry.";
    case "infographic": return "Use a clean infographic visual with simple shapes and visual hierarchy; do not include words, labels, or numbers.";
    case "pixelArt": return "Use carefully composed pixel art with a limited palette and crisp pixel edges.";
    default: return "Use a clear, accessible visual style chosen to suit the educational subject.";
  }
}
