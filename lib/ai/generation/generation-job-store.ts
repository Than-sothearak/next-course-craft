import { Types, type FilterQuery, type UpdateQuery } from "mongoose";
import { GenerationJob } from "@/models/GenerationJob";
import { GenerationCheckpoint } from "@/models/GenerationCheckpoint";
import type { SourceLearnWork } from "../source-learn-work";
import { checkpointPayloadForStorage, restoreGenerationImageFields } from "./checkpoint-payload";
import { logGenerationProgress, type GenerationProgressStatus } from "./progress-log";

type GenerationJobFilter = FilterQuery<Record<string, unknown>>;
type GenerationJobUpdate = UpdateQuery<Record<string, unknown>>;
type GenerationCheckpointFilter = FilterQuery<Record<string, unknown>>;
type GenerationCheckpointUpdate = UpdateQuery<Record<string, unknown>>;

export async function createGenerationJob(input: Parameters<typeof GenerationJob.create>[0]) {
  const job = await GenerationJob.create(input);
  logGenerationProgress({
    status: "STARTED",
    task: "Read uploaded source document",
    courseId: String(input.courseId),
    jobId: String(job._id),
  });
  return job;
}

export function findGenerationJob(filter: GenerationJobFilter) {
  return GenerationJob.findOne(filter);
}

export function findLastCompletedGenerationJob(ownerId: string, courseId: string) {
  return GenerationJob.findOne({ ownerId, courseId, status: "completed" })
    .sort({ updatedAt: -1, createdAt: -1 });
}

export async function updateGenerationJob(filter: GenerationJobFilter, update: GenerationJobUpdate) {
  const result = await GenerationJob.updateOne(filter, update);
  const updateFields = update as { $set?: Record<string, unknown> };
  const status = updateFields.$set?.status;
  if (result.matchedCount > 0 && typeof status === "string") {
    const taskByStatus: Record<string, { status: GenerationProgressStatus; task: string }> = {
      indexing: { status: "IN PROGRESS", task: "Index uploaded source pages" },
      extracting: { status: "IN PROGRESS", task: "Extract source content" },
      awaitingPrompt: { status: "WAITING", task: "Source is ready; waiting for course instructions" },
      planning: { status: "IN PROGRESS", task: "Plan course lessons" },
      generatingPreActivities: { status: "IN PROGRESS", task: "Generate keywords and the pre-lesson quiz" },
      generatingLearn: { status: "IN PROGRESS", task: "Generate lesson content" },
      generatingPostActivities: { status: "IN PROGRESS", task: "Generate the post-lesson quiz and summary" },
      assembling: { status: "IN PROGRESS", task: "Assemble course and save generated images" },
      completed: { status: "DONE", task: "Course generation completed" },
      failed: { status: "FAILED", task: "Course generation failed" },
      cancelled: { status: "CANCELLED", task: "Course generation cancelled" },
    };
    const event = taskByStatus[status] ?? { status: "IN PROGRESS" as const, task: `Continue generation (${status})` };
    const filterFields = filter as Record<string, unknown>;
    const set = updateFields.$set ?? {};
    const cursor = typeof set.learnCursor === "number" ? set.learnCursor : undefined;
    const asId = (value: unknown) => typeof value === "string" || value instanceof Types.ObjectId ? String(value) : undefined;
    logGenerationProgress({
      ...event,
      courseId: asId(filterFields.courseId),
      jobId: asId(filterFields._id),
      detail: cursor === undefined ? undefined : `Completed lessons: ${cursor}`,
    });
  }
  return result;
}

export function claimGenerationJob(filter: GenerationJobFilter, update: GenerationJobUpdate) {
  return GenerationJob.findOneAndUpdate(filter, update, { new: true });
}

export function findGenerationCheckpoint(filter: GenerationCheckpointFilter) {
  return GenerationCheckpoint.findOne(filter);
}

export function upsertGenerationCheckpoint(filter: GenerationCheckpointFilter, update: GenerationCheckpointUpdate) {
  return GenerationCheckpoint.updateOne(filter, update, { upsert: true });
}

export function deleteGenerationCheckpoints(filter: Parameters<typeof GenerationCheckpoint.deleteMany>[0]) {
  return GenerationCheckpoint.deleteMany(filter);
}

export function updateGenerationCheckpoints(filter: Parameters<typeof GenerationCheckpoint.updateMany>[0], update: Parameters<typeof GenerationCheckpoint.updateMany>[1]) {
  return GenerationCheckpoint.updateMany(filter, update);
}

export async function saveGenerationCheckpoint(
  job: { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId; expiresAt: Date },
  stage: string,
  unitKey: string,
  payload: unknown,
) {
  await GenerationCheckpoint.updateOne(
    { jobId: job._id, ownerId: job.ownerId, courseId: job.courseId, stage, unitKey },
    {
      $setOnInsert: {
        jobId: job._id,
        ownerId: job.ownerId,
        courseId: job.courseId,
        stage,
        unitKey,
        payload: checkpointPayloadForStorage(payload),
        expiresAt: job.expiresAt,
      },
    },
    { upsert: true },
  );
}

export async function saveLearnWorkCheckpoint(
  job: { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId; expiresAt: Date },
  unitKey: string,
  payload: SourceLearnWork,
) {
  await GenerationCheckpoint.updateOne(
    { jobId: job._id, ownerId: job.ownerId, courseId: job.courseId, stage: "learnWork", unitKey },
    {
      $set: { payload: checkpointPayloadForStorage(payload), expiresAt: job.expiresAt },
      $setOnInsert: { jobId: job._id, ownerId: job.ownerId, courseId: job.courseId, stage: "learnWork", unitKey },
    },
    { upsert: true },
  );
}

export async function generationCheckpointPayload(
  job: { _id: Types.ObjectId; ownerId: Types.ObjectId; courseId: Types.ObjectId },
  stage: string,
  unitKey: string,
) {
  const checkpoint = await GenerationCheckpoint.findOne({
    jobId: job._id,
    ownerId: job.ownerId,
    courseId: job.courseId,
    stage,
    unitKey,
  }).lean() as { payload?: unknown } | null;
  return checkpoint?.payload == null ? null : restoreGenerationImageFields(checkpoint.payload);
}
