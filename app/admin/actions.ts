"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireRole } from "@/lib/auth/authorization";

export async function invalidateAdminNavigation() {
  await requireRole(["admin", "super_admin"]);
  updateTag("admin");
  revalidatePath("/admin", "layout");
}
