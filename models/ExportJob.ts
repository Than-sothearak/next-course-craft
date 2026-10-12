import { Schema, model, models } from "mongoose";

const ExportJobSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  snapshotRevision: { type: Number, required: true, min: 0 },
  format: { type: String, enum: ["html5", "scorm12"], required: true },
  status: { type: String, enum: ["queued", "processing", "complete", "failed"], default: "queued", index: true },
  resultFileKey: { type: String, default: null },
  errorDetails: { type: String, default: null },
}, { timestamps: true });
ExportJobSchema.index({ status: 1, createdAt: 1 });
export const ExportJob = models.ExportJob ?? model("ExportJob", ExportJobSchema);
