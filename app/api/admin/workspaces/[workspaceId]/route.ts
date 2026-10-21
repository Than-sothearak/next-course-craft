import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { deleteAdminWorkspace, getAdminWorkspace, updateAdminWorkspace } from "@/lib/admin/workspaces";
import { deleteAdminWorkspaceSchema, updateAdminWorkspaceSchema } from "@/lib/admin/schemas";
import { readJson } from "@/lib/dashboard/http";

type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  return adminApi(request, "workspaces.manage", async (actorId) => getAdminWorkspace(actorId, (await context.params).workspaceId), true);
}

export async function PATCH(request: NextRequest, context: Context) {
  return adminApi(request, "workspaces.manage", async (actorId) => updateAdminWorkspace(actorId, (await context.params).workspaceId, await readJson(request, updateAdminWorkspaceSchema)), true);
}

export async function DELETE(request: NextRequest, context: Context) {
  return adminApi(request, "workspaces.manage", async (actorId) => deleteAdminWorkspace(actorId, (await context.params).workspaceId, await readJson(request, deleteAdminWorkspaceSchema)), true);
}
