import type { NextRequest } from "next/server";
import { adminApi, adminQuery } from "@/lib/admin/http";
import { listAdminUsers } from "@/lib/admin/queries";

export async function GET(request: NextRequest) {
  return adminApi(request, "users.view", (actorId) => listAdminUsers(actorId, adminQuery(request)));
}
