import type { CourseGenerationInput, GeneratedCourseSeed, GeneratedSourceInventory } from "../course-generation-schemas";

type BlockSeed = GeneratedCourseSeed["sections"][number]["lessons"][number]["blocks"][number];
type SourcePages = GeneratedSourceInventory["pages"];

export const courseActivityLimits = { knowledgeCheck: 2, survey: 1 } as const;

const depthProfiles = {
  concise: { blocks: "6-8", words: "350-500", minTeachingBlocks: 4, minExplanationCharacters: 1_200 },
  detailed: { blocks: "10-14", words: "700-1,000", minTeachingBlocks: 8, minExplanationCharacters: 2_800 },
  veryDetailed: { blocks: "14-20", words: "1,100-1,500", minTeachingBlocks: 12, minExplanationCharacters: 4_500 },
} as const;

export function lessonRequirements(input: CourseGenerationInput, pages?: SourcePages) {
  const profile = depthProfiles[input.contentDepth];
  if (!pages) return profile;
  // A short source or a timeout-recovery part must not be padded with invented facts.
  const sourceLength = pages.flatMap((page) => page.elements)
    .reduce((total, element) => total + (element.kind === "code" ? Math.min(element.content.length, 200) : element.content.length), 0);
  const proseLength = pages.flatMap((page) => page.elements)
    .filter((element) => element.kind !== "code")
    .reduce((total, element) => total + element.content.length, 0);
  return {
    ...profile,
    minTeachingBlocks: sourceLength < 800 ? 1 : Math.min(profile.minTeachingBlocks, Math.ceil(sourceLength / 300)),
    minExplanationCharacters: sourceLength < 800 ? 0 : Math.min(profile.minExplanationCharacters, Math.floor(proseLength * 0.8)),
  };
}

export function lessonDesignInstruction(input: CourseGenerationInput, pages?: SourcePages) {
  const profile = lessonRequirements(input, pages);
  return [
    `LESSON DEPTH: For each full ${input.contentDepth} lesson, aim for ${profile.blocks} substantive teaching blocks and about ${profile.words} words of explanation in English, or comparable detail in the target language.`,
    `Minimum for this ${pages ? "assigned source portion" : "lesson"}: ${profile.minTeachingBlocks} distinct teaching blocks and ${profile.minExplanationCharacters} characters of explanatory learning content. Headings, Continue dividers, questions, surveys, repeated copy, and raw code do not replace explanations.`,
    "Teach a complete learning sequence: explain the goal and its relevance, introduce concepts in connected paragraphs, demonstrate a worked example with reasoning, explain a common mistake and how to avoid it, provide guided application, and close with a useful recap or transfer tip. Use multiple focused blocks rather than one short overview or a list of labels. Give accordion items, process steps, and card answers full explanations. Choose formats that fit the subject; vary them between lessons.",
    "ACTIVITY LIMITS: The entire generated course may contain at most 2 knowledgeCheck question blocks and 1 survey block, never per lesson. These are upper limits, not targets. Do not repeat a question or confidence survey across lessons. Use flip cards, accordions/tabs, and process steps for other suitable learning activities. Dedicated Pre/Post assessment quizzes keep their separately configured question counts.",
    "Continue controls belong only between substantial sections with more teaching content after them. Never end a lesson with a Continue button; end with substantive learning content.",
    ...(pages ? ["Preserve every assigned source detail and exact code in order. Scale the full-lesson targets to the supplied source portion; for sparse source material, use only supported explanations and do not invent facts or add filler to meet a quota."] : []),
  ].join("\n");
}

function explanatoryText(block: BlockSeed) {
  switch (block.type) {
    case "text": case "richText": case "statement":
      return [block.body, ...block.bullets].join("\n");
    case "code": return block.codeExample?.explanation ?? "";
    case "processSteps": case "accordion":
      return block.steps.map((step) => `${step.title}\n${step.body}`).join("\n");
    case "flipCard":
      return block.cards.map((card) => `${card.front}\n${card.back}`).join("\n");
    case "image": return block.imageBody;
    case "labeledGraphic":
      return block.markers.map((marker) => `${marker.label}\n${marker.description}`).join("\n");
    case "chart": return block.chartDescription;
    default: return "";
  }
}

function normalizedText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, " ").trim();
}

export function lessonDepthIssues(blocks: BlockSeed[], input: CourseGenerationInput, pages?: SourcePages) {
  const requirements = lessonRequirements(input, pages);
  const uniqueContent = new Map<string, string>();
  for (const block of blocks) {
    const text = explanatoryText(block).trim();
    const identity = normalizedText(text || (block.type === "code" ? block.body : ""));
    if (identity) uniqueContent.set(identity, text);
  }
  const issues: string[] = [];
  if (uniqueContent.size < requirements.minTeachingBlocks)
    issues.push(`Lesson depth: expected at least ${requirements.minTeachingBlocks} distinct teaching blocks, received ${uniqueContent.size}. Add substantive explanations, worked examples, and application guidance, not headings, repeated text, or extra questions.`);
  const explanationLength = [...uniqueContent.values()].join("").length;
  if (explanationLength < requirements.minExplanationCharacters)
    issues.push(`Lesson depth: expected at least ${requirements.minExplanationCharacters} characters of explanatory learning content, received ${explanationLength}. Explain how and why, develop examples, and cover common mistakes and a recap.`);
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

export function learningActivityIssues(blocks: BlockSeed[], previousBlocks: BlockSeed[] = []) {
  const usage = learningActivityUsage(blocks);
  const previousUsage = learningActivityUsage(previousBlocks);
  const issues: string[] = [];
  if (usage.knowledgeCheck > Math.max(0, courseActivityLimits.knowledgeCheck - previousUsage.knowledgeCheck))
    issues.push("The entire course may contain at most 2 knowledgeCheck question blocks. Replace excess questions with useful teaching content.");
  if (usage.survey > Math.max(0, courseActivityLimits.survey - previousUsage.survey))
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
export function constrainCourseActivities(seed: GeneratedCourseSeed): GeneratedCourseSeed {
  const used = { knowledgeCheck: 0, survey: 0 };
  const seen = new Set<string>();
  return {
    ...seed,
    sections: seed.sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => ({
        ...lesson,
        blocks: lesson.blocks.map((block) => {
          if (block.type !== "knowledgeCheck" && block.type !== "survey") return block;
          const question = normalizedText(block.question);
          if (!seen.has(question) && used[block.type] < courseActivityLimits[block.type]) {
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
