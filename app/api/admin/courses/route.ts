import type { NextRequest } from "next/server";
import { adminApi, adminQuery } from "@/lib/admin/http";
import { listAdminCourses } from "@/lib/admin/queries";

export async function GET(request: NextRequest) {
  return adminApi(request, "courses.manage_all", (actorId) => listAdminCourses(actorId, adminQuery(request)));
}
