import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  _id: { type: String, default: "platform" },
  aiEnabled: { type: Boolean, default: true, required: true },
  mediaStorageProvider: { type: String, enum: ["local", "s3"], default: "s3", required: true },
  mediaStorageRevision: { type: Number, default: 0, min: 0, required: true },
  mediaLocalDirectory: { type: String, maxlength: 4096, default: null },
}, { timestamps: true });
export type PlatformSettingsDocument = InferSchemaType<typeof schema>;
export const PlatformSettings = (models.PlatformSettings as Model<PlatformSettingsDocument> | undefined) ?? model<PlatformSettingsDocument>("PlatformSettings", schema);
