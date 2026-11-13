import { Types } from "mongoose";
import { z } from "zod";
import { DashboardError } from "@/lib/dashboard/rules";
import { courseGenerationInputSchema, generatedSourceInventorySchema, defaultCourseGenerationModel, type CourseGenerationInput, type GeneratedSourceInventory, type GeneratedCourseDraft, type SourceGenerationJobSnapshot } from "../course-generation-schemas";
import { advanceSourceLearnWork, createSourceLearnWork, sourceLearnWorkSchema } from "../source-learn-work";
import { generationLeaseMs } from "../generation-timeouts";
import { indexSourceDocument, type IndexedSourceDocument } from "../source-document";
import { sourcePlanResultSchema, generatedLearnItemSchema, generatedPreActivitiesSchema, generatedPostActivitiesSchema } from "./response-schemas";
import type { GeneratedPreActivities, GeneratedPostActivities } from "./response-schemas";
import { type GenerationSourceFile } from "./types";
import { generateSourceInventory, generateSourceInventoryPageBatch, finalizeSourceInventory, assignSourceElementIds } from "./source-inventory";
import { generateSourcePlan, generateLearnContentItem, generatePreActivities, generatePostActivities, buildSourceCourseSeed, countGeneratedImagePrompts } from "./source-generation-content";
import { validateLearnItemCoverage } from "./source-coverage";
import type { SourceCoursePlan } from "./types";
import { assembleCourseDraft } from "./course-draft-assembler";
import {
  claimGenerationJob,
  createGenerationJob,
  deleteGenerationCheckpoints,
  findGenerationCheckpoint,
  findGenerationJob,
  generationCheckpointPayload,
  saveGenerationCheckpoint,
  saveLearnWorkCheckpoint,
  updateGenerationCheckpoints,
  updateGenerationJob,
} from "./generation-job-store";

export async function summarizeCourseSource({
  input,
  sourceFile,
}: {
  input: CourseGenerationInput;
  sourceFile: GenerationSourceFile;
}) {
  const model =
    input.model ??
    (process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel);
  const inventory = await generateSourceInventory(input, model, sourceFile);
  if (!inventory.summary.trim())
    throw new DashboardError(
      "The AI provider could not summarize the uploaded source file. Please try again.",
      422,
    );
  return {
    fileName: sourceFile.name,
    sourcePageCount: inventory.sourcePageCount,
    summary: inventory.summary,
    sourceLanguage: inventory.sourceLanguage,
  };
}

const generationJobRetentionMs = 24 * 60 * 60 * 1_000;

export async function createSourceGenerationJob({
  ownerId,
  courseId,
  input,
  sourceFile,
}: {
  ownerId: string;
  courseId: string;
  input: CourseGenerationInput;
  sourceFile: GenerationSourceFile;
}) {
  const job = await createGenerationJob({
    ownerId,
    courseId,
    status: "indexing",
    input,
    sourceFileName: sourceFile.name,
    sourceContentType: sourceFile.contentType,
    sourceBytes: sourceFile.bytes,
    expiresAt: new Date(Date.now() + generationJobRetentionMs),
  });
  return sourceGenerationJobSnapshot(job);
}

export async function startSourceGenerationJob({
  ownerId,
  courseId,
  jobId,
  input,
}: {
  ownerId: string;
  courseId: string;
  jobId: string;
  input: CourseGenerationInput;
}) {
  const job = await findOwnedGenerationJob(ownerId, courseId, jobId);
  if (job.status === "awaitingPrompt") {
    await updateGenerationJob(
      { _id: job._id, ownerId, courseId, status: "awaitingPrompt" },
      { $set: { input, status: "planning", failedStatus: null, errorMessage: null } },
    );
  } else if (job.status === "failed") {
    if (job.failedStatus === "generatingLearn" && /took too long|timed out/i.test(job.errorMessage ?? ""))
      await prepareLearnTimeoutRecovery(job);
    await updateGenerationJob(
      { _id: job._id, ownerId, courseId, status: "failed" },
      { $set: { input, status: job.failedStatus ?? "planning", failedStatus: null, errorMessage: null } },
    );
  } else if (!["planning", "generatingPreActivities", "generatingLearn", "generatingPostActivities", "assembling", "completed"].includes(job.status)) {
    throw new DashboardError("Finish reading the uploaded source before generating the course.", 409);
  }
  return getSourceGenerationJob({ ownerId, courseId, jobId });
}

