import { describe, expect, it } from "vitest";
import { courseGenerationInputSchema, generatedBlockSeedSchema } from "../lib/ai/course-generation-schemas";
import { expandLearnBlockResponse } from "../lib/ai/learn-block-response";
import { previousBlockMixInstruction } from "../lib/ai/generation/block-selection";
import { buildUserPrompt, courseSystemPrompt } from "../lib/ai/generation/prompts";

function block(value: object) {
  const expanded = expandLearnBlockResponse({ blocks: [{ title: "", ...value }] }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

describe("course block selection guidance", () => {
  it.each([false, true])("keeps native charts available with generated images set to %s", (includeImages) => {
    const input = courseGenerationInputSchema.parse({
      prompt: "Compare North: 1200 and South: 2400 requests.", audience: "New staff", level: "beginner",
      lessonCount: 1, template: "custom", includeImages, courseTitle: "Requests", courseDescription: "Compare regions.",
    });
    const prompt = buildUserPrompt(input, false);
    expect(prompt).toContain("Native charts remain enabled regardless of the image setting");
    expect(prompt).not.toContain("preserve their labels/data in text blocks");
    expect(courseSystemPrompt).toContain("Keep exact supplied values, labels, and units");
    expect(courseSystemPrompt).toContain("A topic about data alone is not a dataset");
  });

  it("shares the actual prior format mix without copying authored content", () => {
    const steps = [{ title: "First", body: "An authored detail." }, { title: "Second", body: "Another detail." }];
    const prompt = previousBlockMixInstruction([
      block({ type: "text", body: "Private authored explanation." }),
      block({ type: "richText", body: "A second paragraph." }),
      block({ type: "accordion", layout: "tabs", steps }),
      block({ type: "accordion", layout: "accordion", steps }),
      block({ type: "chart", title: "Requests", chartType: "line", chartFields: [{ label: "Monday", value: 1200 }] }),
    ]);
    expect(prompt).toContain('"richText":2');
    expect(prompt).toContain('"tabs":1');
    expect(prompt).toContain('"accordion":1');
    expect(prompt).toContain('"chart:line":1');
    expect(prompt).toContain('["tabs","accordion","chart:line"]');
    expect(prompt).toContain("suits the assigned material equally well");
    expect(prompt).not.toContain("Private authored explanation");
    expect(prompt).not.toContain("An authored detail");
  });

  it("keeps history bounded for long courses and handles the first lesson", () => {
    const cards = block({ type: "flipCard", cards: [{ front: "Prompt", back: "Answer" }] });
    expect(previousBlockMixInstruction(Array.from({ length: 10_000 }, () => cards)).length).toBeLessThan(1_000);
    expect(previousBlockMixInstruction([])).toContain("No earlier learning blocks");
  });
});
