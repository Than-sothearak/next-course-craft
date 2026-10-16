import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const FolderSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  normalizedName: { type: String, required: true, lowercase: true, trim: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, default: null, index: true },
  parentId: { type: Schema.Types.ObjectId, default: null, index: true },
}, { timestamps: true });
FolderSchema.index({ ownerId: 1, workspaceId: 1, parentId: 1, normalizedName: 1 }, { unique: true });
export type FolderDocument = InferSchemaType<typeof FolderSchema>;
export const Folder = (models.Folder as Model<FolderDocument> | undefined) ?? model<FolderDocument>("Folder", FolderSchema);
