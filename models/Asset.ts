import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const AssetSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, default: null, index: true },
  objectKey: { type: String, required: true, unique: true },
  // No provider default: historical records must always resolve to S3.
  storageProvider: { type: String, enum: ["local", "s3"], immutable: true },
  storageKey: { type: String, immutable: true },
  storageDirectory: { type: String, maxlength: 4096, immutable: true },
  originalName: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "ready"], default: "pending", index: true },
  checksum: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
AssetSchema.index({ ownerId: 1, courseId: 1, status: 1, createdAt: -1 });
AssetSchema.index({ storageProvider: 1, storageKey: 1 });
export type AssetDocument = InferSchemaType<typeof AssetSchema>;
export const Asset = (models.Asset as Model<AssetDocument> | undefined) ?? model<AssetDocument>("Asset", AssetSchema);
