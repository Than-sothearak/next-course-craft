import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { getAdminSummary } from "@/lib/admin/queries";

export async function GET(request: NextRequest) {
  return adminApi(request, "users.view", getAdminSummary);
}
