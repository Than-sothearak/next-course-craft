import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { getAdminUserDetail } from "@/lib/admin/queries";
import { mutateUser } from "@/lib/admin/users";
import { userMutationSchema } from "@/lib/admin/schemas";
import { readJson } from "@/lib/dashboard/http";

type Context = { params: Promise<{ userId: string }> };
export async function GET(request: NextRequest, context: Context) {
  return adminApi(request, "users.view", async (actorId) => getAdminUserDetail(actorId, (await context.params).userId));
}
export async function PATCH(request: NextRequest, context: Context) {
  // The exact action's authority is checked again inside the transaction.
  return adminApi(request, "users.view", async (actorId) => mutateUser(actorId, (await context.params).userId, await readJson(request, userMutationSchema)));
}
