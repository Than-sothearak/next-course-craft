import { Schema, model, models } from "mongoose";

const AssetSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, default: null, index: true },
  objectKey: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  checksum: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export const Asset = models.Asset ?? model("Asset", AssetSchema);
