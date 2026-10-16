import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  _id: { type: String, default: "platform" },
  aiEnabled: { type: Boolean, default: true, required: true },
}, { timestamps: true });
export type PlatformSettingsDocument = InferSchemaType<typeof schema>;
export const PlatformSettings = (models.PlatformSettings as Model<PlatformSettingsDocument> | undefined) ?? model<PlatformSettingsDocument>("PlatformSettings", schema);
