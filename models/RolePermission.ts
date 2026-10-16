import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { permissionIds } from "@/lib/auth/policy";

const schema = new Schema({
  role: { type: String, enum: ["admin", "editor", "viewer"], required: true, unique: true },
  permissions: { type: [{ type: String, enum: permissionIds }], required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export type RolePermissionDocument = InferSchemaType<typeof schema>;
export const RolePermission = (models.RolePermission as Model<RolePermissionDocument> | undefined) ?? model<RolePermissionDocument>("RolePermission", schema);
