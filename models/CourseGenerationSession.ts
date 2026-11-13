import { Schema, model, models } from "mongoose";

const schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true },
  courseId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ["outline", "generating", "completed", "cancelled"], default: "outline", required: true },
  input: { type: Schema.Types.Mixed, required: true },
  outline: { type: Schema.Types.Mixed, required: true },
  cover: { type: Schema.Types.Mixed, default: null },
  generatedCover: { type: Boolean, default: false },
  coverWarning: { type: String, maxlength: 1_000, default: null },
  sourcePlan: { type: Schema.Types.Mixed, default: null },
  sourceJobId: { type: Schema.Types.ObjectId, default: null },
  error: { type: String, maxlength: 2_000, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ ownerId: 1, courseId: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const CourseGenerationSession = models.CourseGenerationSession ?? model("CourseGenerationSession", schema);
