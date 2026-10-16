import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const WorkspaceMembershipSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ["admin", "editor", "viewer"], required: true, default: "editor" },
}, { timestamps: true });

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMembershipSchema.index({ userId: 1, workspaceId: 1 });

export type WorkspaceMembershipDocument = InferSchemaType<typeof WorkspaceMembershipSchema>;
export const WorkspaceMembership = (models.WorkspaceMembership as Model<WorkspaceMembershipDocument> | undefined) ?? model<WorkspaceMembershipDocument>("WorkspaceMembership", WorkspaceMembershipSchema);
