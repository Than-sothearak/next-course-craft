import { z } from "zod";
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
  const previous: z.infer<typeof generatedLearnItemSchema>[] = [];
  for (const lesson of learnItems.filter((lesson) => lesson.id !== item.id)) {
    const stored = await generationCheckpointPayload(job, "sessionSeed", lesson.id);
    if (stored) previous.push(generatedLearnItemSchema.parse(stored));
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
          return part == null ? null : generatedLearnItemSchema.parse(part);
        },
        savePart: (key, result) => saveGenerationCheckpoint(job, "sessionPart", `${item.id}:${key}`, result),
        saveWork: (work) => saveLearnWorkCheckpoint(job, item.id, work),
        generatePart: async (partPages, completed) => {
          const result = await generateLearnContentItem({ input, model, plan, inventory: { ...inventory, pages: partPages },
            item: { ...source, startPage: partPages[0].pageNumber, endPage: partPages.at(-1)!.pageNumber, sourceElementIds: partPages.flatMap((page) => page.elements.map((element) => element.sourceElementId)) },
            imagesRemaining: Math.max(0, 8 - countGeneratedImagePrompts([...previous, ...completed])), previousLearningBlocks: [...previousBlocks, ...completed.flatMap((lesson) => lesson.blocks)],
          });
          if (!result.lesson || result.coverageIssues.length) throw new DashboardError(`Lesson needs source corrections: ${result.coverageIssues.join("; ").slice(0, 1_000)}`, 422);
          return result.lesson;
        },
      });
      if (!work.results) return null;
      const lesson = generatedLearnItemSchema.parse({ title: item.title, objective: item.objective, summary: work.results.map((part) => part.summary).join("\n\n").slice(0, 5_000), blocks: work.results.flatMap((part) => part.blocks) });
      await saveGenerationCheckpoint(job, "sessionSeed", item.id, lesson);
      seed = { title: outline.title, description: outline.description, sections: [{ title: "Learn", lessons: [lesson] }], lessonOverview: [], keyTerms: [], preTest: [], postTest: [], lessonSummary: lesson.summary, nextLesson: "Continue learning" };
    } else {
      const usage = learningActivityUsage(previousBlocks);
      seed = await generateCourseSeed({ ...input, template: "custom", lessonCount: 1, courseTitle: outline.title, courseDescription: outline.description,
        prompt: `${input.prompt}\n${inventory ? `Supplemental lesson context from the source: ${inventory.summary}. The original source groups are covered separately.` : ""}\nApproved outline: ${JSON.stringify(outline)}\nGenerate only lesson: ${item.title}. Objective: ${item.objective}. Do not generate other lessons. Remaining activity budget: ${Math.max(0, 2 - usage.knowledgeCheck)} knowledge checks and ${Math.max(0, 1 - usage.survey)} surveys. Avoid repeating: ${JSON.stringify(usage.questions)}. Generate at most ${Math.max(0, 8 - countGeneratedImagePrompts(previous))} images.`,
      }, model);
      const lesson = seed.sections[0].lessons[0];
      const issues = learningActivityIssues([...previousBlocks, ...lesson.blocks]);
      if (countGeneratedImagePrompts([...previous, { ...lesson, summary: seed.lessonSummary }]) > 8) issues.push("A course can contain at most eight generated images.");
      if (issues.length) throw new DashboardError(issues.join(" "), 422);
      await saveGenerationCheckpoint(job, "sessionSeed", item.id, { ...lesson, summary: seed.lessonSummary });
    }
    const draft = await assembleCourseDraft({ ownerId, courseId, input: { ...input, template: "custom" }, seed, coverageIssuesByItem: [], includeCourseActivities: false });
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
