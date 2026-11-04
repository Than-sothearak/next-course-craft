import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel, generatedCourseSeedSchema, type CourseGenerationInput, type GeneratedCourseDraft, type GeneratedCourseSeed } from "../course-generation-schemas";
import { expandCourseBlockResponse } from "../learn-block-response";
import { createGenerationBudget } from "../generation-retry";
import { generationStageTimeoutMs } from "../generation-timeouts";
import { courseResponseSchema, learnItemResponseSchema, preActivitiesResponseSchema, postActivitiesResponseSchema, compactLearnItemResponseSchema } from "./response-schemas";
import { buildUserPrompt, courseSystemPrompt } from "./prompts";
import { requestStructuredJson } from "./provider";
import { learnerLanguageStyleInstruction, resolveTargetLanguage } from "./language";
import { lessonDepthIssues, learningActivityIssues, lessonRequirements } from "./lesson-design";
import { generateSourceInventory } from "./source-inventory";
import type { GenerationSourceFile } from "./types";
import { generateSourceCourseSeed } from "./source-generation-content";
import { assembleCourseDraft } from "./course-draft-assembler";

function courseSeedResponseSchema(input: CourseGenerationInput) {
  const properties = courseResponseSchema.properties;
  const sections = properties.sections;
  const lessons = sections.items.properties.lessons;
  const template = input.template === "preLearnPost";
  return {
    ...courseResponseSchema,
    properties: {
      ...properties,
      title: { type: "string", minLength: 1, maxLength: 160 },
      description: { type: "string", minLength: 1, maxLength: 5_000 },
      sections: {
        ...sections,
        minItems: 1,
        maxItems: template ? 1 : 10,
        items: {
          ...sections.items,
          properties: {
            title: { type: "string", minLength: 1, maxLength: 160 },
            lessons: {
              ...lessons,
              minItems: template ? input.lessonCount : 1,
              maxItems: template ? input.lessonCount : 20,
              items: {
                ...lessons.items,
                properties: {
                  title: learnItemResponseSchema.properties.title,
                  objective: learnItemResponseSchema.properties.objective,
                  blocks: { ...compactLearnItemResponseSchema.properties.blocks, minItems: lessonRequirements(input).minTeachingBlocks },
                },
              },
            },
          },
        },
      },
      lessonOverview: { ...properties.lessonOverview, minItems: template ? input.lessonCount : 0, maxItems: template ? input.lessonCount : 500 },
      keyTerms: { ...preActivitiesResponseSchema.properties.keyTerms, minItems: template ? 5 : 0 },
      preTest: { ...preActivitiesResponseSchema.properties.preTest, minItems: template ? 3 : 0 },
      postTest: { ...properties.postTest, minItems: template ? input.postTestCount : 0, maxItems: template ? input.postTestCount : 20 },
      lessonSummary: { type: "string", minLength: 1, maxLength: 5_000 },
      nextLesson: postActivitiesResponseSchema.properties.nextLesson,
    },
  };
}

function courseSeedValidationIssues(seed: GeneratedCourseSeed, input: CourseGenerationInput) {
  const issues: { path: string; code: string; message: string }[] = [];
  const check = (condition: boolean, path: string, message: string) => {
    if (!condition) issues.push({ path, code: "custom", message });
  };
  const count = seed.sections.reduce((total, section) => total + section.lessons.length, 0);
  check(count === input.lessonCount, "sections", `Return the requested number of lessons: expected ${input.lessonCount}, received ${count}.`);
  if (input.template === "preLearnPost") {
    check(seed.sections.length === 1, "sections", "Return exactly one Learn section; the application adds Pre and Post activities.");
    check(seed.lessonOverview.length === count, "lessonOverview", `Return exactly ${count} overview entries, one per Learn lesson.`);
    check(seed.keyTerms.length === 5, "keyTerms", "Return exactly five keywords with definitions.");
    check(seed.preTest.length === 3, "preTest", "Return exactly three pre-test questions.");
    check(seed.postTest.length === input.postTestCount, "postTest", `Return exactly ${input.postTestCount} post-test questions.`);
  }
  seed.sections.forEach((section, sectionIndex) => section.lessons.forEach((lesson, lessonIndex) => {
    for (const message of lessonDepthIssues(lesson.blocks, input))
      issues.push({ path: `sections.${sectionIndex}.lessons.${lessonIndex}.blocks`, code: "custom", message });
  }));
  for (const message of learningActivityIssues(seed.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.blocks))))
    issues.push({ path: "sections", code: "custom", message });
  return issues;
}

export async function generateCourseSeed(input: CourseGenerationInput, model: string) {
  const content: Array<Record<string, string>> = [{
    type: "input_text",
    text: buildUserPrompt(input, false),
  }];
  const budget = createGenerationBudget(generationStageTimeoutMs);
  let validationFeedback = "";
  let validationIssues: { path: string; code: string; message: string }[] = [];

  for (let attempt = 0; attempt < 2 && budget.remainingAttempts > 0; attempt += 1) {
    const attemptContent = attempt === 0
      ? content
      : [
          ...content,
          {
            type: "input_text",
            text:
              "VALIDATION RETRY: Your previous course draft failed application validation. " +
              "Correct every listed issue, then return the complete course JSON again. Keep all source material, examples, and code intact while meeting the schema limits. " +
              validationFeedback,
          },
        ];
    const rawSeed = await requestStructuredJson({
      model,
      developerPrompt: `${courseSystemPrompt}\n\n${learnerLanguageStyleInstruction(resolveTargetLanguage(input))}`,
      content: attemptContent,
      schemaName: "course_generation",
      schema: courseSeedResponseSchema(input),
      maxOutputTokens: 64_000,
      timeoutMs: generationStageTimeoutMs,
      budget,
    });
    const parsed = generatedCourseSeedSchema.safeParse(expandCourseBlockResponse(rawSeed));
    validationIssues = parsed.success
      ? courseSeedValidationIssues(parsed.data, input)
      : parsed.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        }));
    if (parsed.success && !validationIssues.length) return parsed.data;
    validationFeedback = JSON.stringify(validationIssues);
  }

  console.error("AI course output failed application validation after retry", validationIssues);
  const issueSummary = validationIssues
    .slice(0, 5)
    .map((issue) => `${issue.path || "course"}: ${issue.message}`)
    .join("; ");
  throw new DashboardError(
    `The AI provider returned course content that did not pass validation${issueSummary ? ` (${issueSummary})` : ""}. Please retry generation.`,
    502,
  );
}

export async function generateCourseDraft({
  ownerId,
  courseId,
  input,
  sourceFile,
}: {
  ownerId: string;
  courseId: string;
  input: CourseGenerationInput;
  sourceFile?: GenerationSourceFile;
}): Promise<GeneratedCourseDraft> {
  const model =
    input.model ??
    (process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel);
  const sourceInventory = sourceFile
    ? await generateSourceInventory(input, model, sourceFile)
    : undefined;
  const sourceGeneration = sourceInventory
    ? await generateSourceCourseSeed(input, model, sourceInventory)
    : undefined;
  const seed = sourceGeneration?.seed ?? await generateCourseSeed(input, model);
  return assembleCourseDraft({
    ownerId,
    courseId,
    input,
    seed,
    sourceInventory,
    sourcePlan: sourceGeneration?.plan,
    coverageIssuesByItem: sourceGeneration?.coverageIssuesByItem ?? [],
  });
}

