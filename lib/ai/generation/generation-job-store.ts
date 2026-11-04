import { Types, type FilterQuery, type UpdateQuery } from "mongoose";
import { GenerationJob } from "@/models/GenerationJob";
import { GenerationCheckpoint } from "@/models/GenerationCheckpoint";
import type { SourceLearnWork } from "../source-learn-work";

type GenerationJobFilter = FilterQuery<Record<string, unknown>>;
type GenerationJobUpdate = UpdateQuery<Record<string, unknown>>;
type GenerationCheckpointFilter = FilterQuery<Record<string, unknown>>;
type GenerationCheckpointUpdate = UpdateQuery<Record<string, unknown>>;

export function createGenerationJob(input: Parameters<typeof GenerationJob.create>[0]) {
  return GenerationJob.create(input);
}

export function findGenerationJob(filter: GenerationJobFilter) {
  return GenerationJob.findOne(filter);
}

export function findLastCompletedGenerationJob(ownerId: string, courseId: string) {
  return GenerationJob.findOne({ ownerId, courseId, status: "completed" })
    .sort({ updatedAt: -1, createdAt: -1 });
}

export function updateGenerationJob(filter: GenerationJobFilter, update: GenerationJobUpdate) {
  return GenerationJob.updateOne(filter, update);
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
        payload,
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
      $set: { payload, expiresAt: job.expiresAt },
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
  return checkpoint?.payload ?? null;
}
