import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { accountStatuses, permissionIds, platformRoles } from "@/lib/auth/policy";

const UserSchema = new Schema({
  name: { type: String, trim: true, maxlength: 160 },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  emailVerified: { type: Date, default: null },
  image: { type: String, default: null },
  role: { type: String, enum: platformRoles, default: "viewer", required: true },
  status: { type: String, enum: accountStatuses, default: "pending", required: true },
  permissions: { type: [{ type: String, enum: permissionIds }], default: undefined },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  suspendedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, maxlength: 1000, default: "" },
  lastLoginAt: { type: Date, default: null },
  legacyRole: { type: String },
  deletedAt: { type: Date, default: null },
  preferences: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

UserSchema.index({ status: 1, createdAt: -1 });
UserSchema.index({ role: 1, status: 1 });
export type UserDocument = InferSchemaType<typeof UserSchema>;
export const User = (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", UserSchema);
