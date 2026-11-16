import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel, generatedCourseSeedSchema, type CourseGenerationInput, type GeneratedCourseDraft, type GeneratedCourseSeed, type GeneratedSourceInventory } from "../course-generation-schemas";
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
import { logGenerationProgress } from "./progress-log";

function courseSeedResponseSchema(input: CourseGenerationInput, includeCustomFirstLessonActivities: boolean) {
  const properties = courseResponseSchema.properties;
  const sections = properties.sections;
  const lessons = sections.items.properties.lessons;
  const template = input.template === "preLearnPost";
  const courseActivities = template || includeCustomFirstLessonActivities;
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
      lessonOverview: { ...properties.lessonOverview, minItems: courseActivities ? input.lessonCount : 0, maxItems: courseActivities ? input.lessonCount : 500 },
      keyTerms: { ...preActivitiesResponseSchema.properties.keyTerms, minItems: courseActivities ? 5 : 0 },
      preTest: { ...preActivitiesResponseSchema.properties.preTest, minItems: courseActivities ? 3 : 0 },
      postTest: { ...properties.postTest, minItems: template ? input.postTestCount : 0, maxItems: template ? input.postTestCount : 20 },
      lessonSummary: { type: "string", minLength: 1, maxLength: 5_000 },
      nextLesson: postActivitiesResponseSchema.properties.nextLesson,
    },
  };
}

function courseSeedValidationIssues(seed: GeneratedCourseSeed, input: CourseGenerationInput, includeCustomFirstLessonActivities: boolean) {
  const issues: { path: string; code: string; message: string }[] = [];
  const check = (condition: boolean, path: string, message: string) => {
    if (!condition) issues.push({ path, code: "custom", message });
  };
  const count = seed.sections.reduce((total, section) => total + section.lessons.length, 0);
  check(count === input.lessonCount, "sections", `Return the requested number of lessons: expected ${input.lessonCount}, received ${count}.`);
  if (input.template === "preLearnPost" || includeCustomFirstLessonActivities) {
    if (input.template === "preLearnPost") check(seed.sections.length === 1, "sections", "Return exactly one Learn section; the application adds Pre and Post activities.");
    check(seed.lessonOverview.length === count, "lessonOverview", `Return exactly ${count} overview entries, one per Learn lesson.`);
    check(seed.keyTerms.length === 5, "keyTerms", "Return exactly five keywords with definitions.");
    check(seed.preTest.length === 3, "preTest", "Return exactly three pre-test questions.");
    if (input.template === "preLearnPost") check(seed.postTest.length === input.postTestCount, "postTest", `Return exactly ${input.postTestCount} post-test questions.`);
  }
  seed.sections.forEach((section, sectionIndex) => section.lessons.forEach((lesson, lessonIndex) => {
    for (const message of lessonDepthIssues(lesson.blocks, input))
      issues.push({ path: `sections.${sectionIndex}.lessons.${lessonIndex}.blocks`, code: "custom", message });
    if (!input.standardMode && lesson.blocks.some((block) => ["formula", "table", "checklist"].includes(block.type)))
      issues.push({ path: `sections.${sectionIndex}.lessons.${lessonIndex}.blocks`, code: "custom", message: "Presentation mode cannot use Standard-only Formula, Table, or Checklist blocks." });
  }));
  if (!input.standardMode) {
    const generatedImages = seed.sections.flatMap((section) => section.lessons).reduce((total, lesson) => total + lesson.blocks.reduce((count, block) => {
      if ((block.type === "image" || block.type === "labeledGraphic") && block.imagePrompt.trim()) return count + 1;
      if (block.type === "flipCard") return count + block.cards.reduce((cardCount, card) => cardCount + Number(Boolean(card.frontImagePrompt.trim())) + Number(Boolean(card.backImagePrompt.trim())), 0);
      return count;
    }, 0), 0);
    if (generatedImages > 8) issues.push({ path: "sections", code: "custom", message: "Presentation mode supports at most eight generated images across the course." });
  }
  for (const message of learningActivityIssues(
    seed.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.blocks)),
    [],
    input.template === "custom" && includeCustomFirstLessonActivities ? { knowledgeCheck: 1 } : {},
  ))
    issues.push({ path: "sections", code: "custom", message });
  return issues;
}

export async function generateCourseSeed(
  input: CourseGenerationInput,
  model: string,
  options: { includeCustomFirstLessonActivities?: boolean } = {},
) {
  const includeCustomFirstLessonActivities = input.template === "custom" && (options.includeCustomFirstLessonActivities ?? true);
  const content: Array<Record<string, string>> = [{
    type: "input_text",
    text: buildUserPrompt(input, false, undefined, { includeCustomFirstLessonActivities }),
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
      schema: courseSeedResponseSchema(input, includeCustomFirstLessonActivities),
      maxOutputTokens: 64_000,
      timeoutMs: generationStageTimeoutMs,
      budget,
    });
    const parsed = generatedCourseSeedSchema.safeParse(expandCourseBlockResponse(rawSeed));
    validationIssues = parsed.success
      ? courseSeedValidationIssues(parsed.data, input, includeCustomFirstLessonActivities)
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
  logGenerationProgress({ status: "STARTED", task: "Generate course draft", courseId });
  try {
    const model = input.model ?? (process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel);
    let sourceInventory: GeneratedSourceInventory | undefined;
    if (sourceFile) {
      logGenerationProgress({ status: "IN PROGRESS", task: "Read and analyze uploaded source", courseId });
      sourceInventory = await generateSourceInventory(input, model, sourceFile);
      logGenerationProgress({ status: "DONE", task: "Read and analyze uploaded source", courseId, detail: `${sourceInventory.pages.length} pages indexed` });
    }

    let seed: GeneratedCourseSeed;
    let sourcePlan: Awaited<ReturnType<typeof generateSourceCourseSeed>>["plan"] | undefined;
    let coverageIssuesByItem: string[][] = [];
    if (sourceInventory) {
      logGenerationProgress({ status: "IN PROGRESS", task: "Generate lessons from source material", courseId });
      const sourceGeneration = await generateSourceCourseSeed(input, model, sourceInventory);
      seed = sourceGeneration.seed;
      sourcePlan = sourceGeneration.plan;
      coverageIssuesByItem = sourceGeneration.coverageIssuesByItem;
      logGenerationProgress({
        status: "DONE",
        task: "Generate lessons from source material",
        courseId,
        detail: `${seed.sections.reduce((total, section) => total + section.lessons.length, 0)} lessons prepared`,
      });
    } else {
      logGenerationProgress({ status: "IN PROGRESS", task: "Generate course lessons", courseId });
      seed = await generateCourseSeed(input, model);
      logGenerationProgress({
        status: "DONE",
        task: "Generate course lessons",
        courseId,
        detail: `${seed.sections.reduce((total, section) => total + section.lessons.length, 0)} lessons prepared`,
      });
    }

    logGenerationProgress({ status: "IN PROGRESS", task: "Assemble course and generate lesson images", courseId });
    const draft = await assembleCourseDraft({ ownerId, courseId, input, seed, sourceInventory, sourcePlan, coverageIssuesByItem });
    logGenerationProgress({
      status: "DONE",
      task: "Course draft ready",
      courseId,
      detail: `${draft.lessons.length} lessons and ${draft.generatedImageCount} images saved`,
    });
    return draft;
  } catch (error) {
    logGenerationProgress({
      status: "FAILED",
      task: "Generate course draft",
      courseId,
      detail: error instanceof DashboardError ? `Request failed with status ${error.status}` : "Unexpected server error; see the server error above",
    });
    throw error;
  }
}

