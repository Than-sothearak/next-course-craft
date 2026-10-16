import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { getRolePolicies, updateRolePermissions } from "@/lib/admin/roles";
import { roleMutationSchema } from "@/lib/admin/schemas";
import { readJson } from "@/lib/dashboard/http";

export async function GET(request: NextRequest) { return adminApi(request, "roles.manage", getRolePolicies); }
export async function PUT(request: NextRequest) {
  return adminApi(request, "roles.manage", async (actorId) => updateRolePermissions(actorId, await readJson(request, roleMutationSchema)));
}
