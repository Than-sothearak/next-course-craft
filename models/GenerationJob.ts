import { Schema, model, models } from "mongoose";

const GenerationJobSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true },
  courseId: { type: Schema.Types.ObjectId, required: true },
  status: {
    type: String,
    enum: [
      "indexing",
      "extracting",
      "awaitingPrompt",
      "planning",
      "generatingPreActivities",
      "generatingLearn",
      "generatingPostActivities",
      "assembling",
      "completed",
      "failed",
      "cancelled",
    ],
    required: true,
    default: "indexing",
    index: true,
  },
  failedStatus: { type: String, default: null },
  input: { type: Schema.Types.Mixed, required: true },
  sourceFileName: { type: String, required: true, maxlength: 255 },
  sourceContentType: {
    type: String,
    enum: ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    required: true,
  },
  sourceBytes: { type: Buffer, default: null },
  sourcePageCount: { type: Number, min: 1, max: 500, default: null },
  extractionCursor: { type: Number, min: 0, default: 0 },
  learnCursor: { type: Number, min: 0, default: 0 },
  sourceLanguage: { type: String, maxlength: 80, default: "unknown" },
  summary: { type: String, maxlength: 5_000, default: "" },
  completedWorkUnits: { type: Number, min: 0, default: 0 },
  totalWorkUnits: { type: Number, min: 0, default: 0 },
  errorMessage: { type: String, maxlength: 2_000, default: null },
  leaseUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

GenerationJobSchema.index({ ownerId: 1, courseId: 1, createdAt: -1 });
GenerationJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GenerationJob = models.GenerationJob ?? model("GenerationJob", GenerationJobSchema);
