import { Schema, model, models } from "mongoose";

const GenerationCheckpointSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, required: true },
  ownerId: { type: Schema.Types.ObjectId, required: true },
  courseId: { type: Schema.Types.ObjectId, required: true },
  stage: { type: String, required: true, maxlength: 40 },
  unitKey: { type: String, required: true, maxlength: 120 },
  payload: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

GenerationCheckpointSchema.index({ jobId: 1, stage: 1, unitKey: 1 }, { unique: true });
GenerationCheckpointSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GenerationCheckpoint = models.GenerationCheckpoint ?? model("GenerationCheckpoint", GenerationCheckpointSchema);