export async function getLastCompletedSourceGenerationJob({
  ownerId,
  courseId,
}: {
  ownerId: string;
  courseId: string;
}) {
  const job = await findGenerationJob({
    ownerId,
    courseId,
    status: "completed",
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!job) return null;
  return sourceGenerationJobSnapshot(job);
}

export async function getSourceGenerationJob({
  ownerId,
  courseId,
  jobId,
}: {
  ownerId: string;
  courseId: string;
  jobId: string;
}) {
  const job = await findOwnedGenerationJob(ownerId, courseId, jobId);
  return sourceGenerationJobSnapshot(job);
}

export async function cancelSourceGenerationJob({
  ownerId,
  courseId,
  jobId,
}: {
  ownerId: string;
  courseId: string;
  jobId: string;
}) {
  const job = await findOwnedGenerationJob(ownerId, courseId, jobId);
  if (job.status !== "completed") {
    const cancelled = await updateGenerationJob(
      { _id: job._id, ownerId, courseId, status: { $ne: "completed" } },
      { $set: { status: "cancelled", sourceBytes: null, errorMessage: null, leaseUntil: null } },
    );
    if (cancelled.matchedCount > 0) await deleteGenerationCheckpoints({ jobId: job._id, ownerId, courseId });
  }
  return getSourceGenerationJob({ ownerId, courseId, jobId });
}

export async function advanceSourceGenerationJob({
  ownerId,
  courseId,
  jobId,
}: {
  ownerId: string;
  courseId: string;
  jobId: string;
}) {
  const now = new Date();
  const _id = new Types.ObjectId(jobId);
  const claimed = await claimGenerationJob(
    {
      _id,
      ownerId: new Types.ObjectId(ownerId),
      courseId: new Types.ObjectId(courseId),
      status: { $nin: ["completed", "cancelled", "awaitingPrompt"] },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }],
    },
    { $set: { leaseUntil: new Date(now.getTime() + generationLeaseMs) } },
  );
  if (!claimed) {
    const existing = await findGenerationJob({ _id, ownerId, courseId });
    if (!existing) throw new DashboardError("Generation job was not found.", 404);
    if (["completed", "cancelled", "awaitingPrompt"].includes(existing.status))
      return sourceGenerationJobSnapshot(existing);
    if (existing.leaseUntil && existing.leaseUntil > now)
      throw new DashboardError("This generation step is already running. Retry in a moment.", 409);
    throw new DashboardError("This generation job cannot be advanced.", 409);
  }

  const retryTimedOutLearn = claimed.status === "failed"
    && claimed.failedStatus === "generatingLearn"
    && /took too long|timed out/i.test(claimed.errorMessage ?? "");
  if (claimed.status === "failed") {
    await updateGenerationJob(
      { _id, ownerId, courseId, status: "failed" },
      { $set: { status: claimed.failedStatus ?? "extracting", failedStatus: null, errorMessage: null } },
    );
    claimed.status = claimed.failedStatus ?? "extracting";
    claimed.failedStatus = null;
  }

  try {
    const inputResult = courseGenerationInputSchema.safeParse(claimed.input);
    if (!inputResult.success) throw new DashboardError("Stored generation settings are invalid. Start the course generation again.", 422);
    const input = inputResult.data;
    const model = input.model ?? (process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel);
    // Read the hydrated Mongoose Buffer before toObject() converts it to BSON Binary.
    const sourceBytes = claimed.sourceBytes as Buffer | null;
    const job = claimed.toObject() as unknown as {
      _id: Types.ObjectId;
      ownerId: Types.ObjectId;
      courseId: Types.ObjectId;
      status: string;
      sourceFileName: string;
      sourceContentType: GenerationSourceFile["contentType"];
      sourcePageCount: number | null;
      extractionCursor: number;
      learnCursor: number;
      sourceLanguage: string;
      summary: string;
      completedWorkUnits: number;
      totalWorkUnits: number;
      expiresAt: Date;
    };
    const expiry = new Date(Date.now() + generationJobRetentionMs);

    if (retryTimedOutLearn) await prepareLearnTimeoutRecovery(job);
    if (job.status === "indexing") {
      if (!sourceBytes?.length) throw new DashboardError("The temporary source file is missing or empty. Upload it again.", 410);
      const sourceFile: GenerationSourceFile = {
        name: job.sourceFileName,
        contentType: job.sourceContentType,
        bytes: Buffer.from(sourceBytes),
      };
      const indexed = await indexSourceDocument(sourceFile);
      for (let offset = 0; offset < indexed.pages.length; offset += 5) {
        const pages = indexed.pages.slice(offset, offset + 5);
        const firstPage = pages[0]?.pageNumber ?? 0;
        const lastPage = pages.at(-1)?.pageNumber ?? 0;
        await saveGenerationCheckpoint(job, "indexedPages", generationUnitKey(firstPage, lastPage), pages);
      }
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "indexing" },
        {
          $set: {
            status: "extracting",
            sourcePageCount: indexed.pageCount,
            sourceLanguage: indexed.sourceLanguage,
            extractionCursor: 0,
            completedWorkUnits: 0,
            totalWorkUnits: Math.ceil(indexed.pageCount / 5) + 1,
            expiresAt: expiry,
            leaseUntil: null,
          },
        },
      );
    } else if (job.status === "extracting") {
      const pageCount = job.sourcePageCount;
      if (!pageCount) throw new DashboardError("The source page count is missing. Please upload the file again.", 422);
      const batchCount = Math.ceil(pageCount / 5);
      if (job.extractionCursor < batchCount) {
        const firstPage = job.extractionCursor * 5 + 1;
        const lastPage = Math.min(pageCount, firstPage + 4);
        const unitKey = generationUnitKey(firstPage, lastPage);
        let batch = await generationCheckpointPayload(job, "inventoryBatch", unitKey) as { summary: string; pages: GeneratedSourceInventory["pages"] } | null;
        if (!batch) {
          if (!sourceBytes?.length) throw new DashboardError("The temporary source file is missing or empty during extraction.", 410);
          const indexedPages = await generationCheckpointPayload(job, "indexedPages", unitKey) as IndexedSourceDocument["pages"] | null;
          if (!indexedPages || indexedPages.length !== lastPage - firstPage + 1)
            throw new DashboardError("A deterministic source page index is missing. Retry source indexing.", 422);
          batch = await generateSourceInventoryPageBatch(
            input,
            model,
            { name: job.sourceFileName, contentType: job.sourceContentType, bytes: Buffer.from(sourceBytes) },
            indexedPages,
            pageCount,
          );
          await saveGenerationCheckpoint(job, "inventoryBatch", unitKey, batch);
        }
        await updateGenerationJob(
          { _id: job._id, ownerId, courseId, status: "extracting" },
          {
            $inc: { extractionCursor: 1, completedWorkUnits: 1 },
            $set: { expiresAt: expiry, leaseUntil: null },
          },
        );
      } else {
        const inventoryBatches = await loadGenerationInventoryBatches(job);
        const inventory = await finalizeSourceInventory(
          input,
          model,
          pageCount,
          job.sourceLanguage,
          inventoryBatches.flatMap((batch) => batch.pages),
          inventoryBatches.map((batch) => batch.summary),
        );
        await updateGenerationJob(
          { _id: job._id, ownerId, courseId, status: "extracting" },
          {
            $set: {
              status: "awaitingPrompt",
              summary: inventory.summary,
              sourceLanguage: inventory.sourceLanguage,
              sourceBytes: null,
              completedWorkUnits: job.completedWorkUnits + 1,
              expiresAt: expiry,
              leaseUntil: null,
            },
          },
        );
        await deleteGenerationCheckpoints({ jobId: job._id, ownerId, courseId, stage: "indexedPages" });
      }
    } else if (job.status === "planning") {
      const inventory = await loadGenerationSourceInventory(job);
      let plan = await generationCheckpointPayload(job, "plan", "course") as SourceCoursePlan | null;
      if (!plan) {
        plan = await generateSourcePlan(input, model, inventory);
        await saveGenerationCheckpoint(job, "plan", "course", plan);
      } else {
        plan = (await loadGenerationPlan(job)) as SourceCoursePlan;
      }
      const upcomingUnits = 1 + (input.template === "preLearnPost" ? 1 : 0) + plan.items.length + (input.template === "preLearnPost" ? 1 : 0) + 1;
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "planning" },
        {
          $set: {
            status: input.template === "preLearnPost" ? "generatingPreActivities" : "generatingLearn",
            totalWorkUnits: job.completedWorkUnits + upcomingUnits,
            expiresAt: expiry,
            leaseUntil: null,
          },
          $inc: { completedWorkUnits: 1 },
        },
      );
    } else if (job.status === "generatingPreActivities") {
      const inventory = await loadGenerationSourceInventory(job);
      const plan = await loadGenerationPlan(job);
      let activities = await generationCheckpointPayload(job, "preActivities", "course") as GeneratedPreActivities | null;
      if (!activities) {
        activities = await generatePreActivities(input, model, plan, inventory);
        await saveGenerationCheckpoint(job, "preActivities", "course", activities);
      } else {
        const parsed = generatedPreActivitiesSchema.safeParse(activities);
        if (!parsed.success) throw new DashboardError("Saved pre-activity checkpoint is invalid. Retry this stage.", 422);
        activities = parsed.data;
      }
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "generatingPreActivities" },
        { $set: { status: "generatingLearn", expiresAt: expiry, leaseUntil: null }, $inc: { completedWorkUnits: 1 } },
      );
    } else if (job.status === "generatingLearn") {
      const inventory = await loadGenerationSourceInventory(job);
      const plan = await loadGenerationPlan(job);
      const item = plan.items[job.learnCursor];
      if (!item) throw new DashboardError("The Learn item cursor is outside the course plan.", 422);
      let generated = await generationCheckpointPayload(job, "learnItem", String(job.learnCursor).padStart(3, "0")) as {
        lesson: z.infer<typeof generatedLearnItemSchema>;
        coverageIssues: string[];
      } | null;
      if (!generated) {
        const completedItems: z.infer<typeof generatedLearnItemSchema>[] = [];
        for (let index = 0; index < job.learnCursor; index += 1) {
          const completed = await generationCheckpointPayload(job, "learnItem", String(index).padStart(3, "0")) as {
            lesson: z.infer<typeof generatedLearnItemSchema>;
            coverageIssues: string[];
          } | null;
          if (completed) completedItems.push(completed.lesson);
        }
        const imagesRemaining = Math.max(0, (input.includeImages ? 8 : 0) - countGeneratedImagePrompts(completedItems));
        const unitKey = String(job.learnCursor).padStart(3, "0");
        const pages = inventory.pages.filter((page) => page.pageNumber >= item.startPage && page.pageNumber <= item.endPage);
        const work = await advanceSourceLearnWork({
          pages,
          savedWork: await generationCheckpointPayload(job, "learnWork", unitKey),
          loadPart: async (key) => {
            const saved = await generationCheckpointPayload(job, "learnPart", `${unitKey}:${key}`);
            if (saved === null) return null;
            const parsed = z.object({ lesson: generatedLearnItemSchema, coverageIssues: z.array(z.string()) }).safeParse(saved);
            if (!parsed.success) throw new DashboardError("A saved Learn part is invalid. Retry this lesson.", 422);
            return parsed.data;
          },
          savePart: (key, result) => saveGenerationCheckpoint(job, "learnPart", `${unitKey}:${key}`, result),
          saveWork: (pending) => saveLearnWorkCheckpoint(job, unitKey, pending),
          generatePart: async (partPages, completedParts) => {
            const partItem = {
              ...item,
              startPage: partPages[0].pageNumber,
              endPage: partPages.at(-1)!.pageNumber,
              sourceElementIds: partPages.flatMap((page) => page.elements.map((element) => element.sourceElementId)),
            };
            const generatedItem = await generateLearnContentItem({
              input, model, plan, item: partItem,
              inventory: { ...inventory, pages: partPages },
              imagesRemaining: Math.max(0, imagesRemaining - countGeneratedImagePrompts(completedParts.map((part) => part.lesson))),
              previousLearningBlocks: [...completedItems, ...completedParts.map((part) => part.lesson)].flatMap((lesson) => lesson.blocks),
            });
            if (!generatedItem.lesson)
              throw new DashboardError(`Learn content “${item.title}” failed validation after its targeted retry.`, 422);
            return { lesson: generatedItem.lesson, coverageIssues: generatedItem.coverageIssues };
          },
        });
        if (work.results) {
          const parts = work.results;
          const lesson = generatedLearnItemSchema.parse(parts.length === 1 ? parts[0].lesson : {
            title: item.title,
            objective: item.focus,
            summary: parts.map((part) => part.lesson.summary).join("\n\n").slice(0, 5_000),
            blocks: parts.flatMap((part) => part.lesson.blocks),
          });
          generated = {
            lesson,
            coverageIssues: [...new Set([...parts.flatMap((part) => part.coverageIssues), ...validateLearnItemCoverage(lesson, pages)])],
          };
          await saveGenerationCheckpoint(job, "learnItem", unitKey, generated);
        }
      }
      const nextCursor = job.learnCursor + Number(Boolean(generated));
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "generatingLearn" },
        {
          $set: {
            learnCursor: nextCursor,
            status: nextCursor >= plan.items.length
              ? (input.template === "preLearnPost" ? "generatingPostActivities" : "assembling")
              : "generatingLearn",
            expiresAt: expiry,
            leaseUntil: null,
          },
          $inc: { completedWorkUnits: Number(Boolean(generated)) },
        },
      );
    } else if (job.status === "generatingPostActivities") {
      const inventory = await loadGenerationSourceInventory(job);
      const plan = await loadGenerationPlan(job);
      const learnItems = await loadGenerationLearnItems(job, plan.items.length);
      let activities = await generationCheckpointPayload(job, "postActivities", "course") as GeneratedPostActivities | null;
      if (!activities) {
        activities = await generatePostActivities(
          input,
          model,
          plan,
          inventory,
          learnItems.map(({ lesson }) => ({ title: lesson.title, objective: lesson.objective, summary: lesson.summary })),
        );
        await saveGenerationCheckpoint(job, "postActivities", "course", activities);
      } else {
        const parsed = generatedPostActivitiesSchema.safeParse(activities);
        if (!parsed.success) throw new DashboardError("Saved post-activity checkpoint is invalid. Retry this stage.", 422);
        activities = parsed.data;
      }
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "generatingPostActivities" },
        { $set: { status: "assembling", expiresAt: expiry, leaseUntil: null }, $inc: { completedWorkUnits: 1 } },
      );
    } else if (job.status === "assembling") {
      const existingResult = await generationCheckpointPayload(job, "result", "course") as GeneratedCourseDraft | null;
      if (existingResult) {
        await updateGenerationJob(
          { _id: job._id, ownerId, courseId, status: "assembling" },
          {
            $set: {
              status: "completed",
              sourceBytes: null,
              completedWorkUnits: job.completedWorkUnits + 1,
              totalWorkUnits: job.completedWorkUnits + 1,
              expiresAt: expiry,
              leaseUntil: null,
              errorMessage: null,
            },
          },
        );
      } else {
      const inventory = await loadGenerationSourceInventory(job);
      const plan = await loadGenerationPlan(job);
      const learnItems = await loadGenerationLearnItems(job, plan.items.length);
      const preActivities = input.template === "preLearnPost"
        ? await generationCheckpointPayload(job, "preActivities", "course") as GeneratedPreActivities
        : { keyTerms: [], preTest: [] };
      const postActivities = input.template === "preLearnPost"
        ? await generationCheckpointPayload(job, "postActivities", "course") as GeneratedPostActivities
        : {
            postTest: [],
            lessonSummary: learnItems.map(({ lesson }) => lesson.summary).join("\n\n"),
            nextLesson: "Continue learning",
          };
      const generated = buildSourceCourseSeed(
        input,
        plan,
        preActivities,
        learnItems.map(({ lesson }) => lesson),
        learnItems.map(({ coverageIssues }) => coverageIssues),
        postActivities,
      );
      const course = await assembleCourseDraft({
        ownerId,
        courseId,
        input,
        seed: generated.seed,
        sourceInventory: inventory,
        sourcePlan: plan,
        coverageIssuesByItem: generated.coverageIssuesByItem,
      });
      await saveGenerationCheckpoint(job, "result", "course", course);
      await updateGenerationJob(
        { _id: job._id, ownerId, courseId, status: "assembling" },
        {
          $set: {
            status: "completed",
            sourceBytes: null,
            completedWorkUnits: job.completedWorkUnits + 1,
            totalWorkUnits: job.completedWorkUnits + 1,
            expiresAt: expiry,
            leaseUntil: null,
            errorMessage: null,
          },
        },
      );
      }
    }

    await updateGenerationCheckpoints({ jobId: job._id, ownerId, courseId }, { $set: { expiresAt: expiry } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Course generation failed. Please retry this stage.";
    console.error("Resumable source generation stage failed", { jobId: claimed._id.toString(), status: claimed.status, message });
    await updateGenerationJob(
      { _id, ownerId, courseId, status: { $ne: "cancelled" } },
      {
        $set: {
          status: "failed",
          failedStatus: claimed.status === "failed" ? "extracting" : claimed.status,
          errorMessage: message.slice(0, 2_000),
          leaseUntil: null,
          expiresAt: new Date(Date.now() + generationJobRetentionMs),
        },
      },
    );
  } finally {
    await updateGenerationJob({ _id, ownerId, courseId }, { $set: { leaseUntil: null } });
  }
  const finalJob = await getSourceGenerationJob({ ownerId, courseId, jobId });
  if (finalJob.status === "cancelled") await deleteGenerationCheckpoints({ jobId: _id, ownerId, courseId });
  return finalJob;
}

