import type { NextRequest } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { readJson } from "@/lib/dashboard/http";
import { getMediaStorageSettings, updateMediaStorageSettings } from "@/lib/media/settings";
import { mediaStorageSettingsSchema } from "@/lib/media/settings-schema";


export async function GET(request: NextRequest) {
  return adminApi(request, "settings.manage", getMediaStorageSettings);
}
export async function PUT(request: NextRequest) {
  return adminApi(request, "settings.manage", async (actorId) => updateMediaStorageSettings(actorId, await readJson(request, mediaStorageSettingsSchema)));
}
