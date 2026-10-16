import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { updateSettings } from "@/lib/admin/roles";
import { PlatformSettings } from "@/models";
import { settingsSchema } from "@/lib/admin/schemas";
import { readJson } from "@/lib/dashboard/http";

export async function GET(request: NextRequest) {
  return adminApi(request, "settings.manage", async () => ({ aiEnabled: (await PlatformSettings.findById("platform").lean())?.aiEnabled ?? true }));
}
export async function PUT(request: NextRequest) {
  return adminApi(request, "settings.manage", async (actorId) => updateSettings(actorId, (await readJson(request, settingsSchema)).aiEnabled));
}
