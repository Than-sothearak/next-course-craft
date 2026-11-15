import { z } from "zod";

export const defaultCourseImageGenerationModel = "gpt-image-2.5-sunburst";

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
