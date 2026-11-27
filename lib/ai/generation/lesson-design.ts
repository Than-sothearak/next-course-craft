import type { CourseGenerationInput, GeneratedCourseSeed, GeneratedSourceInventory } from "../course-generation-schemas";
import { conceptTeachingInstruction } from "./teaching-style";

type BlockSeed = GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number];
type SourcePages = GeneratedSourceInventory["pages"];

export const courseActivityLimits = { knowledgeCheck: 2, survey: 1 } as const;

const depthProfiles = {
  concise: "Give the essential definition, explanation, and example needed for each concept.",
  detailed: "Explain how and why each concept works, with relevant examples and common mistakes where helpful.",
  veryDetailed: "Develop the reasoning and relevant examples for each concept, including useful edge cases, common mistakes, and transfer to new situations.",
} as const;

export function lessonDesignInstruction(input: CourseGenerationInput, pages?: SourcePages) {
  return [
    `LESSON DEPTH (${input.contentDepth}): ${depthProfiles[input.contentDepth]} Depth changes the treatment of each concept, not a fixed number of blocks or words.`,
    conceptTeachingInstruction,
    "ACTIVITY LIMITS: The entire generated course may contain at most 2 knowledgeCheck question blocks and 1 survey block, never per lesson. These are upper limits, not targets. Do not repeat a question or confidence survey across lessons. Use flip cards, accordions/tabs, process steps, and timelines for other suitable learning activities. Dedicated Pre/Post assessment quizzes keep their separately configured question counts.",
    "Continue controls belong only between substantial sections with more teaching content after them. Never end a lesson with a Continue button; end with substantive learning content.",
    ...(pages ? ["Preserve every assigned source detail and exact code in order. For sparse source material, use only supported explanations and do not invent facts or add filler to meet a quota."] : []),
  ].join("\n");
}

function explanatoryText(block: BlockSeed) {
  switch (block.type) {
    case "text": case "richText": case "statement":
      return [block.body, ...block.bullets].join("\n");
    case "code": return block.codeExample?.explanation ?? "";
    case "processSteps": case "accordion":
      return block.steps.map((step) => `${step.title}\n${step.body}`).join("\n");
    case "timeline":
      return block.timelineItems.map((item) => `${item.label}\n${item.title}\n${item.body}`).join("\n");
    case "flipCard":
      return block.cards.map((card) => `${card.front}\n${card.back}`).join("\n");
    case "image": return block.imageBody;
    case "labeledGraphic":
      return block.markers.map((marker) => `${marker.label}\n${marker.description}`).join("\n");
    case "chart": return [block.chartDescription, ...block.chartFields.map((field) => `${field.label}: ${field.value}`)].join("\n");
    case "formula": return [block.formulaLatex, block.formulaExplanation, ...block.formulaVariables.map((variable) => variable.explanation)].join("\n");
    case "table": return [...block.tableColumns, ...block.tableRows.flat()].join("\n");
    case "checklist": return block.checklistItems.join("\n");
    case "conceptMap": return [block.conceptMapCentralConcept, block.conceptMapCentralExplanation, ...block.conceptMapBranches.flatMap((branch) => [branch.concept, branch.relationship, branch.explanation])].join("\n");
    case "databaseSchema": return block.databaseEntities.flatMap((entity) => [entity.name, ...entity.fields.map((field) => field.name)]).join("\n");
    case "link": return block.linkDescription;
    default: return "";
  }
}

function normalizedText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, " ").trim();
}

export function hasCodeExplanation(blocks: BlockSeed[], index: number) {
  let start = index, end = index;
  while (blocks[start - 1]?.type === "code") start -= 1;
  while (blocks[end + 1]?.type === "code") end += 1;
  return blocks.slice(start, end + 1).some((block) => Boolean(block.codeExample?.explanation.trim()))
    || [blocks[start - 1], blocks[end + 1]].some((block) => block
      && ["text", "richText", "statement"].includes(block.type)
      && Boolean([block.body, ...block.bullets].join("").trim()));
}

