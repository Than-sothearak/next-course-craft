import { z } from "zod";
import { expandLearnBlockResponse } from "../learn-block-response";
import { DashboardError } from "@/lib/dashboard/rules";
import { editorLessonSchema } from "@/lib/editor/schemas";
import type { CourseGenerationInput, GeneratedSourceInventory, GeneratedCourseSeed } from "../course-generation-schemas";
import type { CourseOutline, OutlineLesson } from "../course-generation-session-schema";
import type { SourceCoursePlan } from "./types";
import { generateCourseSeed } from "./direct-course-workflow";
import { assembleCourseDraft } from "./course-draft-assembler";
import { generateLearnContentItem, generatePreActivities, generatePostActivities, countGeneratedImagePrompts } from "./source-generation-content";
import { buildPreLearnPostActivities } from "./block-content";
import { generatedLearnItemSchema, generatedPreActivitiesSchema, generatedPostActivitiesSchema } from "./response-schemas";
import { generationCheckpointPayload, saveGenerationCheckpoint, saveLearnWorkCheckpoint } from "./generation-job-store";
import { advanceSourceLearnWork } from "../source-learn-work";
import { learningActivityUsage, learningActivityIssues } from "./lesson-design";
import type { Types } from "mongoose";

type CheckpointJob = { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId; expiresAt: Date };
export async function prepareSessionLesson({ job, input, model, outline, item, inventory, sourcePlan }: {
  job: CheckpointJob; input: CourseGenerationInput; model: string; outline: CourseOutline; item: OutlineLesson;
  inventory?: GeneratedSourceInventory; sourcePlan?: SourceCoursePlan;
}) {
  const ownerId = String(job.ownerId), courseId = String(job.courseId);
  const learnItems = outline.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.kind === "learn");
  const isFirstCustomLesson = input.template === "custom" && item.kind === "learn" && item.id === learnItems[0]?.id;
  const customLessonOverview = learnItems.map((lesson) => {
    const planned = lesson.sourceIndex === undefined ? undefined : sourcePlan?.items[lesson.sourceIndex];
    return {
      title: lesson.title,
      focus: lesson.objective,
      slideRange: planned ? `${planned.startPage}-${planned.endPage}` : "",
    };
  });
  const previous: z.infer<typeof generatedLearnItemSchema>[] = [];
  for (const lesson of learnItems.filter((lesson) => lesson.id !== item.id)) {
    const stored = await generationCheckpointPayload(job, "sessionSeed", lesson.id);
    if (stored) previous.push(generatedLearnItemSchema.parse(expandLearnBlockResponse(stored)));
  }
  const plan: SourceCoursePlan = {
    title: outline.title, description: outline.description, objectives: learnItems.map((lesson) => lesson.objective),
    sourceLanguage: inventory?.sourceLanguage ?? input.targetLanguage, targetLanguage: input.targetLanguage,
    items: learnItems.map((lesson) => ({ ...(sourcePlan?.items[lesson.sourceIndex ?? -1] ?? { startPage: 1, endPage: 1, sourceElementIds: [], recommendedBlockTypes: [], interactionOpportunities: [] }), title: lesson.title, focus: lesson.objective })),
  };
  if (item.kind === "learn") {
    const previousBlocks = previous.flatMap((lesson) => lesson.blocks);
    let seed: GeneratedCourseSeed;
    if (inventory && sourcePlan && item.sourceIndex !== undefined) {
      const source = plan.items[learnItems.findIndex((lesson) => lesson.id === item.id)];
      const pages = inventory.pages.filter((page) => page.pageNumber >= source.startPage && page.pageNumber <= source.endPage);
      const work = await advanceSourceLearnWork({
        pages, savedWork: await generationCheckpointPayload(job, "learnWork", item.id),
        loadPart: async (key) => {
          const part = await generationCheckpointPayload(job, "sessionPart", `${item.id}:${key}`);
          return part == null ? null : generatedLearnItemSchema.parse(expandLearnBlockResponse(part));
        },
        savePart: (key, result) => saveGenerationCheckpoint(job, "sessionPart", `${item.id}:${key}`, result),
        saveWork: (work) => saveLearnWorkCheckpoint(job, item.id, work),
        generatePart: async (partPages, completed) => {
          const result = await generateLearnContentItem({ input, model, plan, inventory: { ...inventory, pages: partPages },
            item: { ...source, startPage: partPages[0].pageNumber, endPage: partPages.at(-1)!.pageNumber, sourceElementIds: partPages.flatMap((page) => page.elements.map((element) => element.sourceElementId)) },
            imagesRemaining: Math.max(0, (input.includeImages ? 8 : 0) - countGeneratedImagePrompts(input.standardMode ? completed : [...previous, ...completed])), previousLearningBlocks: [...previousBlocks, ...completed.flatMap((lesson) => lesson.blocks)],
          });
          if (!result.lesson || result.coverageIssues.length) throw new DashboardError(`Lesson needs source corrections: ${result.coverageIssues.join("; ").slice(0, 1_000)}`, 422);
          return result.lesson;
        },
      });
      if (!work.results) return null;
      const lesson = generatedLearnItemSchema.parse({ title: item.title, objective: item.objective, summary: work.results.map((part) => part.summary).join("\n\n").slice(0, 5_000), blocks: work.results.flatMap((part) => part.blocks) });
      if (!input.standardMode && countGeneratedImagePrompts([...previous, lesson]) > 8)
        throw new DashboardError("Presentation mode supports at most eight generated images across the course.", 422);
      await saveGenerationCheckpoint(job, "sessionSeed", item.id, lesson);
      let activities = { keyTerms: [], preTest: [] } as { keyTerms: GeneratedCourseSeed["keyTerms"]; preTest: GeneratedCourseSeed["preTest"] };
      if (isFirstCustomLesson) {
        const cached = await generationCheckpointPayload(job, "sessionPre", "course");
        if (cached) activities = cached as typeof activities;
        else {
          activities = await generatePreActivities(input, model, plan, inventory);
          await saveGenerationCheckpoint(job, "sessionPre", "course", activities);
        }
      }
      seed = { title: outline.title, description: outline.description, sections: [{ title: "Learn", lessons: [lesson] }], lessonOverview: customLessonOverview.map(({ focus, slideRange }) => ({ focus, slideRange })), ...activities, postTest: [], lessonSummary: lesson.summary, nextLesson: "Continue learning" };
    } else {
      const usage = learningActivityUsage(previousBlocks);
      seed = await generateCourseSeed({ ...input, template: "custom", lessonCount: 1, courseTitle: outline.title, courseDescription: outline.description,
        prompt: `${input.prompt}\n${inventory ? `Supplemental lesson context from the source: ${inventory.summary}. The original source groups are covered separately.` : ""}\nApproved outline: ${JSON.stringify(outline)}\nGenerate only lesson: ${item.title}. Objective: ${item.objective}. Do not generate other lessons. Remaining activity budget: ${Math.max(0, 2 - usage.knowledgeCheck - Number(input.template === "custom"))} knowledge checks and ${Math.max(0, 1 - usage.survey)} surveys. The custom template reserves one knowledge check for the first lesson's quick quiz. Avoid repeating: ${JSON.stringify(usage.questions)}.`,
      }, model, { includeCustomFirstLessonActivities: isFirstCustomLesson });
      seed = { ...seed, lessonOverview: isFirstCustomLesson ? customLessonOverview.map(({ focus, slideRange }) => ({ focus, slideRange })) : [], keyTerms: isFirstCustomLesson ? seed.keyTerms : [], preTest: isFirstCustomLesson ? seed.preTest : [] };
      const lesson = { ...seed.sections[0].lessons[0], summary: seed.lessonSummary };
      const issues = learningActivityIssues([...previousBlocks, ...lesson.blocks], [], input.template === "custom" ? { knowledgeCheck: 1 } : {});
      if (input.standardMode && input.includeImages && countGeneratedImagePrompts([lesson]) > 8) issues.push("A lesson can contain at most eight generated supporting images.");
      if (!input.standardMode && countGeneratedImagePrompts([...previous, { ...lesson, summary: seed.lessonSummary }]) > 8) issues.push("Presentation mode supports at most eight generated images across the course.");
      if (!input.standardMode && lesson.blocks.some((block) => ["formula", "table", "checklist"].includes(block.type))) issues.push("Presentation mode cannot use Standard-only Formula, Table, or Checklist blocks.");
      if (issues.length) throw new DashboardError(issues.join(" "), 422);
      await saveGenerationCheckpoint(job, "sessionSeed", item.id, { ...lesson, summary: seed.lessonSummary });
    }
    const draft = await assembleCourseDraft({
      ownerId,
      courseId,
      input: { ...input, template: "custom" },
      seed,
      coverageIssuesByItem: [],
      includeCourseActivities: false,
      includeFirstLessonActivities: isFirstCustomLesson,
      customLessonOverview,
      reservedKnowledgeChecks: input.template === "custom" ? 1 : 0,
      lessonProgress: { current: learnItems.findIndex((lesson) => lesson.id === item.id) + 1, total: learnItems.length },
    });
    return editorLessonSchema.parse({ ...draft.lessons[0], id: item.id, title: item.title });
  }
  const context = inventory ?? { summary: input.prompt, sourceLanguage: input.targetLanguage, sourcePageCount: 1, pages: [] };
  let pre = await generationCheckpointPayload(job, "sessionPre", "course");
  if (!pre) { pre = await generatePreActivities(input, model, plan, context); await saveGenerationCheckpoint(job, "sessionPre", "course", pre); }
  let post = await generationCheckpointPayload(job, "sessionPost", "course");
  if (!post && ["postTest", "summary", "next"].includes(item.kind)) {
    post = await generatePostActivities(input, model, plan, context, previous);
    await saveGenerationCheckpoint(job, "sessionPost", "course", post);
  }
  const seed: GeneratedCourseSeed = {
    title: outline.title, description: outline.description, sections: [], lessonOverview: learnItems.map((lesson) => ({ focus: lesson.objective, slideRange: "" })),
    ...generatedPreActivitiesSchema.parse(pre),
    ...(post ? generatedPostActivitiesSchema.parse(post) : { postTest: [], lessonSummary: outline.description, nextLesson: "Continue learning" }),
  };
  const emptyLessons = learnItems.map((lesson, order) => ({ id: lesson.id, sectionId: "learn", title: lesson.title, icon: "book" as const, lessonType: "content" as const, order, quizQuestions: [], blocks: [] }));
  const activities = buildPreLearnPostActivities(seed, { id: "learn", title: "Learn", order: 1 }, emptyLessons, input.targetLanguage === "Khmer");
  const index = { description: 0, overview: 1, keywords: 2, preTest: 3, postTest: 4 + learnItems.length, summary: 5 + learnItems.length, next: 6 + learnItems.length }[item.kind];
  return editorLessonSchema.parse({ ...activities.lessons[index], id: item.id, title: item.title });
}
