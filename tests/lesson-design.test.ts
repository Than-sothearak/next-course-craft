import { describe, expect, it } from "vitest";
import {
  courseGenerationInputSchema,
  generatedBlockSeedSchema,
  generatedCourseSeedSchema,
  type GeneratedSourceInventory,
} from "../lib/ai/course-generation-schemas";
import { expandLearnBlockResponse } from "../lib/ai/learn-block-response";
import { constrainCourseActivities, learningActivityIssues, lessonDepthIssues, lessonDesignInstruction } from "../lib/ai/generation/lesson-design";
import { removeTrailingContinueBlocks, textHtml } from "../lib/ai/generation/block-content";
import { blockSchema } from "../lib/schemas/block";

const input = courseGenerationInputSchema.parse({
  prompt: "Teach support triage.", audience: "New staff", level: "beginner", lessonCount: 3,
  template: "custom", includeImages: false, courseTitle: "Support", courseDescription: "Support training.",
});

function seedBlock(value: object) {
  const expanded = expandLearnBlockResponse({ blocks: [{ title: "", ...value }] }) as { blocks: unknown[] };
  return generatedBlockSeedSchema.parse(expanded.blocks[0]);
}

function explanations(count = 8) {
  return Array.from({ length: count }, (_, index) => seedBlock({
    type: "richText",
    body: `Teaching example ${index + 1}. ${"Explain the observed problem, why the suggested action follows from the available evidence, how to apply it in a realistic customer case, and which common mistake to avoid. ".repeat(3)}`,
  }));
}

function question(prompt: string) {
  return seedBlock({ type: "knowledgeCheck", question: prompt, options: ["Read the message", "Guess the cause"], correctOptionIndex: 0, correctFeedback: "Start with the available facts." });
}

function survey(prompt: string) {
  return seedBlock({ type: "survey", question: prompt, minLabel: "Not confident", maxLabel: "Confident" });
}

describe("generated lesson depth and course activity limits", () => {
  it("requires multiple developed teaching blocks and applies the selected depth", () => {
    expect(lessonDepthIssues(explanations(), input)).toEqual([]);
    expect(lessonDepthIssues(explanations(4), { ...input, contentDepth: "concise" })).toEqual([]);
    expect(lessonDepthIssues(explanations(4), input).some((issue) => issue.includes("distinct teaching blocks"))).toBe(true);
    expect(lessonDepthIssues(explanations(), { ...input, contentDepth: "veryDetailed" }).length).toBeGreaterThan(0);
    expect(lessonDepthIssues(explanations(12), { ...input, contentDepth: "veryDetailed" })).toEqual([]);
  });

  it("does not accept headings, controls, questions, or surveys as teaching explanations", () => {
    const padding = [
      ...Array.from({ length: 8 }, (_, index) => seedBlock({ type: "heading", title: `Heading ${index + 1}` })),
      seedBlock({ type: "divider" }), question("What should you do first?"), survey("How confident are you?"),
    ];
    expect(lessonDepthIssues(padding, input)).toHaveLength(2);
    expect(lessonDepthIssues(explanations().map((block) => ({ ...block, body: "One short sentence." })), input)).toHaveLength(2);
  });

  it("requires explanatory prose alongside raw code", () => {
    const code = seedBlock({ type: "code", body: "const answer = 42;\n".repeat(500) });
    expect(lessonDepthIssues([code], input).some((issue) => issue.includes("explanatory learning content"))).toBe(true);
  });

  it("scales source requirements to a bounded source portion without padding sparse material", () => {
    const pages: GeneratedSourceInventory["pages"] = [{
      pageNumber: 1, elements: [{ sourceElementId: "p1-e1", kind: "text", content: "Read the full customer message before responding.", visualKind: "other", visibleText: "", uncertainContent: false }],
    }];
    const brief = seedBlock({ type: "text", body: pages[0].elements[0].content });
    expect(lessonDepthIssues([brief], input, pages)).toEqual([]);
    const densePages = [{ ...pages[0], elements: [{ ...pages[0].elements[0], content: pages[0].elements[0].content.repeat(60) }] }];
    expect(lessonDepthIssues([brief], input, densePages)).toHaveLength(2);
    expect(lessonDesignInstruction(input, pages)).toContain("do not invent facts or add filler");
  });

  it("counts question and survey blocks across the course, including previous lesson parts", () => {
    expect(learningActivityIssues([question("Which detail matters?"), survey("Rate your confidence")], [question("What is the next action?")])).toEqual([]);
    const issues = learningActivityIssues([question("Which action is supported?"), survey("How confident are you?")], [question("First action?"), question("Which detail matters?"), survey("Rate your confidence")]);
    expect(issues).toHaveLength(2);
    expect(issues.join(" ")).toContain("entire course");
  });

  it("rejects repeated activity prompts despite changes to case, spaces, or punctuation", () => {
    expect(learningActivityIssues([question("  WHAT should you do first! ")], [question("What should you do first?")])).toEqual(["Do not repeat question or survey prompts across the generated course."]);
  });

  it("enforces course limits on saved checkpoints without losing source mappings or correct explanations", () => {
    const seed = generatedCourseSeedSchema.parse({
      title: "Support", description: "Support training.",
      sections: [{ title: "Learn", lessons: [
        { title: "First", objective: "Read", blocks: [question("What comes first?"), survey("How confident are you?")] },
        { title: "Second", objective: "Identify", blocks: [question("Which detail matters?")] },
        { title: "Third", objective: "Apply", blocks: [
          { ...question("Which action is supported?"), sourceElementIds: ["p3-e1"] },
          survey("How confident are you?"),
        ] },
      ] }],
      lessonOverview: [], keyTerms: [], preTest: [], postTest: [], lessonSummary: "Review the taught steps.", nextLesson: "Apply triage",
    });
    const constrained = constrainCourseActivities(seed);
    const blocks = constrained.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.blocks));
    expect(blocks.filter((block) => block.type === "knowledgeCheck")).toHaveLength(2);
    expect(blocks.filter((block) => block.type === "survey")).toHaveLength(1);
    expect(blocks[3]).toMatchObject({ type: "text", sourceElementIds: ["p3-e1"] });
    expect(blocks[3].body).toContain("Read the message");
    expect(blocks[3].body).toContain("Start with the available facts.");
    expect(seed.sections[0].lessons[2].blocks[0].type).toBe("knowledgeCheck");
  });
});

describe("generated lesson endings and paragraphs", () => {
  const text = blockSchema.parse({ id: "text", version: 1, type: "richText", data: { html: "<p>Developed explanation.</p>" } });
  const gate = blockSchema.parse({ id: "gate", version: 1, type: "divider", data: { style: "continue", label: "Continue", completionType: "completeAbove" } });
  const line = blockSchema.parse({ id: "line", version: 1, type: "divider", data: { style: "line" } });

  it("keeps internal gates and removes all Continue controls after the last teaching block", () => {
    expect(removeTrailingContinueBlocks([text, gate, text, gate, gate, line])).toEqual([text, gate, text, line]);
    expect(removeTrailingContinueBlocks([text])).toEqual([text]);
    expect(removeTrailingContinueBlocks([])).toEqual([]);
  });

  it("renders explanations as real paragraphs while escaping authored text", () => {
    expect(textHtml("", "First <example>.\nA supporting line.\n\nSecond paragraph.", [])).toBe("<p>First &lt;example&gt;.<br />A supporting line.</p><p>Second paragraph.</p>");
  });
});
