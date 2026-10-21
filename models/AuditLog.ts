import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true, maxlength: 80 },
  targetType: { type: String, enum: ["user", "course", "workspace", "role", "settings"], required: true },
  targetId: { type: Schema.Types.ObjectId, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ actorId: 1, createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });
schema.index({ targetId: 1, createdAt: -1 });
export type AuditLogDocument = InferSchemaType<typeof schema>;
export const AuditLog = (models.AuditLog as Model<AuditLogDocument> | undefined) ?? model<AuditLogDocument>("AuditLog", schema);
