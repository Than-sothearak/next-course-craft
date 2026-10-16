import { z } from "zod";
import { accountStatuses, permissionIds, platformRoles } from "@/lib/auth/policy";

export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
const expectedUpdatedAt = z.iso.datetime();
export const userMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), role: z.enum(platformRoles), expectedUpdatedAt }).strict(),
  z.object({ action: z.literal("reject"), expectedUpdatedAt }).strict(),
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(1).max(1000), expectedUpdatedAt }).strict(),
  z.object({ action: z.literal("reactivate"), expectedUpdatedAt }).strict(),
  z.object({ action: z.literal("role"), role: z.enum(platformRoles), expectedUpdatedAt }).strict(),
  z.object({ action: z.literal("delete"), confirmEmail: z.email(), expectedUpdatedAt }).strict(),
]);
export type UserMutation = z.infer<typeof userMutationSchema>;
export const roleMutationSchema = z.object({ role: z.enum(["admin", "editor", "viewer"]), permissions: z.array(z.enum(permissionIds)).max(permissionIds.length) }).strict();
export const settingsSchema = z.object({ aiEnabled: z.boolean() }).strict();
export const courseMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive") }).strict(),
  z.object({ action: z.literal("restore") }).strict(),
  z.object({ action: z.literal("delete"), confirmTitle: z.string().min(1).max(160) }).strict(),
  z.object({ action: z.literal("transfer"), email: z.email().trim().toLowerCase(), confirmTitle: z.string().min(1).max(160) }).strict(),
]);
export const assignmentSchema = z.object({ email: z.email().trim().toLowerCase(), role: z.enum(["editor", "viewer"]) }).strict();
export const removeAssignmentSchema = z.object({ userId: idSchema }).strict();
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(100).default(""),
  role: z.enum(platformRoles).optional(),
  status: z.enum(accountStatuses).optional(),
  courseStatus: z.enum(["draft", "published", "archived", "deleted"]).optional(),
  ownerId: idSchema.optional(),
  actorId: idSchema.optional(),
  action: z.string().trim().max(80).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
