import type { NextRequest } from "next/server";
import { adminApi, adminQuery } from "@/lib/admin/http";
import { listAdminWorkspaces } from "@/lib/admin/workspaces";

export async function GET(request: NextRequest) {
  return adminApi(request, "workspaces.manage", (actorId) => listAdminWorkspaces(actorId, adminQuery(request)), true);
}
