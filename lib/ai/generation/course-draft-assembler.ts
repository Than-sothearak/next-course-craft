import { randomUUID } from "node:crypto";
import { Asset } from "@/models/Asset";
import type { ContentBlock } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import type { CourseGenerationInput, GeneratedSourceInventory, GeneratedCourseDraft, GeneratedCourseSeed } from "../course-generation-schemas";
import type { SourceCoursePlan } from "./types";
import { deleteStoredMedia } from "@/lib/media/service";
import { resolveTargetLanguage, courseUsesKhmer } from "./language";
import { addSourceVisualBlocks, buildSourceCoverageReport } from "./source-coverage";
import { splitGeneratedBlockSeeds } from "./block-seeds";
import { toContentBlock, toLessonCoverBlock, needsContinueAfter, continueBlock, buildPreLearnPostActivities, addCustomTemplateCourseActivities, addCustomTemplateFirstLessonActivities, removeTrailingContinueBlocks } from "./block-content";
import { constrainCourseActivities } from "./lesson-design";
import { initializeBlockProgress } from "@/lib/editor/progress-settings";
import { logGenerationProgress } from "./progress-log";

export async function assembleCourseDraft({
  ownerId,
  courseId,
  input,
  seed,
  sourceInventory,
  sourcePlan,
  coverageIssuesByItem,
  includeCourseActivities = true,
  includeFirstLessonActivities = false,
  customLessonOverview,
  reservedKnowledgeChecks,
  lessonProgress,
}: {
  ownerId: string;
  courseId: string;
  input: CourseGenerationInput;
  seed: GeneratedCourseSeed;
  sourceInventory?: GeneratedSourceInventory;
  sourcePlan?: SourceCoursePlan;
  coverageIssuesByItem: string[][];
  includeCourseActivities?: boolean;
  includeFirstLessonActivities?: boolean;
  customLessonOverview?: { title: string; focus: string; slideRange?: string }[];
  reservedKnowledgeChecks?: number;
  lessonProgress?: { current: number; total: number };
}): Promise<GeneratedCourseDraft> {
  seed = constrainCourseActivities(seed, {
    knowledgeCheck: reservedKnowledgeChecks ?? (input.template === "custom" && includeCourseActivities ? 1 : 0),
  });
  if (sourceInventory && input.includeImages)
    addSourceVisualBlocks(seed, sourceInventory, input.standardMode);
  const targetLanguage = sourcePlan?.targetLanguage ?? resolveTargetLanguage(input);
  const khmer = courseUsesKhmer(targetLanguage);
  let sections: GeneratedCourseDraft["sections"] = [];
  let lessons: GeneratedCourseDraft["lessons"] = [];
  let generatedImageCount = 0;
  const createdAssetIds: string[] = [];
  const generatedBlockBySourceId = new Map<string, { lessonId: string; blockId: string }>();
  const totalLessonCount = lessonProgress?.total ?? seed.sections.reduce((total, section) => total + section.lessons.length, 0);
  try {
    const generatedSections = await Promise.all(
      seed.sections.map(async (sectionSeed, sectionOrder) => {
        const sectionId = randomUUID();
        const convertedLessons = await Promise.all(
          sectionSeed.lessons.map(async (lessonSeed, lessonOrder) => {
            const lessonNumber = lessonProgress?.current ?? seed.sections.slice(0, sectionOrder).reduce((total, section) => total + section.lessons.length, 0) + lessonOrder + 1;
            const lessonTask = `Build lesson ${lessonNumber} of ${totalLessonCount}`;
            logGenerationProgress({ status: "IN PROGRESS", task: lessonTask, courseId, current: lessonNumber, total: totalLessonCount });
            const lessonId = randomUUID();
            const lessonBlocks = splitGeneratedBlockSeeds(lessonSeed.blocks);
            const supportingImageCount = lessonBlocks.filter((block) => block.type === "image" && block.imagePrompt.trim()).length;
            let supportingImageIndex = 0;
            const convertedBlocks = await Promise.allSettled(
              lessonBlocks.map((blockSeed) => {
                const imageTask = input.includeImages && blockSeed.type === "image" && blockSeed.imagePrompt.trim()
                  ? `Generate supporting image ${++supportingImageIndex} of ${supportingImageCount} for lesson ${lessonNumber} of ${totalLessonCount}`
                  : null;
                if (imageTask)
                  logGenerationProgress({ status: "IN PROGRESS", task: imageTask, courseId, current: lessonNumber, total: totalLessonCount });
                const conversion = toContentBlock(
                  blockSeed,
                  ownerId,
                  courseId,
                  input.includeImages,
                  khmer,
                  (assetId) => createdAssetIds.push(assetId),
                  { imageStyle: input.imageStyle, imageQuality: input.imageQuality, customImageStyle: input.customImageStyle },
                );
                return imageTask
                  ? conversion.then((result) => {
                    logGenerationProgress({ status: "DONE", task: imageTask, courseId, current: lessonNumber, total: totalLessonCount });
                    return result;
                  }, (error: unknown) => {
                    logGenerationProgress({ status: "FAILED", task: imageTask, courseId, current: lessonNumber, total: totalLessonCount });
                    throw error;
                  })
                  : conversion;
              }),
            );
            const failure = convertedBlocks.find(
              (result) => result.status === "rejected",
            );
            if (failure?.status === "rejected") {
              logGenerationProgress({ status: "FAILED", task: lessonTask, courseId, current: lessonNumber, total: totalLessonCount, detail: "A lesson block could not be generated" });
              return {
                lesson: null,
                error: failure.reason as unknown,
              };
            }

            const blocksWithContinue: ContentBlock[] = [];
            lessonBlocks.forEach((blockSeed, index) => {
              const converted = convertedBlocks[index];
              if (converted?.status !== "fulfilled") return;
              blocksWithContinue.push(converted.value.block);
              for (const sourceElementId of blockSeed.sourceElementIds) {
                if (!generatedBlockBySourceId.has(sourceElementId))
                  generatedBlockBySourceId.set(sourceElementId, {
                    lessonId,
                    blockId: converted.value.block.id,
                  });
              }
              const nextBlock = lessonBlocks[index + 1];
              const codeConceptPair = nextBlock && (
                (blockSeed.type === "code" && ["code", "text", "richText", "statement"].includes(nextBlock.type))
                || (nextBlock.type === "code" && ["text", "richText", "statement"].includes(blockSeed.type))
              );
              if (
                needsContinueAfter(blockSeed) &&
                nextBlock &&
                !codeConceptPair &&
                nextBlock.type !== "divider"
              ) {
                blocksWithContinue.push(continueBlock(khmer));
              }
            });
            const blocks = removeTrailingContinueBlocks(blocksWithContinue);
            let lessonCover: ContentBlock | null = null;
            if (input.includeImages) {
              const coverTask = `Generate cover image for lesson ${lessonNumber} of ${totalLessonCount}`;
              logGenerationProgress({ status: "IN PROGRESS", task: coverTask, courseId, current: lessonNumber, total: totalLessonCount });
              try {
                lessonCover = await toLessonCoverBlock(
                  ownerId,
                  courseId,
                  seed.title,
                  lessonSeed.title,
                  lessonSeed.objective,
                  (assetId) => createdAssetIds.push(assetId),
                  { imageStyle: input.imageStyle, imageQuality: input.imageQuality, customImageStyle: input.customImageStyle },
                );
                logGenerationProgress({ status: "DONE", task: coverTask, courseId, current: lessonNumber, total: totalLessonCount });
              } catch (error) {
                logGenerationProgress({ status: "FAILED", task: coverTask, courseId, current: lessonNumber, total: totalLessonCount });
                throw error;
              }
            }
            logGenerationProgress({
              status: "DONE",
              task: lessonTask,
              courseId,
              current: lessonNumber,
              total: totalLessonCount,
              detail: input.includeImages
                ? supportingImageCount
                  ? "Lesson content, cover, and selected supporting images are ready"
                  : "Lesson content and cover are ready"
                : "Lesson content is ready",
            });
            return {
              lesson: {
                id: lessonId,
                sectionId,
                title: lessonSeed.title,
                icon: "book" as const,
                lessonType: "content" as const,
                order: lessonOrder,
                quizQuestions: [] as [],
                blocks: lessonCover ? [lessonCover, ...blocks] : blocks,
              },
              error: null,
            };
          }),
        );
        return {
          section: {
            id: sectionId,
            title: sectionSeed.title,
            order: sectionOrder,
          },
          convertedLessons,
        };
      }),
    );
    const conversionFailure = generatedSections
      .flatMap((generatedSection) => generatedSection.convertedLessons)
      .find((lesson) => lesson.error)?.error;
    if (conversionFailure) throw conversionFailure;
    for (const generatedSection of generatedSections) {
      sections.push(generatedSection.section);
      lessons.push(
        ...generatedSection.convertedLessons.flatMap((lesson) =>
          lesson.lesson ? [lesson.lesson] : [],
        ),
      );
    }
    generatedImageCount = createdAssetIds.length;
    if (includeCourseActivities && input.template === "preLearnPost") {
      const activityCourse = buildPreLearnPostActivities(
        seed,
        sections[0],
        lessons,
        khmer,
      );
      sections = activityCourse.sections;
      lessons = activityCourse.lessons;
    } else if (includeCourseActivities) {
      const activityCourse = addCustomTemplateCourseActivities(
        seed,
        sections,
        lessons,
        khmer,
        customLessonOverview,
      );
      sections = activityCourse.sections;
      lessons = activityCourse.lessons;
    } else if (includeFirstLessonActivities && input.template === "custom") {
      const activityCourse = addCustomTemplateFirstLessonActivities(
        seed,
        sections,
        lessons,
        khmer,
        customLessonOverview,
      );
      sections = activityCourse.sections;
      lessons = activityCourse.lessons;
    }
    lessons = lessons.map((lesson) => ({ ...lesson, blocks: removeTrailingContinueBlocks(lesson.blocks) }));
    editorSnapshotSchema.parse({
      title: seed.title,
      description: seed.description,
      revision: 0,
      sections,
      lessons,
    });
  } catch (error) {
    const assets = createdAssetIds.length
      ? await Asset.find({ _id: { $in: createdAssetIds }, ownerId, courseId })
          .select("objectKey storageProvider storageKey storageDirectory mimeType size _id")
          .lean()
      : [];
    await Promise.allSettled(
      assets.map(async (asset) => {
        await deleteStoredMedia(asset);
        await Asset.deleteOne({ _id: asset._id, ownerId, courseId });
      }),
    );
    throw error;
  }

  const sourceCoverage = sourcePlan && sourceInventory
    ? buildSourceCoverageReport(
        sourceInventory,
        sourcePlan,
        seed,
        generatedBlockBySourceId,
        coverageIssuesByItem,
      )
    : undefined;

  return {
    title: seed.title,
    description: seed.description,
    sections,
    lessons: lessons.map((lesson) => ({ ...lesson, blocks: initializeBlockProgress(lesson.blocks, "sequential") })),
    template: input.template,
    learningLessonCount:
      input.template === "preLearnPost"
        ? lessons.filter(
            (lesson) =>
              lesson.sectionId === sections[1]?.id,
          ).length
        : lessons.length,
    generatedImageCount,
    ...(sourceCoverage ? { sourceCoverage } : {}),
  };
}
