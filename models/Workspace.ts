import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const WorkspaceSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

WorkspaceSchema.index({ ownerId: 1, createdAt: -1 });

export type WorkspaceDocument = InferSchemaType<typeof WorkspaceSchema>;
export const Workspace = (models.Workspace as Model<WorkspaceDocument> | undefined) ?? model<WorkspaceDocument>("Workspace", WorkspaceSchema);