async function findOwnedGenerationJob(ownerId: string, courseId: string, jobId: string) {
  if (!Types.ObjectId.isValid(jobId)) throw new DashboardError("Invalid generation job identifier.", 400);
  const job = await findGenerationJob({ _id: jobId, ownerId, courseId });
  if (!job) throw new DashboardError("Generation job was not found.", 404);
  return job;
}

async function sourceGenerationJobSnapshot(job: {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  courseId: Types.ObjectId;
  status: string;
  sourceFileName: string;
  sourcePageCount: number | null;
  sourceLanguage: string;
  summary: string;
  completedWorkUnits: number;
  totalWorkUnits: number;
  errorMessage: string | null;
  learnCursor?: number;
}) {
  const snapshot: SourceGenerationJobSnapshot = {
    jobId: job._id.toString(),
    status: job.status,
    fileName: job.sourceFileName,
    sourcePageCount: job.sourcePageCount,
    sourceLanguage: job.sourceLanguage,
    summary: job.summary,
    completedWorkUnits: job.completedWorkUnits,
    totalWorkUnits: job.totalWorkUnits,
    errorMessage: job.errorMessage,
  };
  if (job.status === "awaitingPrompt") {
    const inventory = await loadGenerationSourceInventory(job);
    const uncertain = inventory.pages.filter((page) => page.elements.some((element) => element.uncertainContent)).map((page) => page.pageNumber);
    if (uncertain.length) snapshot.uncertainSourcePages = uncertain;
  }
  if (job.status === "generatingLearn" && job.learnCursor !== undefined) {
    const work = sourceLearnWorkSchema.safeParse(await generationCheckpointPayload(job, "learnWork", String(job.learnCursor).padStart(3, "0")));
    if (work.success && work.data.parts.length > 1)
      snapshot.learnProgress = { completedParts: work.data.completedPartKeys.length, totalParts: work.data.parts.length };
  }
  if (job.status === "completed") {
    const result = (await findGenerationCheckpoint({
      jobId: job._id,
      ownerId: job.ownerId,
      courseId: job.courseId,
      stage: "result",
      unitKey: "course",
    }).lean()) as unknown as { payload?: unknown } | null;
    if (result?.payload) snapshot.course = result.payload as GeneratedCourseDraft;
  }
  return snapshot;
}