export function lessonDepthIssues(blocks: BlockSeed[], { checkCodeExplanations = true } = {}) {
  const issues: string[] = [];
  // Source code explanations are checked by source coverage so a partial result
  // can be retained and repaired without discarding its exact source listing.
  const suppliedCode = !checkCodeExplanations && blocks.some((block) => block.type === "code" && block.body.trim());
  if (!suppliedCode && !blocks.some((block) => /[\p{L}\p{N}]/u.test(explanatoryText(block))))
    issues.push("Lesson content: include meaningful explanatory learning content. Headings, Continue controls, quiz questions, surveys, and raw code alone do not explain a concept.");
  blocks.forEach((block, index) => {
    if (checkCodeExplanations && block.type === "code" && !hasCodeExplanation(blocks, index))
      issues.push(`Code example ${index + 1} needs an adjacent Text block explaining its important lines or parts. Keep code and any expected output together with their explanation.`);
  });
  return issues;
}

export function learningActivityUsage(blocks: BlockSeed[]) {
  return {
    knowledgeCheck: blocks.filter((block) => block.type === "knowledgeCheck").length,
    survey: blocks.filter((block) => block.type === "survey").length,
    questions: blocks.filter((block) => block.type === "knowledgeCheck" || block.type === "survey")
      .map((block) => normalizedText(block.question)),
  };
}

export function learningActivityIssues(
  blocks: BlockSeed[],
  previousBlocks: BlockSeed[] = [],
  reserved: { knowledgeCheck?: number; survey?: number } = {},
) {
  const usage = learningActivityUsage(blocks);
  const previousUsage = learningActivityUsage(previousBlocks);
  const issues: string[] = [];
  if (usage.knowledgeCheck > Math.max(0, courseActivityLimits.knowledgeCheck - previousUsage.knowledgeCheck - (reserved.knowledgeCheck ?? 0)))
    issues.push("The entire course may contain at most 2 knowledgeCheck question blocks. Replace excess questions with useful teaching content.");
  if (usage.survey > Math.max(0, courseActivityLimits.survey - previousUsage.survey - (reserved.survey ?? 0)))
    issues.push("The entire course may contain at most 1 survey block. Replace repeated confidence checks with useful teaching content.");
  const seen = new Set(learningActivityUsage(previousBlocks).questions);
  for (const question of learningActivityUsage(blocks).questions) {
    if (seen.has(question)) issues.push("Do not repeat question or survey prompts across the generated course.");
    seen.add(question);
  }
  return [...new Set(issues)];
}

// Saved source checkpoints may predate these limits. Keep their teaching material
// while enforcing the same course-wide interaction budget during final assembly.
export function constrainCourseActivities(seed: GeneratedCourseSeed, reserved: { knowledgeCheck?: number; survey?: number } = {}): GeneratedCourseSeed {
  const used = { knowledgeCheck: 0, survey: 0 };
  const seen = new Set<string>();
  const limits = {
    knowledgeCheck: Math.max(0, courseActivityLimits.knowledgeCheck - (reserved.knowledgeCheck ?? 0)),
    survey: Math.max(0, courseActivityLimits.survey - (reserved.survey ?? 0)),
  };
  return {
    ...seed,
    sections: seed.sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => ({
        ...lesson,
        blocks: lesson.blocks.map((block) => {
          if (block.type !== "knowledgeCheck" && block.type !== "survey") return block;
          const question = normalizedText(block.question);
          if (!seen.has(question) && used[block.type] < limits[block.type]) {
            seen.add(question);
            used[block.type] += 1;
            return block;
          }
          return {
            ...block,
            type: "text" as const,
            title: "",
            body: block.type === "knowledgeCheck"
              ? [block.question, block.options[block.correctOptionIndex], block.correctFeedback].filter(Boolean).join("\n\n")
              : block.question,
            bullets: [],
          };
        }),
      })),
    })),
  };
}
