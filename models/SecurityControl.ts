import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  _id: { type: String, default: "platform" },
  revision: { type: Number, default: 0 },
  bootstrapUserId: { type: Schema.Types.ObjectId, default: null },
}, { timestamps: true });
export type SecurityControlDocument = InferSchemaType<typeof schema>;
export const SecurityControl = (models.SecurityControl as Model<SecurityControlDocument> | undefined) ?? model<SecurityControlDocument>("SecurityControl", schema);