async function prepareLearnTimeoutRecovery(job: {
  _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId;
  expiresAt: Date; learnCursor: number; sourcePageCount: number | null;
  sourceLanguage: string; summary: string;
}) {
  const unitKey = String(job.learnCursor).padStart(3, "0");
  if (await generationCheckpointPayload(job, "learnItem", unitKey)
    || await generationCheckpointPayload(job, "learnWork", unitKey)) return;
  const inventory = await loadGenerationSourceInventory(job);
  const plan = await loadGenerationPlan(job);
  const item = plan.items[job.learnCursor];
  if (!item) throw new DashboardError("The Learn item cursor is outside the course plan.", 422);
  const pages = inventory.pages.filter((page) => page.pageNumber >= item.startPage && page.pageNumber <= item.endPage);
  await saveLearnWorkCheckpoint(job, unitKey, createSourceLearnWork(pages, true));
}

function generationUnitKey(firstPage: number, lastPage: number) {
  return `${String(firstPage).padStart(4, "0")}-${String(lastPage).padStart(4, "0")}`;
}

async function loadGenerationInventoryBatches(job: {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  courseId: Types.ObjectId;
  sourcePageCount: number | null;
}) {
  if (!job.sourcePageCount) throw new DashboardError("The source page count is missing.", 422);
  const batches: { summary: string; pages: GeneratedSourceInventory["pages"] }[] = [];
  for (let offset = 0; offset < job.sourcePageCount; offset += 5) {
    const firstPage = offset + 1;
    const lastPage = Math.min(job.sourcePageCount, firstPage + 4);
    const batch = await generationCheckpointPayload(job, "inventoryBatch", generationUnitKey(firstPage, lastPage));
    if (!batch || typeof batch !== "object" || !("pages" in batch) || !Array.isArray(batch.pages))
      throw new DashboardError(`Source inventory batch ${firstPage}-${lastPage} is missing. Retry source extraction.`, 422);
    batches.push(batch as { summary: string; pages: GeneratedSourceInventory["pages"] });
  }
  return batches;
}

