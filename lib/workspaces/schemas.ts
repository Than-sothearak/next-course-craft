import { z } from "zod";

export const workspaceIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid workspace identifier.");
export const workspaceNameSchema = z.string().trim().min(1, "Enter a workspace name.").max(120, "Workspace names must be 120 characters or fewer.");

export const createWorkspaceSchema = z.object({ name: workspaceNameSchema });
export const createWorkspaceInvitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});
export const updateWorkspaceMembershipSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>;
export type UpdateWorkspaceMembershipInput = z.infer<typeof updateWorkspaceMembershipSchema>;
