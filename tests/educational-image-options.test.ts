import { describe, expect, it } from "vitest";
import { educationalImageLookOptions } from "@/lib/ai/educational-image-options";
import { processStepImagePrompt, processStepImageRequestSchema } from "@/lib/ai/process-step-image";

const input = { source: "block" as const, title: "", instructions: "Use CSS to change the heading color to blue.", customPrompt: "" };

describe("educational visual directions", () => {
  it("defaults omitted selections to automatic type and look selection for HTML/CSS", () => {
    const prompt = processStepImagePrompt(processStepImageRequestSchema.parse(input));
    expect(prompt).toContain("Visual type: Auto.");
    expect(prompt).toContain("Look: Auto.");
    expect(prompt).toContain("For HTML/CSS that changes the appearance of a page, choose Before & After");
    expect(prompt).toContain("Prefer Screenshot / UI Mockup for HTML/CSS");
    expect(prompt).toContain(input.instructions);
  });

  it("supports the exact requested look menu independently of visual type", () => {
    expect(educationalImageLookOptions.map((option) => option.label)).toEqual([
      "Auto", "Clean Educational", "Screenshot / UI Mockup", "Realistic Photo", "Flat Illustration", "3D Illustration",
    ]);
    const prompt = processStepImagePrompt({ ...input, visualType: "beforeAfter", look: "screenshotUi" });
    expect(prompt).toContain("two clearly paired views of the same subject");
    expect(prompt).toContain("same page before and after styling");
    expect(prompt).toContain("Look: Screenshot / UI Mockup.");
    expect(prompt).toContain("browser result must agree with the visible code");
  });

  it.each([
    ["cleanEducational", "light background", "simple uncluttered layout"],
    ["realisticPhoto", "photographic materials", "natural lighting"],
    ["flatIllustration", "simple shapes", "Avoid photographic textures and 3D rendering"],
    ["3dIllustration", "clear depth", "objects students need to recognize"],
  ] as const)("honors %s without forcing screenshot rendering", (look, first, second) => {
    const prompt = processStepImagePrompt({ ...input, visualType: "diagram", look });
    expect(prompt).toContain(first);
    expect(prompt).toContain(second);
    expect(prompt).toContain("Create a concept diagram");
    expect(prompt).not.toContain("For software, create a realistic application screenshot");
    expect(prompt).not.toContain("For physical tasks, use a realistic close-up photograph");
  });

  it("lets Auto choose only the unspecified setting and keeps covers separate", () => {
    const prompt = processStepImagePrompt({ ...input, visualType: "beforeAfter", look: "auto" });
    expect(prompt).toContain("Visual type: Before & After.");
    expect(prompt).toContain("Look: Auto.");
    expect(prompt).toContain("Auto chooses only the unspecified setting");
    expect(processStepImageRequestSchema.safeParse({ ...input, visualType: "courseCover" }).success).toBe(false);
  });
});