export async function loadGenerationSourceInventory(job: {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  courseId: Types.ObjectId;
  sourcePageCount: number | null;
  sourceLanguage: string;
  summary: string;
}) {
  if (!job.sourcePageCount) throw new DashboardError("The source page count is missing.", 422);
  const batches = await loadGenerationInventoryBatches(job);
  const parsed = generatedSourceInventorySchema.safeParse({
    sourcePageCount: job.sourcePageCount,
    sourceLanguage: job.sourceLanguage,
    summary: job.summary,
    pages: assignSourceElementIds(batches.flatMap((batch) => batch.pages)),
  });
  if (!parsed.success) throw new DashboardError("Stored source inventory did not pass validation. Retry extraction.", 422);
  return parsed.data;
}

async function loadGenerationPlan(job: { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId }) {
  const plan = await generationCheckpointPayload(job, "plan", "course");
  const parsed = sourcePlanResultSchema.safeParse(plan);
  if (!parsed.success) throw new DashboardError("The stored course plan is missing or invalid. Retry planning.", 422);
  return parsed.data as SourceCoursePlan;
}

async function loadGenerationLearnItems(
  job: { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId },
  count: number,
) {
  const items: { lesson: z.infer<typeof generatedLearnItemSchema>; coverageIssues: string[] }[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = await generationCheckpointPayload(job, "learnItem", String(index).padStart(3, "0"));
    if (!value || typeof value !== "object" || !("lesson" in value) || !("coverageIssues" in value))
      throw new DashboardError(`Learn item ${index + 1} is missing its saved checkpoint. Retry that item.`, 422);
    const parsed = generatedLearnItemSchema.safeParse(value.lesson);
    if (!parsed.success || !Array.isArray(value.coverageIssues))
      throw new DashboardError(`Learn item ${index + 1} failed checkpoint validation. Retry that item.`, 422);
    items.push({ lesson: parsed.data, coverageIssues: value.coverageIssues as string[] });
  }
  return items;
}
