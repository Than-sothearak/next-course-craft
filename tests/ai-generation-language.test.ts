import { describe, expect, it } from "vitest";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import { buildUserPrompt } from "@/lib/ai/generation/prompts";
import { courseUsesKhmer, learnerLanguageStyleInstruction, resolveTargetLanguage } from "@/lib/ai/generation/language";

const input = courseGenerationInputSchema.parse({
  prompt: "Teach HTML, CSS, and Flexbox.",
  audience: "Beginner learners",
  level: "beginner",
  lessonCount: 3,
  template: "custom",
  includeImages: false,
  courseTitle: "Web layout basics",
  courseDescription: "Learn how page layouts work.",
});

describe("Khmer course generation guidance", () => {
  it("keeps learner-facing prose in Khmer and pairs technical terms with English", () => {
    const style = learnerLanguageStyleInstruction("Khmer");

    expect(style).toContain("natural Khmer");
    expect(style).toContain("rather than translating English sentence structures word for word");
    expect(style).toContain("Write every learner-facing value in Khmer");
    expect(style).toContain("natural Khmer equivalent first, followed immediately by the exact English term in parentheses");
    expect(style).toContain("អថេរ (variable)");
    expect(style).toContain("never leave such a term by itself in English");
    expect(style).toContain("Write every learner-facing value in Khmer");
  });

  it("applies the Khmer style rules to the course generation prompt", () => {
    const prompt = buildUserPrompt({ ...input, targetLanguage: "Khmer" }, false);

    expect(prompt).toContain("Target language: Khmer.");
    expect(prompt).toContain("Write every learner-facing value in Khmer");
    expect(prompt).toContain("natural Khmer equivalent first, followed immediately by the exact English term in parentheses");
  });

  it("uses explicit Khmer author language requests consistently", () => {
    const requestedInKhmer = { ...input, prompt: "Write this course in Khmer." };

    expect(resolveTargetLanguage(requestedInKhmer)).toBe("Khmer");
    expect(courseUsesKhmer(resolveTargetLanguage(requestedInKhmer))).toBe(true);
    expect(learnerLanguageStyleInstruction(resolveTargetLanguage(requestedInKhmer))).toContain("TECHNICAL VOCABULARY");
  });

  it("does not add Khmer-specific style rules to English courses", () => {
    expect(learnerLanguageStyleInstruction("English")).toBe("");
  });
});
