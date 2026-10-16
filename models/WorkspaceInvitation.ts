import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const WorkspaceInvitationSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  inviterId: { type: Schema.Types.ObjectId, required: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, enum: ["admin", "editor", "viewer"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

WorkspaceInvitationSchema.index({ workspaceId: 1, email: 1, acceptedAt: 1, revokedAt: 1 });
WorkspaceInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type WorkspaceInvitationDocument = InferSchemaType<typeof WorkspaceInvitationSchema>;
export const WorkspaceInvitation = (models.WorkspaceInvitation as Model<WorkspaceInvitationDocument> | undefined) ?? model<WorkspaceInvitationDocument>("WorkspaceInvitation", WorkspaceInvitationSchema);
