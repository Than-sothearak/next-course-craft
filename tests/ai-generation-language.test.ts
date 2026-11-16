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
  it("keeps Khmer prose natural and established technical vocabulary in English", () => {
    const style = learnerLanguageStyleInstruction("Khmer");

    expect(style).toContain("natural Khmer");
    expect(style).toContain("do not translate English sentence structures word for word");
    expect(style).toContain("Technical and subject-specific terms must remain in English");
    expect(style).toContain("Do not translate or transliterate them");
    expect(style).toContain("exact source spelling and capitalization");
    expect(style).toContain("HTML, CSS, JavaScript, Flexbox, API");
    expect(style).toContain("explain its meaning in Khmer");
    expect(style).toContain("every learner-facing field");
  });

  it("applies the Khmer style rules to the course generation prompt", () => {
    const prompt = buildUserPrompt({ ...input, targetLanguage: "Khmer" }, false);

    expect(prompt).toContain("Target language: Khmer.");
    expect(prompt).toContain("Technical and subject-specific terms must remain in English");
    expect(prompt).toContain("Do not translate or transliterate them");
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
