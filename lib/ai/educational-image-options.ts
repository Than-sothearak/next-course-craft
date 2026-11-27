import { z } from "zod";

export const educationalImageLookSchema = z.enum(["auto", "cleanEducational", "screenshotUi", "realisticPhoto", "flatIllustration", "3dIllustration"]);
export type EducationalImageLook = z.infer<typeof educationalImageLookSchema>;
export const educationalImageLookOptions: { value: EducationalImageLook; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Match the look to the visual type and lesson content." },
  { value: "cleanEducational", label: "Clean Educational", description: "Light background, clear labels, and a simple layout." },
  { value: "screenshotUi", label: "Screenshot / UI Mockup", description: "Browser windows, code editors, or app screens." },
  { value: "realisticPhoto", label: "Realistic Photo", description: "Photographic materials, equipment, or environments." },
  { value: "flatIllustration", label: "Flat Illustration", description: "Simple shapes and colors for abstract concepts." },
  { value: "3dIllustration", label: "3D Illustration", description: "Depth and perspective for objects students need to recognize." },
];

export const educationalImageVisualTypeSchema = z.enum(["auto", "diagram", "stepByStep", "beforeAfter", "comparison", "workedExample"]);
export type EducationalImageVisualType = z.infer<typeof educationalImageVisualTypeSchema>;
export const educationalImageVisualTypeOptions: { value: EducationalImageVisualType; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "diagram", label: "Concept Diagram" },
  { value: "stepByStep", label: "Step by Step" },
  { value: "beforeAfter", label: "Before & After" },
  { value: "comparison", label: "Comparison" },
  { value: "workedExample", label: "Worked Example" },
];

const visualDirections: Record<EducationalImageVisualType, string> = {
  auto: "Choose the visual type from the lesson content: a concept diagram for relationships, ordered panels for a process, a comparison for alternatives, or a worked example for an application. For HTML/CSS that changes the appearance of a page, choose Before & After to show the same page before and after the supplied styling; for a basic page creation task, show the code and its matching result. Do not invent an unsupported before-state or result.",
  diagram: "Create a concept diagram with clearly connected ideas, accurate relationships and only essential short labels.",
  stepByStep: "Create a step-by-step visual with ordered panels showing only the supplied actions and their results.",
  beforeAfter: "Create a Before & After visual: two clearly paired views of the same subject before and after the supplied change. Keep the viewpoint and unrelated details consistent, and make the relevant difference easy to see. For HTML/CSS, show the same page before and after styling, with relevant code where useful. Do not invent unsupported changes.",
  comparison: "Create a side-by-side comparison of the supplied alternatives using the same attributes, scale and visual hierarchy for each.",
  workedExample: "Create a worked example showing the supplied inputs, the relevant operation and its supported result. Preserve exact code, formulas and numerical values.",
};
const lookDirections: Record<EducationalImageLook, string> = {
  auto: "Match the look to the chosen visual type and lesson content. Prefer Screenshot / UI Mockup for HTML/CSS, browser, code-editor and application examples; Realistic Photo for physical materials and equipment; and a clean educational diagram or flat illustration for abstract concepts. Choose 3D only when depth helps recognize an object.",
  cleanEducational: "Use a Clean Educational look: a light background, clear minimal labels, generous spacing and a simple uncluttered layout.",
  screenshotUi: "Use a Screenshot / UI Mockup look with recognizable browser windows, code editors or application screens, authentic controls and readable interface typography. These are generated demonstrations, not verified screenshots.",
  realisticPhoto: "Use a Realistic Photo look: photographic materials, equipment or environments with believable texture, natural lighting and accurate proportions.",
  flatIllustration: "Use a Flat Illustration look: simple shapes, crisp edges and restrained colors to explain the concept. Avoid photographic textures and 3D rendering.",
  "3dIllustration": "Use a 3D Illustration look: clear depth, consistent perspective, realistic proportions and useful lighting for objects students need to recognize. Keep the scene focused and avoid unrelated decorative objects.",
};

export function educationalImageDirections(visualType: EducationalImageVisualType = "auto", look: EducationalImageLook = "auto") {
  return [
    `Visual type: ${educationalImageVisualTypeOptions.find((option) => option.value === visualType)!.label}. ${visualDirections[visualType]}`,
    `Look: ${educationalImageLookOptions.find((option) => option.value === look)!.label}. ${lookDirections[look]}`,
    "Honor explicit visual type and look selections over default working-environment suggestions. Auto chooses only the unspecified setting. This is a lesson-content visual; course cover and thumbnail generation are separate options.",
  ].join("\n");
}
