import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { mutateCourse } from "@/lib/admin/courses";
import { courseMutationSchema } from "@/lib/admin/schemas";
import { readJson } from "@/lib/dashboard/http";

export async function PATCH(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  return adminApi(request, "courses.manage_all", async (actorId) => mutateCourse(actorId, (await context.params).courseId, await readJson(request, courseMutationSchema)));
}
