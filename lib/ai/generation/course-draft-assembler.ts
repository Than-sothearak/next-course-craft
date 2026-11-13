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
import { toContentBlock, needsContinueAfter, continueBlock, buildPreLearnPostActivities, addCustomTemplateCourseActivities, removeTrailingContinueBlocks } from "./block-content";
import { constrainCourseActivities } from "./lesson-design";
import { initializeBlockProgress } from "@/lib/editor/progress-settings";

export async function assembleCourseDraft({
  ownerId,
  courseId,
  input,
  seed,
  sourceInventory,
  sourcePlan,
  coverageIssuesByItem,
  includeCourseActivities = true,
}: {
  ownerId: string;
  courseId: string;
  input: CourseGenerationInput;
  seed: GeneratedCourseSeed;
  sourceInventory?: GeneratedSourceInventory;
  sourcePlan?: SourceCoursePlan;
  coverageIssuesByItem: string[][];
  includeCourseActivities?: boolean;
}): Promise<GeneratedCourseDraft> {
  seed = constrainCourseActivities(seed);
  if (sourceInventory && input.includeImages)
    addSourceVisualBlocks(seed, sourceInventory);
  const targetLanguage = sourcePlan?.targetLanguage ?? resolveTargetLanguage(input);
  const khmer = courseUsesKhmer(targetLanguage);
  let sections: GeneratedCourseDraft["sections"] = [];
  let lessons: GeneratedCourseDraft["lessons"] = [];
  let generatedImageCount = 0;
  const createdAssetIds: string[] = [];
  const generatedBlockBySourceId = new Map<string, { lessonId: string; blockId: string }>();
  try {
    const generatedSections = await Promise.all(
      seed.sections.map(async (sectionSeed, sectionOrder) => {
        const sectionId = randomUUID();
        const convertedLessons = await Promise.all(
          sectionSeed.lessons.map(async (lessonSeed, lessonOrder) => {
            const lessonId = randomUUID();
            const lessonBlocks = splitGeneratedBlockSeeds(lessonSeed.blocks);
            const convertedBlocks = await Promise.allSettled(
              lessonBlocks.map((blockSeed) =>
                toContentBlock(
                  blockSeed,
                  ownerId,
                  courseId,
                  input.includeImages,
                  khmer,
                  (assetId) => createdAssetIds.push(assetId),
                ),
              ),
            );
            const failure = convertedBlocks.find(
              (result) => result.status === "rejected",
            );
            if (failure?.status === "rejected")
              return {
                lesson: null,
                error: failure.reason as unknown,
              };

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
              if (
                needsContinueAfter(blockSeed) &&
                nextBlock &&
                nextBlock.type !== "divider"
              ) {
                blocksWithContinue.push(continueBlock(khmer));
              }
            });
            const blocks = removeTrailingContinueBlocks(blocksWithContinue);
            return {
              lesson: {
                id: lessonId,
                sectionId,
                title: lessonSeed.title,
                icon: "book" as const,
                lessonType: "content" as const,
                order: lessonOrder,
                quizQuestions: [] as [],
                blocks,
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
